import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    const detracciones = await prisma.detraction.findMany({
      where: {
        voucher: { companyId },
      },
      include: {
        voucher: {
          include: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: detracciones.map((d) => ({
        id: d.id,
        voucherId: d.voucherId,
        serie: d.voucher.serie,
        numero: d.voucher.numero,
        tipo: d.voucher.tipo,
        razonSocialEmisor: d.voucher.razonSocialEmisor,
        rucEmisor: d.voucher.rucEmisor,
        fechaEmision: d.voucher.fechaEmision.toISOString(),
        total: Number(d.voucher.total),
        porcentaje: Number(d.porcentaje),
        monto: Number(d.monto),
        estado: d.estado,
        fechaPago: d.fechaPago?.toISOString() ?? null,
        numeroConstancia: d.numeroConstancia ?? null,
        // fechaVencimiento: 5 days after emission if pending
        fechaVencimiento: d.estado === "PENDIENTE"
          ? new Date(d.voucher.fechaEmision.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
          : null,
        voucher: {
          tieneXML: d.voucher.tieneXML,
          tienePDF: d.voucher.tienePDF,
          tieneCDR: d.voucher.tieneCDR,
          estado: d.voucher.estado,
        },
      })),
    });
    } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener detracciones";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 500 });
  }
}
