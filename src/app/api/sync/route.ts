/**
 * POST /api/sync        — trigger manual sync for a company
 * GET  /api/sync        — list sync executions for a company
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { runSync } from "@/lib/jobs/sync.service";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { z } from "zod";

const syncSchema = z.object({
  companyId: z.string().uuid(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  downloadFiles: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD"]);

    const rl = await rateLimit(`sync:${session.id}`, RATE_LIMITS.DOWNLOAD_JOB);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Demasiadas solicitudes de sincronización. Espera un momento." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validated = syncSchema.parse(body);

    // Verify user has access to this company
    const hasAccess = session.companyRoles.some(
      (cr: { companyId: string }) => cr.companyId === validated.companyId
    );
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "Sin acceso a esta empresa" }, { status: 403 });
    }

    // Run sync (async — returns when discovery is done, download is enqueued)
    const result = await runSync({
      companyId: validated.companyId,
      tipo: "MANUAL",
      fechaInicio: validated.fechaInicio,
      fechaFin: validated.fechaFin,
      triggeredBy: session.id,
      downloadFiles: validated.downloadFiles,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: result.estado === "COMPLETED"
        ? `Sincronización completada. ${result.docsNuevos} documentos nuevos descubiertos.`
        : `Sincronización fallida: ${result.errorMsg}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al sincronizar";
    const isAuthError = msg === "No autenticado" || msg === "No autorizado";
    return NextResponse.json(
      { success: false, error: isAuthError ? msg : "Error al ejecutar sincronización. Revisa los logs." },
      { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD"]);

    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });
    }

    const executions = await prisma.syncExecution.findMany({
      where: { companyId },
      orderBy: { startedAt: "desc" },
      take: 30,
    });

    // Get last successful sync
    const lastOk = executions.find((e) => e.estado === "COMPLETED");

    return NextResponse.json({
      success: true,
      data: {
        executions: executions.map((e) => ({
          id: e.id,
          tipo: e.tipo,
          estado: e.estado,
          periodo: e.periodo,
          fechaInicio: e.fechaInicio,
          fechaFin: e.fechaFin,
          docsNuevos: e.docsNuevos,
          docsOk: e.docsOk,
          docsError: e.docsError,
          duracionMs: e.duracionMs,
          errorMsg: e.errorMsg,
          triggeredBy: e.triggeredBy,
          startedAt: e.startedAt.toISOString(),
          completedAt: e.completedAt?.toISOString() ?? null,
        })),
        lastSync: lastOk
          ? {
              at: lastOk.completedAt?.toISOString() ?? lastOk.startedAt.toISOString(),
              docsNuevos: lastOk.docsNuevos,
              tipo: lastOk.tipo,
            }
          : null,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener sincronizaciones";
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg === "No autenticado" ? 401 : 500 }
    );
  }
}
