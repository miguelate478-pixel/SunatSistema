import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    const tipo = searchParams.get("tipo");
    const leida = searchParams.get("leida");

    const alerts = await prisma.alert.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(tipo && { tipo }),
        ...(leida !== null && { leida: leida === "true" }),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: alerts.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        descripcion: a.descripcion,
        tipo: a.tipo,
        categoria: a.categoria,
        accion: a.accion,
        leida: a.leida,
        fechaCreacion: a.createdAt.toISOString(),
        voucherId: null,
        companyId: a.companyId,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener alertas";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 500 });
  }
}
