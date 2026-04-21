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
  tipo: z.enum(["XML", "PDF", "CDR", "MASIVO"]),
  parametros: z.object({
    serie: z.string().optional(),
    numero: z.string().optional(),
    fechaInicio: z.string().optional(),
    fechaFin: z.string().optional(),
  }).default({}),
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
        parametros: j.parametros,
        estado: j.estado,
        progreso: j.progreso,
        totalDocs: j.totalDocs,
        docsOk: j.docsOk,
        docsError: j.docsError,
        errorMsg: j.errorMsg,
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

    // Count matching vouchers for realistic simulation
    const company = await prisma.company.findUnique({ where: { id: validated.companyId } });
    if (!company) return NextResponse.json({ success: false, error: "Empresa no encontrada" }, { status: 404 });

    const voucherWhere = {
      companyId: validated.companyId,
      deletedAt: null as null,
      ...(validated.parametros.serie ? { serie: validated.parametros.serie } : {}),
      ...(validated.parametros.numero ? { numero: validated.parametros.numero } : {}),
      ...(validated.parametros.fechaInicio && validated.parametros.fechaFin ? {
        fechaEmision: {
          gte: new Date(validated.parametros.fechaInicio),
          lte: new Date(validated.parametros.fechaFin),
        },
      } : {}),
    };

    const totalVouchers = await prisma.voucher.count({ where: voucherWhere });

    const job = await prisma.downloadJob.create({
      data: {
        companyId: validated.companyId,
        tipo: validated.tipo,
        parametros: validated.parametros,
        estado: "PENDING",
        progreso: 0,
        totalDocs: totalVouchers,
      },
    });

    // Enqueue job via job queue (fire and forget)
    await jobQueue.enqueue(JOB_TYPES.DOWNLOAD_SUNAT, {
      jobId: job.id,
      companyId: validated.companyId,
      tipo: validated.tipo,
      parametros: validated.parametros as Record<string, unknown>,
    });

    // Audit log
    audit({
      userId: session.id,
      companyId: validated.companyId,
      action: "DOWNLOAD_JOB_CREATE",
      entity: "DownloadJob",
      entityId: job.id,
      changes: { tipo: validated.tipo, totalDocs: totalVouchers },
      ...requestMeta(request),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        tipo: job.tipo,
        estado: "PENDING",
        progreso: 0,
        totalDocs: totalVouchers,
        createdAt: job.createdAt.toISOString(),
      },
      message: `Job de descarga creado. Se procesarán ${totalVouchers} comprobantes.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al crear job";
    console.error("Create download job error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 400 });
  }
}
