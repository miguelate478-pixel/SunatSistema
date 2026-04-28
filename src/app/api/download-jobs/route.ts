import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { jobQueue, JOB_TYPES } from "@/lib/jobs";
import "@/lib/jobs/download.worker"; // register worker
import { audit, requestMeta } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { z } from "zod";

const createJobSchema = z.object({
  companyId: z.string().uuid(),
  tipo: z.enum(["propuesta-compras", "propuesta-ventas", "resumen", "comprobantes"]),
  periodo: z.string().regex(/^\d{6}$/), // YYYYMM format
});

export async function GET(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD"]);
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    const jobs = await prisma.downloadJob.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: jobs.map((j) => ({
        id: j.id,
        tipo: j.tipo,
        periodo: j.periodo,
        numTicket: j.numTicket,
        status: j.status,
        progress: j.progress,
        errorMessage: j.errorMessage,
        resultData: j.resultData,
        createdAt: j.createdAt.toISOString(),
        completedAt: j.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener jobs";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD"]);

    // Rate limit download job creation
    const rl = await rateLimit(`download:${session.id}`, RATE_LIMITS.DOWNLOAD_JOB);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Demasiadas solicitudes de descarga. Espera un momento." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validated = createJobSchema.parse(body);

    // Create download job
    const job = await prisma.downloadJob.create({
      data: {
        companyId: validated.companyId,
        numTicket: `TKT-${Date.now()}`, // Temporary ticket number
        tipo: validated.tipo,
        periodo: validated.periodo,
        status: "PENDING",
        progress: 0,
      },
    });

    // Enqueue job via job queue (fire and forget)
    // TODO: Fix JobPayload type to include periodo
    // await jobQueue.enqueue(JOB_TYPES.DOWNLOAD_SUNAT, {
    //   jobId: job.id,
    //   companyId: validated.companyId,
    //   tipo: validated.tipo,
    //   periodo: validated.periodo,
    // });

    // Audit log
    audit({
      userId: session.id,
      companyId: validated.companyId,
      action: "DOWNLOAD_JOB_CREATE",
      entity: "DownloadJob",
      entityId: job.id,
      changes: { tipo: validated.tipo, periodo: validated.periodo },
      ...requestMeta(request),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        tipo: job.tipo,
        periodo: job.periodo,
        status: "PENDING",
        progress: 0,
        createdAt: job.createdAt.toISOString(),
      },
      message: `Job de descarga creado para período ${validated.periodo}.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al crear job";
    console.error("Create download job error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 400 });
  }
}
