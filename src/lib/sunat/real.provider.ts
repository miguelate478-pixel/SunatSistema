/**
 * Real SUNAT Provider
 *
 * Implements OAuth2 + CPE API for downloading comprobantes.
 * Reference: https://cpe.sunat.gob.pe/informacion_general/api_cpe
 *
 * Endpoints:
 *   Token:    POST https://api-seguridad.sunat.gob.pe/v1/clientessol/{clientId}/oauth2/token/
 *   Consulta: GET  https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes
 *   Descarga: GET  https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/{tipo}/{serie}/{numero}/{rucEmisor}
 */

import type { ISunatProvider, SunatDocument, DownloadResult, SunatQueryParams } from "./provider.interface";
import { SunatAuthError, SunatTokenError, SunatDownloadError, SunatNotFoundError, SunatPermissionError } from "./errors";
import { logger } from "@/lib/logger";

interface SunatConfig {
  clientId: string;
  clientSecret: string;
  ruc: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

// SUNAT document type codes
const TIPO_MAP: Record<string, string> = {
  FACTURA: "01",
  BOLETA: "03",
  NOTA_CREDITO: "07",
  NOTA_DEBITO: "08",
  RECIBO: "RC",
};

const TOKEN_URL_BASE = "https://api-seguridad.sunat.gob.pe/v1/clientessol";
const CPE_BASE = "https://api-cpe.sunat.gob.pe/v1/contribuyente/gem";

export class RealSunatProvider implements ISunatProvider {
  private tokenCache: TokenCache | null = null;

  constructor(private readonly config: SunatConfig) {}

