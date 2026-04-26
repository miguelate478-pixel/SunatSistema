/**
 * GET /api/vouchers/[id]  — detalle completo con items, documentos, detracción
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { storage } from "@/lib/storage";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const voucher = await prisma.voucher.findUnique({
      where: { id, deletedAt: null },
      include: {
        items: { orderBy: { orden: "asc" } },
        documents: { orderBy: { uploadedAt: "desc" } },
        detraction: true,
      },
    });

    if (!voucher) {
      return NextResponse.json({ success: false, error: "Comprobante no encontrado" }, { status: 404 });
    }

    await requireCompanyAccess(voucher.companyId);

    // Build signed URLs for documents
    const documentsWithUrls = await Promise.all(
      voucher.documents.map(async (doc) => {
        let downloadUrl: string | null = null;
        try {
          downloadUrl = await storage.signedUrl(doc.filepath, 3600);
        } catch { /* storage not available */ }
        return {
          id: doc.id,
          tipo: doc.tipo,
          filename: doc.filename,
          filesize: doc.filesize,
          mimeType: doc.mimeType,
          uploadedAt: doc.uploadedAt.toISOString(),
          downloadUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        id: voucher.id,
        serie: voucher.serie,
        numero: voucher.numero,
        tipo: voucher.tipo,
        razonSocialEmisor: voucher.razonSocialEmisor,
        rucEmisor: voucher.rucEmisor,
        razonSocialReceptor: voucher.razonSocialReceptor,
        rucReceptor: voucher.rucReceptor,
        fechaEmision: voucher.fechaEmision.toISOString(),
        fechaVencimiento: voucher.fechaVencimiento?.toISOString() ?? null,
        subtotal: Number(voucher.subtotal),
        igv: Number(voucher.igv),
        total: Number(voucher.total),
        moneda: voucher.moneda,
        estado: voucher.estado,
        tieneXML: voucher.tieneXML,
        tienePDF: voucher.tienePDF,
        tieneCDR: voucher.tieneCDR,
        afectoDetraccion: voucher.afectoDetraccion,
        porcentajeDetraccion: voucher.porcentajeDetraccion ? Number(voucher.porcentajeDetraccion) : null,
        montoDetraccion: voucher.montoDetraccion ? Number(voucher.montoDetraccion) : null,
        estadoDetraccion: voucher.estadoDetraccion ?? null,
        observaciones: voucher.observaciones ?? null,
        items: voucher.items.map((item) => ({
          descripcion: item.descripcion,
          cantidad: Number(item.cantidad),
          unidad: item.unidad,
          precioUnitario: Number(item.precioUnitario),
          subtotal: Number(item.subtotal),
          igv: Number(item.igv),
          total: Number(item.total),
        })),
        documents: documentsWithUrls,
        detraccion: voucher.detraction ? {
          porcentaje: Number(voucher.detraction.porcentaje),
          monto: Number(voucher.detraction.monto),
          estado: voucher.detraction.estado,
          fechaPago: voucher.detraction.fechaPago?.toISOString() ?? null,
          numeroConstancia: voucher.detraction.numeroConstancia ?? null,
        } : null,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: msg }, {
      status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 500,
    });
  }
}
