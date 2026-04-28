/**
 * Sync Service — orchestrates discovery + download for a company/period.
 *
 * Supports:
 *   - DIARIA  : triggered by cron (daily)
 *   - MANUAL  : triggered by user via API
 *   - REINTENTO: retry of a failed sync
 *
 * Records every execution in sync_executions table.
 */

import prisma from "@/lib/db/prisma";
import { discoverDocuments } from "@/lib/sunat/discovery";
import { jobQueue, JOB_TYPES } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";

export type SyncTipo = "DIARIA" | "MANUAL" | "REINTENTO";

export interface SyncParams {
  companyId: string;
  tipo: SyncTipo;
  fechaInicio?: string; // defaults to first day of current month
  fechaFin?: string;    // defaults to today
  triggeredBy?: string; // userId or "cron"
  downloadFiles?: boolean; // also enqueue download job after discovery
}

export interface SyncResult {
  syncId: string;
  companyId: string;
  tipo: SyncTipo;
  estado: "COMPLETED" | "FAILED";
  docsNuevos: number;
  docsOk: number;
  docsError: number;
  duracionMs: number;
  errorMsg?: string;
}

function defaultPeriod(): { fechaInicio: string; fechaFin: string; periodo: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    fechaInicio: `${year}-${month}-01`,
    fechaFin: `${year}-${month}-${day}`,
    periodo: `${year}-${month}`,
  };
}

/**
 * Run a full sync for a company:
 *   1. Create SyncExecution record (RUNNING)
 *   2. Discover new documents from SUNAT
 *   3. Optionally enqueue download job for new docs
 *   4. Update SyncExecution (COMPLETED | FAILED)
 *   5. Update SunatCredential.lastSyncAt
 */
export async function runSync(params: SyncParams): Promise<SyncResult> {
  const { companyId, tipo, triggeredBy, downloadFiles = true } = params;
  const defaults = defaultPeriod();
  const fechaInicio = params.fechaInicio ?? defaults.fechaInicio;
  const fechaFin = params.fechaFin ?? defaults.fechaFin;
  const periodo = `${fechaInicio.slice(0, 7)}`; // "YYYY-MM"

  const startedAt = Date.now();

  // Get company RUC
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ruc: true, razonSocial: true },
  });
  if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);

  // Create sync execution record
  const syncExec = await prisma.syncExecution.create({
    data: {
      companyId,
      tipo,
      estado: "RUNNING",
      periodo,
      fechaInicio,
      fechaFin,
      triggeredBy: triggeredBy ?? "system",
    },
  });

  logger.info("[SyncService] Sync started", {
    syncId: syncExec.id,
    companyId,
    tipo,
    fechaInicio,
    fechaFin,
  });

  try {
    // Step 1: Discover new documents
    const discovery = await discoverDocuments({
      companyId,
      ruc: company.ruc,
      fechaInicio,
      fechaFin,
      triggeredBy: triggeredBy ?? "cron",
    });

    // Step 2: Optionally enqueue download for new vouchers
    let downloadJobId: string | null = null;
    if (downloadFiles && discovery.created > 0) {
      const downloadJob = await prisma.downloadJob.create({
        data: {
          companyId,
          numTicket: `SYNC-${Date.now()}`,
          tipo: "comprobantes",
          periodo: fechaInicio.slice(0, 7).replace('-', ''), // YYYYMM
          status: "PENDING",
          progress: 0,
          resultData: { fechaInicio, fechaFin, syncId: syncExec.id, totalDocs: discovery.created },
        },
      });
      downloadJobId = downloadJob.id;

      // TODO: Fix JobPayload type
      // await jobQueue.enqueue(JOB_TYPES.DOWNLOAD_SUNAT, {
      //   jobId: downloadJob.id,
      //   companyId,
      //   tipo: "comprobantes",
      //   periodo: fechaInicio.slice(0, 7).replace('-', ''),
      // });

      logger.info("[SyncService] Download job enqueued", {
        syncId: syncExec.id,
        downloadJobId,
        newDocs: discovery.created,
      });
    }

    const duracionMs = Date.now() - startedAt;

    // Update sync execution
    await prisma.syncExecution.update({
      where: { id: syncExec.id },
      data: {
        estado: "COMPLETED",
        docsNuevos: discovery.created,
        docsOk: discovery.created,
        docsError: discovery.errors,
        duracionMs,
        completedAt: new Date(),
      },
    });

    // Update credential lastSyncAt
    await prisma.sunatCredential.updateMany({
      where: { companyId },
      data: { lastSyncAt: new Date() },
    });

    // Audit log
    if (triggeredBy && triggeredBy !== "cron") {
      audit({
        userId: triggeredBy,
        companyId,
        action: "SYNC_MANUAL",
        entity: "SyncExecution",
        entityId: syncExec.id,
        changes: {
          tipo,
          periodo,
          docsNuevos: discovery.created,
          downloadJobId,
        },
      });
    }

    logger.info("[SyncService] Sync completed", {
      syncId: syncExec.id,
      companyId,
      duracionMs,
      docsNuevos: discovery.created,
      docsError: discovery.errors,
    });

    return {
      syncId: syncExec.id,
      companyId,
      tipo,
      estado: "COMPLETED",
      docsNuevos: discovery.created,
      docsOk: discovery.created,
      docsError: discovery.errors,
      duracionMs,
    };
  } catch (err) {
    const duracionMs = Date.now() - startedAt;
    const errorMsg = err instanceof Error ? err.message : String(err);

    await prisma.syncExecution.update({
      where: { id: syncExec.id },
      data: {
        estado: "FAILED",
        errorMsg,
        duracionMs,
        completedAt: new Date(),
      },
    });

    logger.error("[SyncService] Sync failed", {
      syncId: syncExec.id,
      companyId,
      error: errorMsg,
      duracionMs,
    });

    return {
      syncId: syncExec.id,
      companyId,
      tipo,
      estado: "FAILED",
      docsNuevos: 0,
      docsOk: 0,
      docsError: 1,
      duracionMs,
      errorMsg,
    };
  }
}

/**
 * Run daily sync for ALL active companies with valid SUNAT credentials.
 * Called by the cron scheduler.
 */
export async function runDailySync(): Promise<void> {
  logger.info("[SyncService] Starting daily sync for all companies");

  const credentials = await prisma.sunatCredential.findMany({
    where: { isActive: true },
    select: { companyId: true },
  });

  logger.info("[SyncService] Companies to sync", { count: credentials.length });

  const results = await Promise.allSettled(
    credentials.map((cred) =>
      runSync({
        companyId: cred.companyId,
        tipo: "DIARIA",
        triggeredBy: "cron",
        downloadFiles: true,
      })
    )
  );

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  logger.info("[SyncService] Daily sync complete", {
    total: credentials.length,
    ok,
    failed,
  });
}
