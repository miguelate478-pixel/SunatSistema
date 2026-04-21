/**
 * SUNAT Download Worker
 * PENDING → PROCESSING → COMPLETED | FAILED
 *
 * Uses per-company SUNAT credentials from DB.
 * Falls back to mock provider when SUNAT_PROVIDER != "real".
 */

import prisma from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { jobQueue, JOB_TYPES, type JobPayload } from "./index";
import { getSunatProviderForCompany, toUserMessage } from "@/lib/sunat";
import { logger } from "@/lib/logger";

interface DownloadParams {
  serie?: string;
  numero?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

async function processDownload(
  jobId: string,
  companyId: string,
  tipo: string,
  params: DownloadParams
): Promise<{ docsOk: number; docsError: number }> {
  const provider = await getSunatProviderForCompany(companyId);

  const voucherWhere = {
    companyId,
    deletedAt: null as null,
    ...(params.serie ? { serie: params.serie } : {}),
    ...(params.numero ? { numero: params.numero } : {}),
    ...(params.fechaInicio && params.fechaFin ? {
      fechaEmision: { gte: new Date(params.fechaInicio), lte: new Date(params.fechaFin) },
    } : {}),
  };

  const vouchers = await prisma.voucher.findMany({
    where: voucherWhere,
    select: { id: true, serie: true, numero: true, tipo: true, rucEmisor: true, fechaEmision: true, companyId: true },
  });

  logger.info("[DownloadWorker] Processing vouchers", { jobId, companyId, tipo, count: vouchers.length });

  let docsOk = 0;
  let docsError = 0;

  const tiposToDownload: Array<"XML" | "PDF" | "CDR"> =
    tipo === "MASIVO" ? ["XML", "PDF", "CDR"] : [tipo as "XML" | "PDF" | "CDR"];

  for (const voucher of vouchers) {
    for (const tipoArchivo of tiposToDownload) {
      try {
        const result = await provider.downloadDocument(
          {
            voucherId: voucher.id,
            serie: voucher.serie,
            numero: voucher.numero,
            tipo: voucher.tipo,
            rucEmisor: voucher.rucEmisor,
            fechaEmision: voucher.fechaEmision.toISOString().split("T")[0],
          },
          tipoArchivo
        );

        const key = storage.voucherKey(companyId, voucher.id, tipoArchivo, result.filename);
        await storage.upload({
          key,
          content: result.content,
          mimeType: result.mimeType,
          metadata: { jobId, voucherId: voucher.id, tipo: tipoArchivo },
        });

        // Update voucher flags
        const flagUpdate: { tieneXML?: boolean; tienePDF?: boolean; tieneCDR?: boolean } = {};
        if (tipoArchivo === "XML") flagUpdate.tieneXML = true;
        if (tipoArchivo === "PDF") flagUpdate.tienePDF = true;
        if (tipoArchivo === "CDR") flagUpdate.tieneCDR = true;
        await prisma.voucher.update({ where: { id: voucher.id }, data: flagUpdate });

        // Upsert VoucherDocument record
        await prisma.voucherDocument.upsert({
          where: { id: `${voucher.id}-${tipoArchivo}` },
          create: {
            id: `${voucher.id}-${tipoArchivo}`,
            voucherId: voucher.id,
            tipo: tipoArchivo,
            filename: result.filename,
            filepath: key,
            filesize: result.content.length,
            mimeType: result.mimeType,
            storageUrl: storage.url(key),
          },
          update: { filepath: key, storageUrl: storage.url(key), uploadedAt: new Date() },
        });

        docsOk++;
        logger.info("[DownloadWorker] Document saved", { voucherId: voucher.id, tipoArchivo });
      } catch (err) {
        docsError++;
        const userMsg = toUserMessage(err);
        logger.error("[DownloadWorker] Document failed", {
          voucherId: voucher.id,
          tipoArchivo,
          error: err instanceof Error ? err.message : String(err),
        });
        // Store error in job metadata (non-blocking)
        prisma.downloadJob.update({
          where: { id: jobId },
          data: { metadata: { lastError: userMsg, lastErrorVoucher: `${voucher.serie}-${voucher.numero}` } },
        }).catch(() => {});
      }
    }

    // Update progress after each voucher
    const total = vouchers.length * tiposToDownload.length;
    const done = docsOk + docsError;
    const progress = Math.min(Math.round((done / total) * 90) + 10, 95);
    await prisma.downloadJob.update({ where: { id: jobId }, data: { progreso: progress, docsOk } });
  }

  // Update lastSyncAt on credentials
  await prisma.sunatCredential.updateMany({
    where: { companyId },
    data: { lastSyncAt: new Date() },
  });

  return { docsOk, docsError };
}

// ── Worker handler ─────────────────────────────────────────────────────────────

async function handleDownloadJob(payload: JobPayload): Promise<void> {
  const { jobId, companyId, tipo, parametros } = payload;

  try {
    await prisma.downloadJob.update({
      where: { id: jobId },
      data: { estado: "PROCESSING", progreso: 10 },
    });

    const { docsOk, docsError } = await processDownload(
      jobId, companyId, tipo, parametros as DownloadParams
    );

    await prisma.downloadJob.update({
      where: { id: jobId },
      data: { estado: "COMPLETED", progreso: 100, docsOk, docsError, completedAt: new Date() },
    });

    logger.job(JOB_TYPES.DOWNLOAD_SUNAT, jobId, "completed", { docsOk, docsError });
  } catch (err) {
    const errorMsg = toUserMessage(err);
    await prisma.downloadJob.update({
      where: { id: jobId },
      data: { estado: "FAILED", errorMsg, progreso: 0 },
    });
    logger.error("[DownloadWorker] Job failed", { jobId, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

jobQueue.register(JOB_TYPES.DOWNLOAD_SUNAT, handleDownloadJob);
export { handleDownloadJob };
