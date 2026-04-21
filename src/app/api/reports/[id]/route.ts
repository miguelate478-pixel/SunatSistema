import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const report = await prisma.reportExecution.findUnique({ where: { id } });
    if (!report) return NextResponse.json({ success: false, error: "Reporte no encontrado" }, { status: 404 });

    return NextResponse.json({
      success: true,
      data: {
        id: report.id,
        tipo: report.tipo,
        formato: report.formato,
        estado: report.estado,
        parametros: report.parametros,
        filesize: report.filesize,
        errorMsg: report.errorMsg,
        executedAt: report.executedAt.toISOString(),
        completedAt: report.completedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener reporte";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 500 });
  }
}
