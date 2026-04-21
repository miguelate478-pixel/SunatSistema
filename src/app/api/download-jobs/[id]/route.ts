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

    const job = await prisma.downloadJob.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ success: false, error: "Job no encontrado" }, { status: 404 });

    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        companyId: job.companyId,
        tipo: job.tipo,
        parametros: job.parametros,
        estado: job.estado,
        progreso: job.progreso,
        totalDocs: job.totalDocs,
        docsOk: job.docsOk,
        docsError: job.docsError,
        errorMsg: job.errorMsg,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener job";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 500 });
  }
}
