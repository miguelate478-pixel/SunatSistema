/**
 * POST /api/vouchers/import
 * Importa comprobantes desde CSV.
 * Formato esperado (cabecera obligatoria):
 *   tipo,serie,numero,fechaEmision,rucEmisor,razonSocialEmisor,rucReceptor,razonSocialReceptor,moneda,subtotal,igv,total,estado
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  }).filter((row) => Object.values(row).some((v) => v !== ""));
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD"]);

    const formData = await request.formData();
    const companyId = formData.get("companyId") as string;
    const file = formData.get("file") as File | null;

    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });
    if (!file) return NextResponse.json({ success: false, error: "Archivo CSV requerido" }, { status: 400 });

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "El archivo está vacío o no tiene el formato correcto" }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const serie = row.serie || row.serie_comprobante || "";
        const numero = row.numero || row.numero_comprobante || "";
        const tipo = (row.tipo || "FACTURA").toUpperCase().replace(" ", "_");
        const fechaEmision = row.fechaemision || row.fecha_emision || row.fecha || "";
        const rucEmisor = row.rucemisor || row.ruc_emisor || row.ruc_proveedor || "";
        const razonSocialEmisor = row.razonsocialemisor || row.razon_social_emisor || row.proveedor || row.emisor || "";
        const rucReceptor = row.rucreceptor || row.ruc_receptor || row.ruc_cliente || "";
        const razonSocialReceptor = row.razonsocialreceptor || row.razon_social_receptor || row.cliente || row.receptor || "";
        const moneda = (row.moneda || "PEN").toUpperCase();
        const total = parseFloat(row.total || "0");
        const subtotal = parseFloat(row.subtotal || row.base_imponible || String(total / 1.18));
        const igv = parseFloat(row.igv || String(total - subtotal));
        const estado = (row.estado || "PENDIENTE").toUpperCase();

        if (!serie || !numero || !fechaEmision || !rucEmisor) {
          errors.push(`Fila ${created + skipped + errors.length + 1}: faltan campos obligatorios (serie, numero, fechaEmision, rucEmisor)`);
          continue;
        }

        // Check duplicate
        const exists = await prisma.voucher.findFirst({
          where: { companyId, serie, numero, deletedAt: null },
        });
        if (exists) { skipped++; continue; }

        await prisma.voucher.create({
          data: {
            companyId,
            tipo: ["FACTURA", "BOLETA", "NOTA_CREDITO", "NOTA_DEBITO", "RECIBO"].includes(tipo) ? tipo : "FACTURA",
            serie,
            numero,
            fechaEmision: new Date(fechaEmision),
            rucEmisor,
            razonSocialEmisor: razonSocialEmisor || rucEmisor,
            rucReceptor: rucReceptor || "",
            razonSocialReceptor: razonSocialReceptor || rucReceptor || "",
            moneda: ["PEN", "USD"].includes(moneda) ? moneda : "PEN",
            subtotal,
            igv,
            total,
            estado: ["ACEPTADO", "RECHAZADO", "PENDIENTE", "ANULADO", "OBSERVADO"].includes(estado) ? estado : "PENDIENTE",
            tieneXML: false,
            tienePDF: false,
            tieneCDR: false,
            afectoDetraccion: false,
            createdById: session.id,
          },
        });
        created++;
      } catch (err) {
        errors.push(`Fila ${created + skipped + errors.length + 1}: ${err instanceof Error ? err.message : "error desconocido"}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: { created, skipped, errors: errors.slice(0, 10) },
      message: `${created} comprobantes importados, ${skipped} duplicados omitidos${errors.length > 0 ? `, ${errors.length} errores` : ""}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al importar";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 400 });
  }
}
