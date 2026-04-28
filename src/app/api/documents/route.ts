import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    const vouchers = await prisma.voucher.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { fechaEmision: "desc" },
      take: 200,
      select: {
        id: true,
        serie: true,
        numero: true,
        tipo: true,
        razonSocialEmisor: true,
        rucEmisor: true,
        fechaEmision: true,
        total: true,
        moneda: true,
        tieneXML: true,
        tienePDF: true,
        tieneCDR: true,
        estado: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: vouchers.map((v) => ({
        id: v.id,
        voucherId: v.id,
        serie: v.serie,
        numero: v.numero,
        tipo: v.tipo,
        razonSocialEmisor: v.razonSocialEmisor,
        rucEmisor: v.rucEmisor,
        fechaEmision: v.fechaEmision.toISOString(),
        total: Number(v.total),
        moneda: v.moneda,
        tieneXML: v.tieneXML,
        tienePDF: v.tienePDF,
        tieneCDR: v.tieneCDR,
        estado: v.estado,
        folderPath: `/${v.fechaEmision.getFullYear()}/${String(v.fechaEmision.getMonth() + 1).padStart(2, "0")}`,
        downloadCount: 0,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener documentos";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 500 });
  }
}
