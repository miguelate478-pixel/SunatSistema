/**
 * POST /api/vouchers/import-xml
 *
 * Importa comprobantes desde:
 *   - Un archivo XML individual
 *   - Un archivo ZIP con múltiples XMLs
 *
 * Flujo:
 *   1. Recibe archivo(s)
 *   2. Parsea XML con xml-parser.ts
 *   3. Registra voucher en DB (deduplicado)
 *   4. Guarda el XML en storage
 *   5. Crea VoucherDocument con tipo=XML
 *   6. Encola descarga de PDF+CDR si hay credenciales SUNAT
 *   7. Retorna stats
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { parseVoucherXML } from "@/lib/sunat/xml-parser";
import { jobQueue, JOB_TYPES } from "@/lib/jobs";

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  voucherIds: string[];
}

async function processXML(
  xmlContent: string,
  filename: string,
  companyId: string,
  userId: string
): Promise<{ voucherId: string | null; action: "created" | "updated" | "skipped" | "error"; error?: string }> {
  const parsed = parseVoucherXML(xmlContent);
  if (!parsed) {
    return { voucherId: null, action: "error", error: `${filename}: no se pudo parsear el XML` };
  }

  try {
    // Check for existing voucher
    const existing = await prisma.voucher.findFirst({
      where: { companyId, serie: parsed.serie, numero: parsed.numero, deletedAt: null },
    });

    let voucherId: string;

    if (existing) {
      // Update with richer data from XML
      await prisma.voucher.update({
        where: { id: existing.id },
        data: {
          razonSocialEmisor: parsed.razonSocialEmisor || existing.razonSocialEmisor,
          razonSocialReceptor: parsed.razonSocialReceptor || existing.razonSocialReceptor,
          subtotal: parsed.subtotal,
          igv: parsed.igv,
          total: parsed.total,
          moneda: parsed.moneda,
          afectoDetraccion: parsed.afectoDetraccion,
          porcentajeDetraccion: parsed.porcentajeDetraccion ?? null,
          montoDetraccion: parsed.montoDetraccion ?? null,
          tieneXML: true,
        },
      });
      voucherId = existing.id;

      // Upsert items if we have them
      if (parsed.items.length > 0) {
        await prisma.voucherItem.deleteMany({ where: { voucherId } });
        await prisma.voucherItem.createMany({
          data: parsed.items.map((item, i) => ({
            voucherId,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: item.unidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            igv: item.igv,
            total: item.total,
            orden: i,
          })),
        });
      }

      // Save XML to storage
      const key = storage.voucherKey(companyId, voucherId, "XML", filename);
      await storage.upload({ key, content: xmlContent, mimeType: "application/xml" });
      await prisma.voucherDocument.upsert({
        where: { id: `${voucherId}-XML` },
        create: {
          id: `${voucherId}-XML`,
          voucherId,
          tipo: "XML",
          filename,
          filepath: key,
          filesize: Buffer.byteLength(xmlContent, "utf8"),
          mimeType: "application/xml",
          storageUrl: storage.url(key),
        },
        update: { filepath: key, storageUrl: storage.url(key), uploadedAt: new Date() },
      });

      return { voucherId, action: "updated" };
    }

    // Create new voucher
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { createdById: true },
    });

    const voucher = await prisma.voucher.create({
      data: {
        companyId,
        tipo: parsed.tipo,
        serie: parsed.serie,
        numero: parsed.numero,
        fechaEmision: new Date(parsed.fechaEmision),
        fechaVencimiento: parsed.fechaVencimiento ? new Date(parsed.fechaVencimiento) : null,
        rucEmisor: parsed.rucEmisor,
        razonSocialEmisor: parsed.razonSocialEmisor,
        rucReceptor: parsed.rucReceptor,
        razonSocialReceptor: parsed.razonSocialReceptor,
        moneda: parsed.moneda,
        subtotal: parsed.subtotal,
        igv: parsed.igv,
        total: parsed.total,
        estado: "PENDIENTE",
        tieneXML: true,
        tienePDF: false,
        tieneCDR: false,
        afectoDetraccion: parsed.afectoDetraccion,
        porcentajeDetraccion: parsed.porcentajeDetraccion ?? null,
        montoDetraccion: parsed.montoDetraccion ?? null,
        estadoDetraccion: parsed.afectoDetraccion ? "PENDIENTE" : null,
        createdById: userId || company?.createdById || "",
        metadata: { importedFromXML: true, importedAt: new Date().toISOString() },
      },
    });
    voucherId = voucher.id;

    // Create items
    if (parsed.items.length > 0) {
      await prisma.voucherItem.createMany({
        data: parsed.items.map((item, i) => ({
          voucherId,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad,
          precioUnitario: item.precioUnitario,
          subtotal: item.subtotal,
          igv: item.igv,
          total: item.total,
          orden: i,
        })),
      });
    }

    // Save XML to storage
    const key = storage.voucherKey(companyId, voucherId, "XML", filename);
    await storage.upload({ key, content: xmlContent, mimeType: "application/xml" });
    await prisma.voucherDocument.create({
      data: {
        id: `${voucherId}-XML`,
        voucherId,
        tipo: "XML",
        filename,
        filepath: key,
        filesize: Buffer.byteLength(xmlContent, "utf8"),
        mimeType: "application/xml",
        storageUrl: storage.url(key),
      },
    });

    return { voucherId, action: "created" };
  } catch (err) {
    return {
      voucherId: null,
      action: "error",
      error: `${filename}: ${err instanceof Error ? err.message : "error desconocido"}`,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD"]);

    const formData = await request.formData();
    const companyId = formData.get("companyId") as string;
    const downloadAfter = formData.get("downloadAfter") === "true";

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });
    }

    const files = formData.getAll("files") as File[];
    if (files.length === 0) {
      return NextResponse.json({ success: false, error: "Se requiere al menos un archivo XML o ZIP" }, { status: 400 });
    }

    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], voucherIds: [] };

    for (const file of files) {
      const filename = file.name.toLowerCase();

      if (filename.endsWith(".xml")) {
        // Single XML
        const content = await file.text();
        const r = await processXML(content, file.name, companyId, session.id);
        if (r.action === "created") { result.created++; if (r.voucherId) result.voucherIds.push(r.voucherId); }
        else if (r.action === "updated") { result.updated++; if (r.voucherId) result.voucherIds.push(r.voucherId); }
        else if (r.action === "skipped") result.skipped++;
        else if (r.error) result.errors.push(r.error);

      } else if (filename.endsWith(".zip")) {
        // ZIP with multiple XMLs — use JSZip
        try {
          const JSZip = (await import("jszip")).default;
          const arrayBuffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);

          const xmlFiles = Object.entries(zip.files).filter(
            ([name, f]) => name.toLowerCase().endsWith(".xml") && !f.dir
          );

          for (const [name, zipFile] of xmlFiles) {
            const content = await zipFile.async("string");
            const r = await processXML(content, name, companyId, session.id);
            if (r.action === "created") { result.created++; if (r.voucherId) result.voucherIds.push(r.voucherId); }
            else if (r.action === "updated") { result.updated++; if (r.voucherId) result.voucherIds.push(r.voucherId); }
            else if (r.action === "skipped") result.skipped++;
            else if (r.error) result.errors.push(r.error);
          }
        } catch (err) {
          result.errors.push(`${file.name}: error al procesar ZIP — ${err instanceof Error ? err.message : "error"}`);
        }
      } else {
        result.errors.push(`${file.name}: formato no soportado (use .xml o .zip)`);
      }
    }

    // Enqueue PDF+CDR download for newly registered vouchers
    if (downloadAfter && result.voucherIds.length > 0) {
      const cred = await prisma.sunatCredential.findFirst({
        where: { companyId, isActive: true, lastTestOk: true },
      });

      if (cred) {
        const downloadJob = await prisma.downloadJob.create({
          data: {
            companyId,
            tipo: "MASIVO",
            parametros: { voucherIds: result.voucherIds, skipXML: true },
            estado: "PENDING",
            progreso: 0,
            totalDocs: result.voucherIds.length,
          },
        });

        await jobQueue.enqueue(JOB_TYPES.DOWNLOAD_SUNAT, {
          jobId: downloadJob.id,
          companyId,
          tipo: "MASIVO",
          parametros: { voucherIds: result.voucherIds, skipXML: true },
        });
      }
    }

    const total = result.created + result.updated + result.skipped;
    return NextResponse.json({
      success: true,
      data: result,
      message: `${result.created} nuevos, ${result.updated} actualizados, ${result.skipped} duplicados${result.errors.length > 0 ? `, ${result.errors.length} errores` : ""}`,
    }, { status: 201 });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al importar";
    return NextResponse.json({ success: false, error: msg }, {
      status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 400,
    });
  }
}
