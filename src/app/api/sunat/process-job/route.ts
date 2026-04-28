/**
 * POST /api/sunat/process-job
 * Procesa un DownloadJob: consulta estado del ticket en SUNAT,
 * descarga el ZIP si está listo, e inserta los vouchers.
 * 
 * El frontend llama este endpoint periódicamente para jobs PENDING/RUNNING.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { SunatClient } from "@/lib/sunat/sunat-client";
import { parseXmlFromZipBuffer } from "@/lib/sunat/xml-processor";
import { parseSireFromZipBuffer } from "@/lib/sunat/sire-parser";
import AdmZip from "adm-zip";
import { z } from "zod";

const schema = z.object({ jobId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { jobId } = schema.parse(await req.json());

    const job = await prisma.downloadJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ success: false, error: "Job no encontrado" }, { status: 404 });

    // Already done
    if (job.status === "SUCCESS" || job.status === "FAILED") {
      return NextResponse.json({ success: true, data: { status: job.status, progress: job.progress } });
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

    // --- Descarga directa (buffer en memoria) ---
    if (job.numTicket.startsWith("DIRECT_")) {
      await processZip(job.id, job.companyId, client, job.numTicket, job.tipo, job.periodo, {});
      const updated = await prisma.downloadJob.findUnique({ where: { id: jobId } });
      return NextResponse.json({ success: true, data: { status: updated?.status, progress: updated?.progress, resultData: updated?.resultData } });
    }

    // --- Consultar estado del ticket ---
    const codLibro = job.tipo === "propuesta-ventas" ? "140000" : "080000";
    const status = await client.checkTicketStatus(job.numTicket, job.periodo, codLibro);

    const terminado = status.estado === "Terminado" || [3, 4].includes(status.codEstadoProceso ?? -1);
    const primerArchivo = status.archivoReporte?.[0];
    const nomArchivo = primerArchivo?.nomArchivoReporte ?? status.nomArchivoReporte;

    if (terminado && nomArchivo) {
      await processZip(job.id, job.companyId, client, nomArchivo, job.tipo, job.periodo, {
        codTipoArchivoReporte: primerArchivo?.codTipoAchivoReporte ?? null,
        codProceso: status.codProceso,
        numTicket: status.numTicket,
        codLibro: status.codLibro ?? codLibro,
        perTributario: status.perTributario ?? job.periodo,
      });
    } else if (["Error", "error", "ERROR"].includes(status.estado)) {
      await prisma.downloadJob.update({
        where: { id: jobId },
        data: { status: "FAILED", errorMessage: "SUNAT reportó error en el ticket", progress: 0 },
      });
    } else {
      const progress = ["Procesando", "En Proceso", "En proceso"].includes(status.estado) ? 50 : 25;
      await prisma.downloadJob.update({
        where: { id: jobId },
        data: { status: "RUNNING", progress },
      });
    }

    const updated = await prisma.downloadJob.findUnique({ where: { id: jobId } });
    return NextResponse.json({ success: true, data: { status: updated?.status, progress: updated?.progress, resultData: updated?.resultData } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[process-job] Error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

async function processZip(
  jobId: string,
  companyId: string,
  client: SunatClient,
  nomArchivo: string,
  tipo: string,
  periodo: string,
  extra: Record<string, unknown>
) {
  try {
    const zipBuffer = await client.downloadFile(nomArchivo, extra as Parameters<typeof client.downloadFile>[1]);

    // Detectar qué tipo de archivos hay en el ZIP
    let comprobantes: Array<{
      rucEmisor?: string; razonSocial?: string; tipoComprobante?: string;
      serie?: string; numero?: string; fechaEmision?: string;
      moneda?: string; baseImponible?: string; igv?: string; importeTotal?: string;
    }> = [];

    try {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      const hasXml = entries.some(e => e.entryName.toLowerCase().endsWith(".xml"));
      const hasTxt = entries.some(e => e.entryName.toLowerCase().endsWith(".txt"));
      const hasXlsx = entries.some(e => e.entryName.toLowerCase().endsWith(".xlsx") || e.entryName.toLowerCase().endsWith(".xls"));

      console.log(`[process-job] ZIP entries: ${entries.map(e => e.entryName).join(", ")}`);
      console.log(`[process-job] hasXml=${hasXml} hasTxt=${hasTxt} hasXlsx=${hasXlsx}`);

      if (hasXml) {
        // XMLs individuales de comprobantes
        comprobantes = await parseXmlFromZipBuffer(zipBuffer, tipo);
      } else if (hasTxt || hasXlsx) {
        // Formato PLE/SIRE (TXT pipe-delimited o Excel)
        comprobantes = await parseSireFromZipBuffer(zipBuffer, tipo);
      } else {
        // Intentar como TXT directo (sin ZIP interno)
        comprobantes = await parseSireFromZipBuffer(zipBuffer, tipo);
      }
    } catch (parseError) {
      console.error("[process-job] Error parseando ZIP:", parseError);
      // Intentar SIRE parser como fallback
      comprobantes = await parseSireFromZipBuffer(zipBuffer, tipo);
    }

    console.log(`[process-job] Comprobantes parseados: ${comprobantes.length}`);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { ruc: true, razonSocial: true },
    });
    if (!company) throw new Error("Empresa no encontrada");

    const esVenta = tipo === "propuesta-ventas";

    const vouchersToCreate = comprobantes
      .filter(c => {
        if (!c.numero || !c.serie) return false;
        const d = parseDate(c.fechaEmision);
        if (isNaN(d.getTime())) return false;
        return true;
      })
      .map((c) => ({
        companyId,
        downloadJobId: jobId,
        tipo: mapTipo(c.tipoComprobante || ""),
        serie: c.serie || "",
        numero: c.numero || "",
        fechaEmision: parseDate(c.fechaEmision),
        rucEmisor:           esVenta ? company.ruc        : (c.rucEmisor || ""),
        razonSocialEmisor:   esVenta ? company.razonSocial : (c.razonSocial || ""),
        rucReceptor:         esVenta ? (c.rucEmisor || "") : company.ruc,
        razonSocialReceptor: esVenta ? (c.razonSocial || "") : company.razonSocial,
        moneda: c.moneda || "PEN",
        subtotal: parseFloat(c.baseImponible || "0") || 0,
        igv: parseFloat(c.igv || "0") || 0,
        total: parseFloat(c.importeTotal || "0") || 0,
        estado: "ACEPTADO",
        tieneXML: false,
        tienePDF: false,
        tieneCDR: false,
        afectoDetraccion: false,
        direccion: esVenta ? "VENTA" : "COMPRA",
        createdById: null,
      }));

    let totalInserted = 0;
    for (let i = 0; i < vouchersToCreate.length; i += 100) {
      const r = await prisma.voucher.createMany({ data: vouchersToCreate.slice(i, i + 100), skipDuplicates: true });
      totalInserted += r.count;
    }

    // Reasignar downloadJobId a todos (nuevos + existentes)
    if (vouchersToCreate.length > 0) {
      await prisma.voucher.updateMany({
        where: {
          companyId,
          OR: vouchersToCreate.map(v => ({ tipo: v.tipo, serie: v.serie, numero: v.numero })),
        },
        data: { downloadJobId: jobId },
      });
    }

    const totalIGV = comprobantes.reduce((s, c) => s + parseFloat(c.igv || "0"), 0);
    const totalImporte = comprobantes.reduce((s, c) => s + parseFloat(c.importeTotal || "0"), 0);

    await prisma.downloadJob.update({
      where: { id: jobId },
      data: {
        status: "SUCCESS",
        progress: 100,
        completedAt: new Date(),
        resultData: {
          totalRegistros: comprobantes.length,
          totalNuevos: totalInserted,
          totalExistentes: comprobantes.length - totalInserted,
          totalIGV: totalIGV.toFixed(2),
          totalImporte: totalImporte.toFixed(2),
        },
      },
    });
  } catch (error) {
    await prisma.downloadJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        progress: 0,
      },
    });
  }
}

function mapTipo(tipo: string): string {
  return ({ "01": "FACTURA", "03": "BOLETA", "07": "NOTA_CREDITO", "08": "NOTA_DEBITO" } as Record<string, string>)[tipo] || "FACTURA";
}

function parseDate(s?: string): Date {
  if (!s) return new Date();
  if (s.includes("/")) { const [d, m, y] = s.split("/"); return new Date(`${y}-${m}-${d}`); }
  return new Date(s);
}
