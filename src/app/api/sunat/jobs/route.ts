import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "companyId requerido" },
        { status: 400 }
      );
    }

    // Verify user has access to this company
    const hasAccess = session.companyRoles.some((cr) => cr.company.id === companyId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "No tienes acceso a esta empresa" },
        { status: 403 }
      );
    }

    const jobs = await prisma.downloadJob.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: jobs.map((job) => ({
        id: job.id,
        numTicket: job.numTicket,
        tipo: job.tipo,
        periodo: job.periodo,
        status: job.status,
        progress: job.progress,
        errorMessage: job.errorMessage,
        resultData: job.resultData,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      })),
    });
  } catch (error) {
    console.error("Error getting jobs:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener trabajos" },
      { status: 500 }
    );
  }
}
