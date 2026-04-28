/**
 * POST /api/sunat/process-job
 *
 * Flujo correcto SIRE:
 * 1. Consulta todos los tickets del período
 * 2. Busca el ticket codProceso=5 (Generación de Registros) que tiene archivos LE...zip
 * 3. Descarga los archivos LE...zip (comprobantes reales)
 * 4. Parsea el TXT pipe-delimited
 * 5. Inserta vouchers en DB
 *
 * Los archivos LE tienen este patrón:
 * - LE{RUC}{PERIODO}0080400011112.zip → compras errores/inconsistencias (tiene datos)
 * - LE{RUC}{PERIODO}0080500001012.zip → compras comprobantes (puede estar vacío)
 * - LE{RUC}{PERIODO}0140400011112.zip → ventas errores/inconsistencias (tiene datos)
 * - LE{RUC}{PERIODO}0140500001012.zip → ventas comprobantes (puede estar vacío)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { SunatClient } from "@/lib/sunat/sunat-client";
import AdmZip from "adm-zip";
import { z } from "zod";

const schema = z.object({ jobId: z.string().uuid() });

const SIRE_API_BASE = "https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { jobId } = schema.parse(await req.json());

    const job = await prisma.downloadJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ success: false, error: "Job no encontrado" }, { status: 404 });

    if (job.status === "SUCCESS" || job.status === "FAILED") {
      return NextResponse.json({ success: true, data: { status: job.status, progress: job.progress, resultData: job.resultData } });
    }

    const credentials = await prisma.sunatCredential.findUnique({ where: { companyId: job.companyId } });
    if (!credentials) return NextResponse.json({ success: false, error: "Sin credenciales SUNAT" }, { status: 400 });

    const client = new SunatClient(
      credentials.clientId,
      credentials.clientSecret,
      credentials.ruc,
      credentials.usuario,
      credentials.claveSol
    );

    // Mark as running
    await prisma.downloadJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", progress: 10 },
    });

    try {
      const result = await downloadAndInsertVouchers(job.id, job.companyId, job.tipo, job.periodo, credentials.ruc, client);

      await prisma.downloadJob.update({
        where: { id: jobId },
        data: {
          status: "SUCCESS",
          progress: 100,
          completedAt: new Date(),
          resultData: result as import("@prisma/client").Prisma.InputJsonValue,
        },
      });

      return NextResponse.json({ success: true, data: { status: "SUCCESS", progress: 100, resultData: result } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await prisma.downloadJob.update({
        where: { id: jobId },
        data: { status: "FAILED", errorMessage: msg, progress: 0 },
      });
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[process-job] Error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

async function downloadAndInsertVouchers(
  jobId: string,
  companyId: string,
  tipo: string,
  periodo: string,
  ruc: string,
  client: SunatClient
): Promise<Record<string, unknown>> {
  const esVenta = tipo === "propuesta-ventas";
  const codLibro = esVenta ? "140000" : "080000";

  // Get auth token
  const token = await client.getOAuth2Token();
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0",
    "Origin": "https://e-factura.sunat.gob.pe",
    "Referer": "https://e-factura.sunat.gob.pe/",
  };

  // Step 1: Get all tickets for this period to find codProceso=5 files
  console.log(`[process-job] Buscando tickets para ${periodo} codLibro=${codLibro}`);

  const statusRes = await fetch(
    `${SIRE_API_BASE}/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets?perIni=${periodo}&perFin=${periodo}&page=1&perPage=50&codLibro=${codLibro}&codOrigenEnvio=2`,
    { headers: authHeaders, signal: AbortSignal.timeout(15000) }
  );

  if (!statusRes.ok) {
    throw new Error(`SUNAT consultaestadotickets HTTP ${statusRes.status}`);
  }

  const statusData = await statusRes.json() as { registros?: unknown[] };
  const registros: Record<string, unknown>[] = (statusData?.registros ?? (Array.isArray(statusData) ? statusData : [])) as Record<string, unknown>[];

  console.log(`[process-job] Tickets encontrados: ${registros.length}`);

  // Find ticket with codProceso=5 (Generación de Registros) — has LE files
  const ticketConDatos = registros.find(r => {
    const cp = r.codProceso;
    return cp === "5" || cp === 5;
  });

  let filesToDownload: string[] = [];

  if (ticketConDatos) {
    const archivos = (ticketConDatos.archivoReporte as Array<{ nomArchivoReporte: string }> | undefined) ?? [];
    const detalleArchivos = (ticketConDatos.detalleTicket as { nomArchivoReporte?: string; archivoReporte?: Array<{ nomArchivoReporte: string }> } | undefined);

    // Get all LE zip files
    const allFiles = [
      ...(archivos.map(a => a.nomArchivoReporte) ?? []),
      ...(detalleArchivos?.archivoReporte?.map(a => a.nomArchivoReporte) ?? []),
      ...(detalleArchivos?.nomArchivoReporte ? [detalleArchivos.nomArchivoReporte] : []),
    ].filter(f => f && f.endsWith(".zip") && f.startsWith("LE"));

    filesToDownload = [...new Set(allFiles)];
    console.log(`[process-job] Archivos LE encontrados: ${filesToDownload.join(", ")}`);
  }

  // If no codProceso=5 ticket, try to construct LE filenames directly
  if (filesToDownload.length === 0) {
    // Standard LE filename patterns
    const patterns = esVenta
      ? [
          `LE${ruc}${periodo}0140400011112.zip`,  // ventas inconsistencias (has data)
          `LE${ruc}${periodo}0140500001012.zip`,  // ventas comprobantes
        ]
      : [
          `LE${ruc}${periodo}0080400011112.zip`,  // compras inconsistencias (has data)
          `LE${ruc}${periodo}0080500001012.zip`,  // compras comprobantes
        ];
    filesToDownload = patterns;
    console.log(`[process-job] Usando patrones estándar: ${filesToDownload.join(", ")}`);
  }

  // Step 2: Download and parse each file
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ruc: true, razonSocial: true },
  });
  if (!company) throw new Error("Empresa no encontrada");

  let totalInserted = 0;
  let totalParsed = 0;
  let lastError = "";

  for (const nomArchivo of filesToDownload) {
    console.log(`[process-job] Descargando ${nomArchivo}`);

    try {
      const dlRes = await fetch(
        `${SIRE_API_BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte?nomArchivoReporte=${encodeURIComponent(nomArchivo)}&codLibro=${codLibro}`,
        { headers: authHeaders, signal: AbortSignal.timeout(60000) }
      );

      if (!dlRes.ok) {
        console.log(`[process-job] ${nomArchivo} HTTP ${dlRes.status} — saltando`);
        lastError = `HTTP ${dlRes.status} para ${nomArchivo}`;
        continue;
      }

      const arrayBuf = await dlRes.arrayBuffer();
      const zipBuffer = Buffer.from(arrayBuf);
      console.log(`[process-job] ${nomArchivo}: ${zipBuffer.length} bytes`);

      // Parse ZIP
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (!entry.entryName.toLowerCase().endsWith(".txt")) continue;

        const content = entry.getData().toString("utf8");
        const lines = content.split("\n").filter(l => l.trim() && l.includes("|"));
        console.log(`[process-job] ${entry.entryName}: ${lines.length} líneas`);

        for (const line of lines) {
          const f = line.split("|").map(s => s.trim().replace(/\r/g, ""));

          // Skip header rows
          if (!f[0] || f[0] === "RUC" || f[0] === "Periodo" || f[0].length !== 11 || isNaN(Number(f[0]))) continue;

          // Detect format by number of fields and content
          // RVIE inconsistencias (ventas): [0]=RUC emisor, [4]=fecha, [6]=tipo, [7]=serie, [8]=numero
          // RCE inconsistencias (compras): similar but emisor is proveedor
          // PLE standard: [0]=periodo, [3]=fecha, [5]=tipo, [6]=serie, [8]=numero, [10]=ruc

          let serie = "", numero = "", tipoComp = "01", fechaStr = "", rucDoc = "", razonDoc = "";
          let baseImponible = 0, igv = 0, total = 0, moneda = "PEN";

          if (f.length >= 34 && f[0].length === 11) {
            // RVIE/RCE inconsistencias format: [0]=RUC, [4]=fecha, [6]=tipo, [7]=serie, [8]=numero
            rucDoc = f[0];
            razonDoc = f[1] || "";
            fechaStr = f[4];
            tipoComp = f[6] || "01";
            serie = f[7];
            numero = f[8];
            // Find montos
            for (let i = 12; i < Math.min(f.length, 35); i++) {
              const n = parseFloat(f[i]);
              if (!isNaN(n) && n > 0 && n < 10000000) {
                if (baseImponible === 0) baseImponible = n;
                else if (igv === 0 && n <= baseImponible * 0.25) igv = n;
                else if (total === 0) { total = n; break; }
              }
              if (f[i] === "PEN" || f[i] === "USD") moneda = f[i];
            }
            if (total === 0) total = baseImponible + igv;
          } else if (f.length >= 22 && /^\d{6}$/.test(f[0])) {
            // PLE standard format
            fechaStr = f[3];
            tipoComp = f[5] || "01";
            serie = f[6];
            numero = f[8];
            rucDoc = f[10];
            razonDoc = f[11] || "";
            baseImponible = parseFloat(f[12]) || 0;
            igv = parseFloat(f[13]) || 0;
            total = parseFloat(f[21] || f[20]) || 0;
            moneda = f[22] || "PEN";
          } else {
            continue;
          }

          if (!serie || !numero) continue;

          // Parse date
          let fechaEmision: Date;
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaStr)) {
            const [d, m, y] = fechaStr.split("/");
            fechaEmision = new Date(`${y}-${m}-${d}`);
          } else continue;
          if (isNaN(fechaEmision.getTime())) continue;

          const tipoMap: Record<string, string> = { "01": "FACTURA", "03": "BOLETA", "07": "NOTA_CREDITO", "08": "NOTA_DEBITO" };
          const tipoVoucher = tipoMap[tipoComp] || "FACTURA";

          // For ventas: empresa emite, rucDoc is the receptor (cliente)
          // For compras: rucDoc is the emisor (proveedor), empresa receives
          const rucEmisor = esVenta ? company.ruc : rucDoc;
          const razonSocialEmisor = esVenta ? company.razonSocial : razonDoc;
          const rucReceptor = esVenta ? rucDoc : company.ruc;
          const razonSocialReceptor = esVenta ? razonDoc : company.razonSocial;

          totalParsed++;

          try {
            await prisma.voucher.create({
              data: {
                companyId,
                downloadJobId: jobId,
                tipo: tipoVoucher,
                serie,
                numero,
                fechaEmision,
                rucEmisor,
                razonSocialEmisor,
                rucReceptor,
                razonSocialReceptor,
                moneda,
                subtotal: baseImponible,
                igv,
                total: total || baseImponible + igv,
                estado: "ACEPTADO",
                tieneXML: false,
                tienePDF: false,
                tieneCDR: false,
                afectoDetraccion: false,
                direccion: esVenta ? "VENTA" : "COMPRA",
                createdById: null,
              },
            });
            totalInserted++;
          } catch (e: unknown) {
            // Skip duplicates silently
            const err = e as { code?: string };
            if (err?.code !== "P2002") {
              console.error("[process-job] Insert error:", e instanceof Error ? e.message : String(e));
            }
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`[process-job] Error descargando ${nomArchivo}: ${msg}`);
      lastError = msg;
    }
  }

  console.log(`[process-job] Resultado: parsed=${totalParsed} inserted=${totalInserted}`);

  if (totalParsed === 0 && lastError) {
    throw new Error(`No se pudieron descargar archivos de SUNAT: ${lastError}`);
  }

  return {
    totalRegistros: totalParsed,
    totalNuevos: totalInserted,
    totalExistentes: totalParsed - totalInserted,
    periodo,
    tipo,
  };
}
