/**
 * SUNAT Document Discovery Service
 *
 * Separates DISCOVERY (finding new vouchers in SUNAT) from
 * DOWNLOAD (fetching XML/PDF/CDR files).
 *
 * Flow:
 *   1. queryDocuments()  → get list from SUNAT API
 *   2. filter duplicates → compare against DB (serie+numero+companyId)
 *   3. upsert new        → create Voucher records with estado=PENDIENTE
 *   4. return stats      → { discovered, alreadyExisted, created }
 */

import prisma from "@/lib/db/prisma";
import { getSunatProviderForCompany } from "@/lib/sunat";
import { logger } from "@/lib/logger";
import type { SunatDocument } from "./provider.interface";

export interface DiscoveryParams {
  companyId: string;
  ruc: string;
  fechaInicio: string; // "YYYY-MM-DD"
  fechaFin: string;    // "YYYY-MM-DD"
  triggeredBy?: string; // userId or "cron"
}

export interface DiscoveryResult {
  discovered: number;   // total returned by SUNAT
  alreadyExisted: number;
  created: number;      // new vouchers inserted
  errors: number;
  newVoucherIds: string[];
}

// SUNAT tipoDoc codes → our internal tipo
const TIPO_DOC_MAP: Record<string, string> = {
  "01": "FACTURA",
  "03": "BOLETA",
  "07": "NOTA_CREDITO",
  "08": "NOTA_DEBITO",
  "RC": "RECIBO",
};

function normalizeTipo(raw: string): string {
  return TIPO_DOC_MAP[raw] ?? raw;
}

/**
 * Discover new vouchers from SUNAT for a company/period.
 * Does NOT download files — only creates Voucher records.
 */
export async function discoverDocuments(params: DiscoveryParams): Promise<DiscoveryResult> {
  const { companyId, ruc, fechaInicio, fechaFin, triggeredBy } = params;

  logger.info("[Discovery] Starting document discovery", { companyId, ruc, fechaInicio, fechaFin });

  const provider = await getSunatProviderForCompany(companyId);

  let sunatDocs: SunatDocument[] = [];
  try {
    sunatDocs = await provider.queryDocuments({ ruc, fechaInicio, fechaFin });
  } catch (err) {
    logger.error("[Discovery] queryDocuments failed", { companyId, error: String(err) });
    throw err;
  }

  logger.info("[Discovery] SUNAT returned documents", { companyId, count: sunatDocs.length });

  if (sunatDocs.length === 0) {
    return { discovered: 0, alreadyExisted: 0, created: 0, errors: 0, newVoucherIds: [] };
  }

  // Build lookup of existing vouchers for this company in the period
  const existingVouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      deletedAt: null,
      fechaEmision: {
        gte: new Date(fechaInicio),
        lte: new Date(fechaFin + "T23:59:59Z"),
      },
    },
    select: { id: true, serie: true, numero: true },
  });

  const existingKeys = new Set(existingVouchers.map((v) => `${v.serie}|${v.numero}`));

  // Get company info for createdById (use system user or first admin)
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { createdById: true, ruc: true, razonSocial: true },
  });
  if (!company) throw new Error(`Empresa no encontrada: ${companyId}`);

  const newVoucherIds: string[] = [];
  let alreadyExisted = 0;
  let created = 0;
  let errors = 0;

  for (const doc of sunatDocs) {
    const key = `${doc.serie}|${doc.numero}`;

    if (existingKeys.has(key)) {
      alreadyExisted++;
      continue;
    }

    try {
      const tipo = normalizeTipo(doc.tipo);
      const fechaEmision = doc.fechaEmision
        ? new Date(doc.fechaEmision)
        : new Date();

      // Determine if this is a purchase (compra) or sale (venta)
      // If rucEmisor == company.ruc → venta; else → compra
      const isVenta = doc.rucEmisor === company.ruc;

      const voucher = await prisma.voucher.create({
        data: {
          companyId,
          tipo,
          serie: doc.serie,
          numero: doc.numero,
          fechaEmision,
          rucEmisor: doc.rucEmisor,
          razonSocialEmisor: isVenta ? company.razonSocial : (doc.razonSocialEmisor ?? doc.rucEmisor),
          rucReceptor: isVenta ? (doc.rucReceptor ?? ruc) : company.ruc,
          razonSocialReceptor: isVenta ? (doc.razonSocialReceptor ?? ruc) : company.razonSocial,
          moneda: "PEN",
          subtotal: 0,
          igv: 0,
          total: 0,
          estado: "PENDIENTE",
          tieneXML: false,
          tienePDF: false,
          tieneCDR: false,
          createdById: company.createdById,
          metadata: {
            discoveredAt: new Date().toISOString(),
            triggeredBy: triggeredBy ?? "system",
            sunatTipoDoc: doc.tipo,
          },
        },
        select: { id: true },
      });

      newVoucherIds.push(voucher.id);
      existingKeys.add(key); // prevent duplicates within same batch
      created++;

      logger.info("[Discovery] New voucher created", {
        companyId,
        serie: doc.serie,
        numero: doc.numero,
        tipo,
      });
    } catch (err) {
      errors++;
      logger.error("[Discovery] Failed to create voucher", {
        companyId,
        serie: doc.serie,
        numero: doc.numero,
        error: String(err),
      });
    }
  }

  logger.info("[Discovery] Discovery complete", {
    companyId,
    discovered: sunatDocs.length,
    alreadyExisted,
    created,
    errors,
  });

  return {
    discovered: sunatDocs.length,
    alreadyExisted,
    created,
    errors,
    newVoucherIds,
  };
}
