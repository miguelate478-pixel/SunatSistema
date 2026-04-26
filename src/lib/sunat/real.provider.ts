/**
 * RealSunatProvider — Adaptador de compatibilidad
 *
 * Mantiene la interfaz ISunatProvider existente pero delega
 * a los servicios especializados (auth.service, cpe.service).
 *
 * Arquitectura de capas:
 *   ISunatProvider (interfaz)
 *     └── RealSunatProvider (este archivo — compatibilidad)
 *           ├── auth.service.ts  (tokens OAuth2)
 *           ├── cpe.service.ts   (descarga XML/PDF/CDR)
 *           ├── sire.service.ts  (generación RCE/RVIE)
 *           └── padrones.service.ts (validación RUC)
 */

import type { ISunatProvider, SunatDocument, DownloadResult, SunatQueryParams } from "./provider.interface";
import { CpeService } from "./cpe.service";
import { getSunatToken, invalidateToken } from "./auth.service";
import { SunatAuthError, SunatTokenError } from "./errors";
import { logger } from "@/lib/logger";

const CPE_BASE = "https://api-cpe.sunat.gob.pe/v1/contribuyente/gem";

interface SunatConfig {
  clientId: string;
  clientSecret: string;
  ruc: string;
  usuarioSol: string;
  claveSol: string;
}

export class RealSunatProvider implements ISunatProvider {
  private readonly creds: SunatConfig;

  constructor(config: SunatConfig) {
    this.creds = config;
  }

  private async getToken(): Promise<string> {
    return getSunatToken(this.creds, "cpe");
  }

  async downloadDocument(doc: SunatDocument, tipo: "XML" | "PDF" | "CDR"): Promise<DownloadResult> {
    // Use CpeService directly with inline credentials
    const TIPO_MAP: Record<string, string> = {
      FACTURA: "01", BOLETA: "03", NOTA_CREDITO: "07", NOTA_DEBITO: "08", RECIBO: "RC",
    };
    const tipoCode = TIPO_MAP[doc.tipo] ?? doc.tipo;
    const tipoArchivo = tipo === "CDR" ? "cdr" : tipo.toLowerCase();
    const url = `${CPE_BASE}/comprobantes/${tipoCode}/${doc.serie}/${doc.numero}/${doc.rucEmisor}/${tipoArchivo}`;
    const accept = tipo === "PDF" ? "application/pdf" : "application/xml";

    let token = await this.getToken();
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: accept },
      signal: AbortSignal.timeout(30000),
    });

    if (res.status === 401) {
      invalidateToken(this.creds.ruc, "cpe");
      token = await this.getToken();
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: accept },
        signal: AbortSignal.timeout(30000),
      });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SUNAT CPE HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = tipo === "PDF" ? "pdf" : "xml";
    return {
      voucherId: doc.voucherId,
      tipo,
      content: buffer,
      filename: `${doc.serie}-${doc.numero}.${ext}`,
      mimeType: accept,
      success: true,
    };
  }

  async queryDocuments(_params: SunatQueryParams): Promise<SunatDocument[]> {
    // La API CPE no permite listar comprobantes recibidos.
    // Ver sire.service.ts para el flujo correcto de compras/ventas.
    logger.warn("[SUNAT:CPE] queryDocuments called — CPE API does not support listing received documents");
    return [];
  }

  async validateDocument(doc: SunatDocument): Promise<{ valid: boolean; estado: string; observaciones?: string }> {
    const TIPO_MAP: Record<string, string> = {
      FACTURA: "01", BOLETA: "03", NOTA_CREDITO: "07", NOTA_DEBITO: "08", RECIBO: "RC",
    };
    const tipoCode = TIPO_MAP[doc.tipo] ?? doc.tipo;
    const url = `${CPE_BASE}/comprobantes/${tipoCode}/${doc.serie}/${doc.numero}/${doc.rucEmisor}/estado`;

    try {
      const token = await this.getToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { valid: false, estado: `HTTP_${res.status}` };
      const data = await res.json() as { estadoCp?: string; observaciones?: string };
      return {
        valid: data.estadoCp === "0" || data.estadoCp === "ACEPTADO",
        estado: data.estadoCp ?? "DESCONOCIDO",
        observaciones: data.observaciones,
      };
    } catch {
      return { valid: false, estado: "ERROR" };
    }
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.getToken();
      return { ok: true, message: "Conexión SUNAT exitosa" };
    } catch (err) {
      if (err instanceof SunatAuthError) return { ok: false, message: `Credenciales inválidas: ${err.message}` };
      if (err instanceof SunatTokenError) return { ok: false, message: `Error de token: ${err.message}` };
      return { ok: false, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

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
}
