/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance } from "axios";

const SUNAT_SECURITY_BASE = "https://api-seguridad.sunat.gob.pe/v1/clientessol";
const SUNAT_SCOPE = "https://api-sire.sunat.gob.pe";
const SIRE_API_BASE = "https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros";

export type TipoDescarga = "propuesta-compras" | "propuesta-ventas" | "resumen" | "comprobantes";

// Store global para buffers de descarga directa
const directDownloadBuffers = new Map<string, Buffer>();

function validateRuc(ruc: string): void {
  if (!/^\d{11}$/.test(ruc)) {
    throw new Error(`RUC inválido: "${ruc}". Debe tener exactamente 11 dígitos.`);
  }
}

function validatePeriodo(periodo: string): void {
  if (!/^\d{6}$/.test(periodo)) {
    throw new Error(`Periodo inválido: "${periodo}". Formato requerido: YYYYMM (ej: 202310).`);
  }
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface TicketStatusResponse {
  numTicket: string;
  estado: string;
  codEstado?: string;
  codEstadoProceso?: number;
  nomArchivoReporte?: string;
  codProceso?: string;
  codLibro?: string;
  perTributario?: string;
  archivoReporte?: Array<{
    nomArchivoReporte: string;
    codTipoAchivoReporte: string | null;
  }>;
  errores?: Array<{ codError: string; desError: string }>;
}

export class SunatClient {
  private clientId: string;
  private clientSecret: string;
  private ruc: string;
  private usuario: string;
  private claveSol: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private axiosInstance: AxiosInstance;

  constructor(
    clientId: string,
    clientSecret: string,
    ruc: string,
    usuario: string,
    claveSol: string
  ) {
    validateRuc(ruc);
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.ruc = ruc;
    this.usuario = usuario;
    this.claveSol = claveSol;
    this.axiosInstance = axios.create();
  }

  private authHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "es-419,es;q=0.9",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Origin": "https://e-factura.sunat.gob.pe",
      "Referer": "https://e-factura.sunat.gob.pe/",
    };
  }

  private async ensureValidToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }
    return this.getOAuth2Token();
  }

  private async withAutoRefresh<T>(fn: (token: string) => Promise<T>): Promise<T> {
    const token = await this.ensureValidToken();
    try {
      return await fn(token);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 401) {
        this.accessToken = null;
        this.tokenExpiry = null;
        const freshToken = await this.getOAuth2Token();
        return fn(freshToken);
      }
      throw error;
    }
  }

  async getOAuth2Token(): Promise<string> {
    try {
      const params = new URLSearchParams();
      params.append("grant_type", "password");
      params.append("scope", SUNAT_SCOPE);
      params.append("client_id", this.clientId);
      params.append("client_secret", this.clientSecret);
      params.append("username", `${this.ruc}${this.usuario}`);
      params.append("password", this.claveSol);

      const url = `${SUNAT_SECURITY_BASE}/${this.clientId}/oauth2/token/`;
      console.log(`[SIRE] Auth POST ${url} | user=${this.ruc}${this.usuario}`);

      const response = await this.axiosInstance.post<TokenResponse>(url, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);
      console.log(`[SIRE] Token OK, expira en ${response.data.expires_in}s`);
      return this.accessToken;
    } catch (error: any) {
      const status = error?.response?.status;
      const body = error?.response?.data
        ? (Buffer.isBuffer(error.response.data) ? error.response.data.toString("utf8") : JSON.stringify(error.response.data))
        : error.message;
      throw new Error(`SUNAT auth failed: HTTP ${status ?? "sin respuesta"} - ${String(body).slice(0, 300)}`);
    }
  }

  /**
   * Solicita descarga de comprobantes SIRE.
   *
   * Flujo real de SIRE:
   * - Compras: solicita ticket con endpoint exportacioncomprobantepropuesta (codProceso=10)
   *   → el archivo resultante es la "propuesta" (puede estar vacía si no hay compras)
   * - Ventas: solicita ticket con endpoint exportapropuesta (codProceso=10)
   *   → igual, propuesta de ventas
   *
   * Los archivos con datos reales (codProceso=5, "Generación de Registros") se descargan
   * directamente por nombre sin necesidad de ticket.
   */
  async requestDownloadTicket(tipo: string, periodoTributario: string): Promise<string> {
    validatePeriodo(periodoTributario);
    return this.withAutoRefresh(async (token) => {
      const headers = this.authHeaders(token);

      // ── VENTAS ──────────────────────────────────────────────────────────────
      if (tipo === "propuesta-ventas") {
        // Primero intentar descarga directa del archivo de registros reales
        const directKey = await this.tryDirectDownloadVentas(token, periodoTributario);
        if (directKey) return directKey;

        // Fallback: solicitar ticket de propuesta
        const urlVentas = `${SIRE_API_BASE}/rvie/propuesta/web/propuesta/${periodoTributario}/exportapropuesta`;
        try {
          const r = await this.axiosInstance.get(urlVentas, {
            params: { codOrigenEnvio: 2, codTipoArchivo: 0 },
            headers,
            timeout: 30000,
          });
          const nt = r.data?.numTicket ?? r.data?.data?.numTicket;
          if (nt) { console.log(`[SIRE] Ventas ticket: ${nt}`); return String(nt); }
        } catch (e: any) {
          console.log(`[SIRE] Ventas ticket HTTP ${e?.response?.status}`);
        }

        // Último recurso: arraybuffer directo
        try {
          const r = await this.axiosInstance.get(
            `${SIRE_API_BASE}/rvie/propuesta/web/propuesta/${periodoTributario}/exportapropuesta`,
            { params: { codOrigenEnvio: 2, codTipoArchivo: 0 }, headers, responseType: "arraybuffer", timeout: 30000 }
          );
          const key = `DIRECT_${periodoTributario}_${Date.now()}`;
          directDownloadBuffers.set(key, Buffer.from(r.data));
          return key;
        } catch (e: any) {
          console.log(`[SIRE] Ventas arraybuffer HTTP ${e?.response?.status}`);
        }

        throw new Error(`No se pudo obtener datos de ventas para ${periodoTributario}`);
      }

      // ── COMPRAS ─────────────────────────────────────────────────────────────
      if (tipo === "propuesta-compras" || tipo === "propuesta" || tipo === "comprobantes") {
        // Primero intentar descarga directa del archivo de registros reales
        const directKey = await this.tryDirectDownloadCompras(token, periodoTributario);
        if (directKey) return directKey;

        // Fallback: solicitar ticket de propuesta
        const url534 = `${SIRE_API_BASE}/rce/propuesta/web/propuesta/${periodoTributario}/exportacioncomprobantepropuesta`;
        try {
          const r = await this.axiosInstance.get(url534, {
            params: { codTipoArchivo: 0, codOrigenEnvio: 2 },
            headers,
            timeout: 30000,
          });
          const nt = r.data?.numTicket ?? r.data?.data?.numTicket;
          if (nt) { console.log(`[SIRE] Compras ticket: ${nt}`); return String(nt); }
        } catch (e: any) {
          console.log(`[SIRE] Compras ticket HTTP ${e?.response?.status}`);
        }

        throw new Error(`No se pudo obtener datos de compras para ${periodoTributario}`);
      }

      throw new Error(`Tipo no soportado: ${tipo}`);
    });
  }

  /**
   * Intenta descargar directamente el archivo de registros reales de VENTAS.
   * El nombre del archivo sigue el patrón: LE{RUC}{PERIODO}00140400011112.zip
   * Este es el archivo "inconsistencias" que contiene los comprobantes reales.
   */
  private async tryDirectDownloadVentas(token: string, periodo: string): Promise<string | null> {
    const ruc = this.ruc;
    const nomArchivo = `LE${ruc}${periodo}00140400011112.zip`;
    console.log(`[SIRE] Intentando descarga directa ventas: ${nomArchivo}`);

    try {
      const r = await this.axiosInstance.get(
        `${SIRE_API_BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte`,
        {
          params: { nomArchivoReporte: nomArchivo, codLibro: "140000" },
          headers: this.authHeaders(token),
          responseType: "arraybuffer",
          timeout: 30000,
        }
      );
      const buf = Buffer.from(r.data);
      if (buf.length > 100) {
        const key = `DIRECT_VENTAS_${periodo}_${Date.now()}`;
        directDownloadBuffers.set(key, buf);
        console.log(`[SIRE] Descarga directa ventas OK: ${buf.length} bytes`);
        return key;
      }
    } catch (e: any) {
      console.log(`[SIRE] Descarga directa ventas HTTP ${e?.response?.status} (normal si no hay datos)`);
    }
    return null;
  }

  /**
   * Intenta descargar directamente el archivo de registros reales de COMPRAS.
   * El nombre del archivo sigue el patrón: LE{RUC}{PERIODO}00080400011112.zip
   */
  private async tryDirectDownloadCompras(token: string, periodo: string): Promise<string | null> {
    const ruc = this.ruc;
    const nomArchivo = `LE${ruc}${periodo}00080400011112.zip`;
    console.log(`[SIRE] Intentando descarga directa compras: ${nomArchivo}`);

    try {
      const r = await this.axiosInstance.get(
        `${SIRE_API_BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte`,
        {
          params: { nomArchivoReporte: nomArchivo, codLibro: "080000" },
          headers: this.authHeaders(token),
          responseType: "arraybuffer",
          timeout: 30000,
        }
      );
      const buf = Buffer.from(r.data);
      if (buf.length > 100) {
        const key = `DIRECT_COMPRAS_${periodo}_${Date.now()}`;
        directDownloadBuffers.set(key, buf);
        console.log(`[SIRE] Descarga directa compras OK: ${buf.length} bytes`);
        return key;
      }
    } catch (e: any) {
      console.log(`[SIRE] Descarga directa compras HTTP ${e?.response?.status} (normal si no hay datos)`);
    }
    return null;
  }

  async checkTicketStatus(numTicket: string, periodoTributario?: string, codLibro = "080000"): Promise<TicketStatusResponse> {
    const periodo = periodoTributario ?? new Date().toISOString().slice(0, 7).replace("-", "");

    return this.withAutoRefresh(async (token) => {
      try {
        const url = `${SIRE_API_BASE}/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`;
        const params = { perIni: periodo, perFin: periodo, page: 1, perPage: 20, numTicket, codLibro, codOrigenEnvio: "2" };

        console.log(`[SIRE] checkTicketStatus ${numTicket} periodo=${periodo}`);
        const response = await this.axiosInstance.get(url, {
          params,
          headers: this.authHeaders(token),
          timeout: 15000,
        });

        console.log(`[SIRE] ticket status:`, JSON.stringify(response.data).slice(0, 500));

        const registros: any[] = response.data?.registros ?? response.data ?? [];
        const item = Array.isArray(registros) ? registros[0] : registros;

        if (!item) return { numTicket, estado: "Pendiente" };

        const codEstado = item.codEstado ?? item.codEstadoProceso?.toString().padStart(2, "0");
        const codEstadoProceso = item.codEstadoProceso ?? item.codEstado;

        let estado = "Procesando";
        if (codEstado === "06" || codEstadoProceso === 3 || codEstadoProceso === 4) estado = "Terminado";
        if (codEstado === "07" || codEstadoProceso === 5) estado = "Error";
        if (codEstado === "05") estado = "Error";

        const archivoReporte: any[] = item.archivoReporte ?? item.detalleTicket?.archivoReporte ?? [];
        const primerArchivo = archivoReporte[0];
        const nomArchivoReporte = primerArchivo?.nomArchivoReporte ?? item.detalleTicket?.nomArchivoReporte;

        return {
          numTicket: item.numTicket ?? numTicket,
          estado,
          codEstado,
          codEstadoProceso,
          nomArchivoReporte,
          codProceso: item.codProceso,
          codLibro: item.codLibro ?? codLibro,
          perTributario: item.perTributario ?? periodo,
          archivoReporte,
          errores: item.errores ?? item.detalleTicket?.errores ?? [],
        };
      } catch (error: any) {
        const status = error?.response?.status;
        const body = error?.response?.data
          ? (Buffer.isBuffer(error.response.data) ? error.response.data.toString("utf8") : JSON.stringify(error.response.data))
          : error.message;
        throw new Error(`Failed to check ticket status: HTTP ${status ?? "sin respuesta"} - ${String(body).slice(0, 200)}`);
      }
    });
  }

  async downloadFile(
    nomArchivoReporte: string,
    extra?: {
      codTipoArchivoReporte?: string | null;
      perTributario?: string;
      codProceso?: string;
      numTicket?: string;
      codLibro?: string;
    }
  ): Promise<Buffer> {
    if (nomArchivoReporte.startsWith("DIRECT_")) {
      const buf = directDownloadBuffers.get(nomArchivoReporte);
      if (buf) {
        directDownloadBuffers.delete(nomArchivoReporte);
        return buf;
      }
      throw new Error(`Buffer de descarga directa no encontrado para ${nomArchivoReporte}`);
    }

    return this.withAutoRefresh(async (token) => {
      try {
        const url = `${SIRE_API_BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte`;
        const params: Record<string, string> = {
          nomArchivoReporte,
          codLibro: extra?.codLibro ?? "080000",
        };
        if (extra?.codTipoArchivoReporte != null) params.codTipoArchivoReporte = extra.codTipoArchivoReporte;
        if (extra?.perTributario) params.perTributario = extra.perTributario;
        if (extra?.codProceso) params.codProceso = extra.codProceso;
        if (extra?.numTicket) params.numTicket = extra.numTicket;

        console.log(`[SIRE] downloadFile ${nomArchivoReporte}`);
        const response = await this.axiosInstance.get(url, {
          params,
          headers: this.authHeaders(token),
          responseType: "arraybuffer",
          timeout: 60000,
        });

        const data = response.data;
        if (Buffer.isBuffer(data)) return data;
        if (typeof data === "object" && data?.archivo) return Buffer.from(data.archivo, "base64");
        if (typeof data === "string") return Buffer.from(data, "base64");
        return Buffer.from(data);
      } catch (error: any) {
        const status = error?.response?.status;
        const body = error?.response?.data
          ? (Buffer.isBuffer(error.response.data) ? error.response.data.toString("utf8") : JSON.stringify(error.response.data))
          : error.message;
        throw new Error(`Failed to download file: HTTP ${status ?? "sin respuesta"} - ${String(body).slice(0, 200)}`);
      }
    });
  }

  async getPeriodos(codLibro = "080000"): Promise<any[]> {
    return this.withAutoRefresh(async (token) => {
      const url = `${SIRE_API_BASE}/rvierce/padron/web/omisos/${codLibro}/periodos`;
      try {
        const response = await this.axiosInstance.get(url, {
          headers: this.authHeaders(token),
          timeout: 15000,
        });
        const data = response.data;
        if (data?.codRespuesta === "1070") return [];
        return data?.listaPeriodos ?? data?.periodos ?? (Array.isArray(data) ? data.flatMap((e: any) => e.lisPeriodos ?? []) : []);
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 422) {
          const parsed = error.response.data;
          if (parsed?.codRespuesta === "1070") return [];
        }
        throw new Error(`Failed to get periodos: HTTP ${status ?? "sin respuesta"}`);
      }
    });
  }
}
