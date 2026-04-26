/**
 * SUNAT CPE Service — Capa Documental
 *
 * Responsabilidad: descargar y validar archivos XML/PDF/CDR
 * de comprobantes electrónicos específicos (por serie+número).
 *
 * IMPORTANTE — Límites reales de la API CPE:
 *   ✅ Descargar XML de un comprobante específico (emisor)
 *   ✅ Descargar PDF de un comprobante específico (emisor)
 *   ✅ Descargar CDR de un comprobante específico (emisor)
 *   ✅ Consultar estado de un comprobante específico
 *   ❌ Listar todos los comprobantes recibidos de un período
 *      → La API CPE es para EMISORES, no para receptores/compradores
 *      → Para compras recibidas, el flujo es SIRE/RCE (ver sire.service.ts)
 *
 * Endpoints:
 *   Base: https://api-cpe.sunat.gob.pe/v1/contribuyente/gem
 *   Descarga: GET /comprobantes/{tipoDoc}/{serie}/{numero}/{rucEmisor}/{tipoArchivo}
 *   Estado:   GET /comprobantes/{tipoDoc}/{serie}/{numero}/{rucEmisor}/estado
 */

import { getSunatToken, loadCompanyCredentials, invalidateToken } from "./auth.service";
import { SunatAuthError, SunatDownloadError, SunatNotFoundError, SunatPermissionError } from "./errors";
import { logger } from "@/lib/logger";

const CPE_BASE = "https://api-cpe.sunat.gob.pe/v1/contribuyente/gem";

const TIPO_DOC_MAP: Record<string, string> = {
  FACTURA:      "01",
  BOLETA:       "03",
  NOTA_CREDITO: "07",
  NOTA_DEBITO:  "08",
  RECIBO:       "RC",
};

export interface CpeDownloadRequest {
  voucherId: string;
  serie: string;
  numero: string;
  tipo: string;       // FACTURA, BOLETA, etc.
  rucEmisor: string;
  fechaEmision: string;
}

export interface CpeDownloadResult {
  voucherId: string;
  tipo: "XML" | "PDF" | "CDR";
  content: Buffer;
  filename: string;
  mimeType: string;
}

export interface CpeValidationResult {
  valid: boolean;
  estadoCp: string;
  observaciones?: string;
}

export class CpeService {
  constructor(private readonly companyId: string) {}

  private async fetch(url: string, accept: string): Promise<Response> {
    const creds = await loadCompanyCredentials(this.companyId);
    let token = await getSunatToken(creds, "cpe");

    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: accept },
      signal: AbortSignal.timeout(30000),
    });

    // Retry once on 401 (token may have expired mid-request)
    if (res.status === 401) {
      invalidateToken(creds.ruc, "cpe");
      token = await getSunatToken(creds, "cpe");
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: accept },
        signal: AbortSignal.timeout(30000),
      });
    }

    return res;
  }

  async downloadDocument(doc: CpeDownloadRequest, tipo: "XML" | "PDF" | "CDR"): Promise<CpeDownloadResult> {
    const tipoCode = TIPO_DOC_MAP[doc.tipo] ?? doc.tipo;
    const tipoArchivo = tipo === "CDR" ? "cdr" : tipo.toLowerCase();
    const url = `${CPE_BASE}/comprobantes/${tipoCode}/${doc.serie}/${doc.numero}/${doc.rucEmisor}/${tipoArchivo}`;
    const accept = tipo === "PDF" ? "application/pdf" : "application/xml";

    logger.info("[SUNAT:CPE] Downloading document", { serie: doc.serie, numero: doc.numero, tipo });

    let res: Response;
    try {
      res = await this.fetch(url, accept);
    } catch (err) {
      throw new SunatDownloadError(`Error de red al descargar ${doc.serie}-${doc.numero}: ${String(err)}`, doc.voucherId);
    }

    if (res.status === 404) throw new SunatNotFoundError(doc.serie, doc.numero);
    if (res.status === 401) throw new SunatAuthError("Token SUNAT expirado o inválido");
    if (res.status === 403) throw new SunatPermissionError(`Sin permisos para descargar ${doc.serie}-${doc.numero}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new SunatDownloadError(`SUNAT CPE HTTP ${res.status} para ${doc.serie}-${doc.numero}: ${body.slice(0, 200)}`, doc.voucherId);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = tipo === "PDF" ? "pdf" : "xml";
    const filename = `${doc.rucEmisor}-${tipoCode}-${doc.serie}-${doc.numero}.${ext}`;

    logger.info("[SUNAT:CPE] Document downloaded", { serie: doc.serie, numero: doc.numero, tipo, bytes: buffer.length });

    return { voucherId: doc.voucherId, tipo, content: buffer, filename, mimeType: accept };
  }

  async validateDocument(doc: CpeDownloadRequest): Promise<CpeValidationResult> {
    const tipoCode = TIPO_DOC_MAP[doc.tipo] ?? doc.tipo;
    const url = `${CPE_BASE}/comprobantes/${tipoCode}/${doc.serie}/${doc.numero}/${doc.rucEmisor}/estado`;

    let res: Response;
    try {
      res = await this.fetch(url, "application/json");
    } catch (err) {
      throw new SunatDownloadError(`Error al validar ${doc.serie}-${doc.numero}: ${String(err)}`);
    }

    if (!res.ok) return { valid: false, estadoCp: `HTTP_${res.status}` };

    const data = await res.json() as { estadoCp?: string; observaciones?: string };
    return {
      valid: data.estadoCp === "0" || data.estadoCp === "ACEPTADO",
      estadoCp: data.estadoCp ?? "DESCONOCIDO",
      observaciones: data.observaciones,
    };
  }

  async lookupContribuyente(ruc: string): Promise<string | null> {
    try {
      const res = await this.fetch(`${CPE_BASE}/contribuyentes/${ruc}`, "application/json");
      if (!res.ok) return null;
      const data = await res.json() as { razonSocial?: string; nombre?: string };
      return data.razonSocial ?? data.nombre ?? null;
    } catch {
      return null;
    }
  }
}
