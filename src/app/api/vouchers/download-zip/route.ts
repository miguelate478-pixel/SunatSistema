/**
 * POST /api/vouchers/download-zip
 * Empaqueta los archivos XML/PDF/CDR disponibles de una lista de vouchers en un ZIP.
 *
 * Body: { companyId, voucherIds: string[], tipos?: ("XML"|"PDF"|"CDR")[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import JSZip from "jszip";
import { z } from "zod";

const schema = z.object({
  companyId: z.string().uuid(),
  voucherIds: z.array(z.string().uuid()).min(1).max(100),
  tipos: z.array(z.enum(["XML", "PDF", "CDR"])).default(["XML", "PDF", "CDR"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, voucherIds, tipos } = schema.parse(body);

    await requireCompanyAccess(companyId);

    // Load vouchers with their documents
    const vouchers = await prisma.voucher.findMany({
      where: { id: { in: voucherIds }, companyId, deletedAt: null },
      include: {
        documents: {
          where: { tipo: { in: tipos } },
        },
      },
    });

    if (vouchers.length === 0) {
      return NextResponse.json({ success: false, error: "No se encontraron comprobantes" }, { status: 404 });
    }

    const zip = new JSZip();
    let filesAdded = 0;
    const errors: string[] = [];

    for (const voucher of vouchers) {
      const folderName = `${voucher.serie}-${voucher.numero}`;

      for (const doc of voucher.documents) {
        try {
          const content = await storage.get(doc.filepath);
          zip.file(`${folderName}/${doc.filename}`, content);
          filesAdded++;
        } catch {
          errors.push(`${folderName}/${doc.filename}: no disponible en storage`);
        }
      }
    }

    if (filesAdded === 0) {
      return NextResponse.json({
        success: false,
        error: "No hay archivos disponibles para descargar. Los documentos deben estar descargados primero.",
      }, { status: 404 });
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const filename = `comprobantes_${new Date().toISOString().split("T")[0]}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Files-Added": String(filesAdded),
        "X-Errors": errors.length > 0 ? errors.slice(0, 5).join("; ") : "",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al generar ZIP";
    return NextResponse.json({ success: false, error: msg }, {
      status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 400,
    });
  }
}