  // ── Token management ──────────────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const url = `${TOKEN_URL_BASE}/${this.config.clientId}/oauth2/token/`;
    logger.info("[SUNAT] Requesting OAuth token", { ruc: this.config.ruc });

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "https://api-cpe.sunat.gob.pe",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });
    } catch (err) {
      throw new SunatTokenError(`No se pudo conectar al servidor de autenticación SUNAT: ${String(err)}`);
    }

    if (res.status === 401 || res.status === 403) {
      throw new SunatAuthError("Credenciales SUNAT inválidas (client_id / client_secret)", res.status);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new SunatTokenError(`Error de token SUNAT HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    if (!data.access_token) throw new SunatTokenError("SUNAT no devolvió access_token");

    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    logger.info("[SUNAT] Token obtained", { ruc: this.config.ruc, expiresIn: data.expires_in });
    return this.tokenCache.token;
  }

  // ── Download document ─────────────────────────────────────────────────────────

  async downloadDocument(doc: SunatDocument, tipo: "XML" | "PDF" | "CDR"): Promise<DownloadResult> {
    const token = await this.getToken();
    const tipoCode = TIPO_MAP[doc.tipo] ?? doc.tipo;

    // SUNAT CPE API endpoint for document download
    // GET /comprobantes/{tipoDoc}/{serie}/{numero}/{rucEmisor}/{tipoArchivo}
    const tipoArchivo = tipo === "CDR" ? "cdr" : tipo.toLowerCase();
    const url = `${CPE_BASE}/comprobantes/${tipoCode}/${doc.serie}/${doc.numero}/${doc.rucEmisor}/${tipoArchivo}`;

    logger.info("[SUNAT] Downloading document", { serie: doc.serie, numero: doc.numero, tipo });

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: tipo === "PDF" ? "application/pdf" : "application/xml",
        },
      });
    } catch (err) {
      throw new SunatDownloadError(`Error de red al descargar ${doc.serie}-${doc.numero}: ${String(err)}`, doc.voucherId);
    }

    if (res.status === 404) throw new SunatNotFoundError(doc.serie, doc.numero);
    if (res.status === 401) { this.tokenCache = null; throw new SunatAuthError("Token SUNAT expirado o inválido"); }
    if (res.status === 403) throw new SunatPermissionError(`Sin permisos para descargar ${doc.serie}-${doc.numero}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new SunatDownloadError(`SUNAT HTTP ${res.status} para ${doc.serie}-${doc.numero}: ${body.slice(0, 200)}`, doc.voucherId);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = tipo === "PDF" ? "pdf" : "xml";
    const filename = `${doc.serie}-${doc.numero}.${ext}`;

    logger.info("[SUNAT] Document downloaded", { serie: doc.serie, numero: doc.numero, tipo, bytes: buffer.length });

    return {
      voucherId: doc.voucherId,
      tipo,
      content: buffer,
      filename,
      mimeType: tipo === "PDF" ? "application/pdf" : "application/xml",
      success: true,
    };
  }

  // ── Query documents ───────────────────────────────────────────────────────────

  async queryDocuments(params: SunatQueryParams): Promise<SunatDocument[]> {
    const token = await this.getToken();

    const qs = new URLSearchParams({ ruc: params.ruc });
    if (params.fechaInicio) qs.set("fechaInicio", params.fechaInicio);
    if (params.fechaFin) qs.set("fechaFin", params.fechaFin);
    if (params.serie) qs.set("serie", params.serie);
    if (params.numero) qs.set("numero", params.numero);

    const url = `${CPE_BASE}/comprobantes?${qs}`;
    logger.info("[SUNAT] Querying documents", { ruc: params.ruc });

    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      throw new SunatDownloadError(`Error de red al consultar SUNAT: ${String(err)}`);
    }

    if (res.status === 401) { this.tokenCache = null; throw new SunatAuthError("Token SUNAT expirado"); }
    if (!res.ok) return []; // Return empty on other errors — don't crash

    const data = await res.json() as Array<{
      tipoDoc: string; serie: string; numero: string; rucEmisor: string; fechaEmision: string;
    }>;

    return (data ?? []).map((d) => ({
      voucherId: "",
      serie: d.serie,
      numero: d.numero,
      tipo: d.tipoDoc,
      rucEmisor: d.rucEmisor,
      fechaEmision: d.fechaEmision,
    }));
  }

  // ── Validate document ─────────────────────────────────────────────────────────

  async validateDocument(doc: SunatDocument): Promise<{ valid: boolean; estado: string; observaciones?: string }> {
    const token = await this.getToken();
    const tipoCode = TIPO_MAP[doc.tipo] ?? doc.tipo;
    const url = `${CPE_BASE}/comprobantes/${tipoCode}/${doc.serie}/${doc.numero}/${doc.rucEmisor}/estado`;

    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      throw new SunatDownloadError(`Error al validar ${doc.serie}-${doc.numero}: ${String(err)}`);
    }

    if (!res.ok) return { valid: false, estado: "ERROR", observaciones: `HTTP ${res.status}` };

    const data = await res.json() as { estadoCp?: string; observaciones?: string };
    return {
      valid: data.estadoCp === "0" || data.estadoCp === "ACEPTADO",
      estado: data.estadoCp ?? "DESCONOCIDO",
      observaciones: data.observaciones,
    };
  }

  // ── Lookup contribuyente ─────────────────────────────────────────────────────

  async lookupContribuyente(ruc: string): Promise<string | null> {
    try {
      const token = await this.getToken();
      const res = await fetch(
        `${CPE_BASE}/contribuyentes/${ruc}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return null;
      const data = await res.json() as { razonSocial?: string; nombre?: string };
      return data.razonSocial ?? data.nombre ?? null;
    } catch {
      return null;
    }
  }

  // ── Health check ──────────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.getToken();
      return { ok: true, message: "Conexión SUNAT exitosa" };
    } catch (err) {
      if (err instanceof SunatAuthError) return { ok: false, message: "Credenciales inválidas" };
      if (err instanceof SunatTokenError) return { ok: false, message: "Error al obtener token SUNAT" };
      return { ok: false, message: "No se pudo conectar a SUNAT" };
    }
  }
}
