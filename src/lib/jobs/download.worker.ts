/**
 * SUNAT Download Worker
 * PENDING → PROCESSING → COMPLETED | FAILED
 *
 * Descarga XML/PDF/CDR de comprobantes registrados en DB.
 * Soporta:
 *   - Descarga por rango de fechas
 *   - Descarga por lista de voucherIds específicos
 *   - skipXML: omite XML si ya fue importado manualmente
 *   - Trazabilidad completa por job
 */

import prisma from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { jobQueue, JOB_TYPES, type JobPayload } from "./index";
import { getSunatProviderForCompany, toUserMessage } from "@/lib/sunat";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

interface DownloadParams {
  serie?: string;
  numero?: string;
  fechaInicio?: string;
  fechaFin?: string;
  voucherIds?: string[];
  skipXML?: boolean;
}

async function processDownload(
  jobId: string,
  companyId: string,
  tipo: string,
  params: DownloadParams
): Promise<{ docsOk: number; docsError: number }> {
  const provider = await getSunatProviderForCompany(companyId);

  // Build voucher query with explicit Prisma type
  const voucherWhere: Prisma.VoucherWhereInput = {
    companyId,
    deletedAt: null,
  };

  if (params.voucherIds && params.voucherIds.length > 0) {
    voucherWhere.id = { in: params.voucherIds };
  } else {
    if (params.serie) voucherWhere.serie = params.serie;
    if (params.numero) voucherWhere.numero = params.numero;
    if (params.fechaInicio && params.fechaFin) {
      voucherWhere.fechaEmision = {
        gte: new Date(params.fechaInicio),
        lte: new Date(params.fechaFin),
      };
    }
  }

  const vouchers = await prisma.voucher.findMany({
    where: voucherWhere,
    select: {
      id: true, serie: true, numero: true, tipo: true,
      rucEmisor: true, fechaEmision: true, companyId: true,
      tieneXML: true, tienePDF: true, tieneCDR: true,
    },
  });

  logger.info("[DownloadWorker] Processing vouchers", { jobId, companyId, tipo, count: vouchers.length });

  // Update total count
  await prisma.downloadJob.update({
    where: { id: jobId },
    data: { totalDocs: vouchers.length },
  });

  let docsOk = 0;
  let docsError = 0;

  // Determine which file types to download
  let tiposToDownload: Array<"XML" | "PDF" | "CDR"> =
    tipo === "MASIVO" ? ["XML", "PDF", "CDR"] : [tipo as "XML" | "PDF" | "CDR"];

  // Remove XML if skipXML is set (already imported manually)
  if (params.skipXML) {
    tiposToDownload = tiposToDownload.filter((t) => t !== "XML");
  }

  for (const voucher of vouchers) {
    // Skip already-downloaded file types
    const tiposNeeded = tiposToDownload.filter((t) => {
      if (t === "XML" && voucher.tieneXML) return false;
      if (t === "PDF" && voucher.tienePDF) return false;
      if (t === "CDR" && voucher.tieneCDR) return false;
      return true;
    });

    if (tiposNeeded.length === 0) {
      docsOk++;
      continue;
    }

    for (const tipoArchivo of tiposNeeded) {
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
        const flagUpdate: Record<string, boolean> = {};
        if (tipoArchivo === "XML") flagUpdate.tieneXML = true;
        if (tipoArchivo === "PDF") flagUpdate.tienePDF = true;
        if (tipoArchivo === "CDR") flagUpdate.tieneCDR = true;
        await prisma.voucher.update({ where: { id: voucher.id }, data: flagUpdate });

        // Upsert VoucherDocument
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
        prisma.downloadJob.update({
          where: { id: jobId },
          data: { metadata: { lastError: userMsg, lastErrorVoucher: `${voucher.serie}-${voucher.numero}` } },
        }).catch(() => {});
      }
    }

    // Update progress
    const total = Math.max(vouchers.length, 1);
    const done = docsOk + docsError;
    const progress = Math.min(Math.round((done / total) * 90) + 10, 95);
    await prisma.downloadJob.update({ where: { id: jobId }, data: { progreso: progress, docsOk } });
  }

  // Update lastSyncAt
  await prisma.sunatCredential.updateMany({
    where: { companyId },
    data: { lastSyncAt: new Date() },
  });

  return { docsOk, docsError };
}

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
