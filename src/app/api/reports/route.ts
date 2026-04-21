import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    const reports = await prisma.reportExecution.findMany({
      where: { companyId },
      orderBy: { executedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: reports.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        formato: r.formato,
        estado: r.estado,
        parametros: r.parametros,
        filesize: r.filesize,
        errorMsg: r.errorMsg,
        executedAt: r.executedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener reportes";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 500 });
  }
}
