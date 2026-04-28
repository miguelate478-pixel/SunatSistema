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
  errores?: Array<{
    codError: string;
    desError: string;
  }>;
}

export class SunatClient {
  private clientId: string;
  private clientSecret: string;
  private ruc: string;
  private usuario: string;
  private claveSol: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private tokenGt: string | undefined = undefined;
  private axiosInstance: AxiosInstance;

  private get BASE() {
    return SIRE_API_BASE;
  }

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

  private authHeaders(token: string, _gt?: string) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "es-419,es;q=0.9",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Origin": "https://e-factura.sunat.gob.pe",
      "Referer": "https://e-factura.sunat.gob.pe/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
    };
    return headers;
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
        console.warn("[SIRE] 401 recibido — refrescando token y reintentando...");
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
      console.log(`[SIRE] Auth POST ${url}`);
      console.log(`[SIRE] username=${this.ruc}${this.usuario} | clientId=${this.clientId}`);

      const response = await this.axiosInstance.post<TokenResponse>(url, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);
      console.log(`[SIRE] Token OK, expira en ${response.data.expires_in}s`);
      
      try {
        const payload = JSON.parse(Buffer.from(this.accessToken.split(".")[1], "base64").toString());
        let aud = payload.aud;
        if (typeof aud === "string") aud = JSON.parse(aud);
        const audArr = Array.isArray(aud) ? aud : [aud];
        const sireAud = audArr.find((a: any) => a?.api?.includes("api-sire")) ?? audArr[0];
        const recurso = sireAud?.recurso?.[0];
        this.tokenGt = recurso?.gt;
        console.log(`[SIRE] Token sub:`, payload.sub, `| gt:`, this.tokenGt);
      } catch (e) {
        console.log(`[SIRE] Error parseando token:`, e);
      }
      
      return this.accessToken;
    } catch (error: any) {
      if (error?.response) {
        const status = error.response.status;
        const data = error.response.data;
        const body = Buffer.isBuffer(data) ? data.toString("utf8") : JSON.stringify(data);
        console.error(`[SIRE] Auth error HTTP ${status}:`, body);
        throw new Error(`SUNAT auth failed: HTTP ${status} - ${body}`);
      } else if (error?.request) {
        console.error("[SIRE] Auth error de red:", error.message);
        throw new Error(`SUNAT auth failed: sin respuesta del servidor - ${error.message}`);
      } else {
        console.error("[SIRE] Auth error desconocido:", error.message);
        throw new Error(`SUNAT auth failed: ${error.message}`);
      }
    }
  }

  async requestDownloadTicket(tipo: string, periodoTributario: string): Promise<string> {
    validatePeriodo(periodoTributario);
    return this.withAutoRefresh(async (token) => {
      try {
        if (tipo === "propuesta-ventas") {
          const urlVentas = `${this.BASE}/rvie/propuesta/web/propuesta/${periodoTributario}/exportapropuesta`;
          try {
            console.log(`[SIRE] Ventas exportapropuesta GET ${urlVentas}`);
            const r = await this.axiosInstance.get(urlVentas, {
              params: {
                codOrigenEnvio: 2,
                codTipoArchivo: 0,
                mtoTotalDesde: "",
                mtoTotalHasta: "",
                fecDocumentoDesde: "",
                fecDocumentoHasta: "",
                numRucAdquiriente: "",
                numCarSunat: "",
                codTipoCDP: "",
                codTipoInconsistencia: "",
              },
              headers: this.authHeaders(token, this.tokenGt),
            });
            console.log(`[SIRE] Ventas exportapropuesta OK:`, JSON.stringify(r.data));
            const nt = r.data?.numTicket ?? r.data?.data?.numTicket;
            if (nt) return String(nt);
          } catch (e: any) {
            console.log(`[SIRE] Ventas exportapropuesta HTTP ${e?.response?.status}`);
          }

          try {
            console.log(`[SIRE] Ventas arraybuffer GET ${urlVentas}`);
            const r = await this.axiosInstance.get(urlVentas, {
              params: { codOrigenEnvio: 2, codTipoArchivo: 0 },
              headers: this.authHeaders(token, this.tokenGt),
              responseType: "arraybuffer",
            });
            console.log(`[SIRE] Ventas arraybuffer OK, size=${r.data?.byteLength}`);
            const directKey = `DIRECT_${periodoTributario}_${Date.now()}`;
            directDownloadBuffers.set(directKey, Buffer.from(r.data));
            return directKey;
          } catch (e: any) {
            console.log(`[SIRE] Ventas arraybuffer HTTP ${e?.response?.status}`);
          }

          throw new Error(`No se pudo obtener datos de ventas para ${periodoTributario}.`);
        }

        if (tipo === "propuesta-compras" || tipo === "propuesta" || tipo === "comprobantes") {
          const url534 = `${this.BASE}/rce/propuesta/web/propuesta/${periodoTributario}/exportacioncomprobantepropuesta`;
          try {
            console.log(`[SIRE] 5.34 GET ${url534}`);
            const r = await this.axiosInstance.get(url534, {
              params: { codTipoArchivo: 0, codOrigenEnvio: 2 },
              headers: this.authHeaders(token, this.tokenGt),
            });
            console.log(`[SIRE] 5.34 OK:`, JSON.stringify(r.data));
            const nt = r.data?.numTicket ?? r.data?.data?.numTicket;
            if (nt) return String(nt);
          } catch (e: any) {
            console.log(`[SIRE] 5.34 HTTP ${e?.response?.status}`);
          }

          const urlPortal = `${this.BASE}/rvierce/resumen/web/resumencomprobantes/${periodoTributario}/1/0/exporta`;
          try {
            console.log(`[SIRE] Portal exporta GET ${urlPortal}`);
            const r = await this.axiosInstance.get(urlPortal, {
              params: { codLibro: "080000" },
              headers: this.authHeaders(token, this.tokenGt),
              responseType: "arraybuffer",
            });
            console.log(`[SIRE] Portal exporta OK, size=${r.data?.byteLength}`);
            const directKey = `DIRECT_${periodoTributario}_${Date.now()}`;
            directDownloadBuffers.set(directKey, Buffer.from(r.data));
            return directKey;
          } catch (e: any) {
            console.log(`[SIRE] Portal exporta HTTP ${e?.response?.status}`);
          }

          const url553 = `${this.BASE}/rvierce/gestionlibro/web/comprobanteslibros/${periodoTributario}/reportecar`;
          for (const codFase of ["1", "2", "3"]) {
            try {
              console.log(`[SIRE] 5.53 codFase=${codFase} GET ${url553}`);
              const r3 = await this.axiosInstance.get(url553, {
                params: { codOrigenEnvio: "2", codLibro: "080000", codFase },
                headers: this.authHeaders(token, this.tokenGt),
              });
              console.log(`[SIRE] 5.53 OK:`, JSON.stringify(r3.data));
              const nt3 = r3.data?.numTicket ?? r3.data?.data?.numTicket;
              if (nt3) return String(nt3);
            } catch (e: any) {
              console.log(`[SIRE] 5.53 codFase=${codFase} HTTP ${e?.response?.status}`);
            }
          }
          throw new Error(`Todos los endpoints fallaron para periodo ${periodoTributario}`);
        } else if (tipo === "resumen") {
          const urlResumen = `${this.BASE}/rvierce/resumen/web/resumencomprobantes/${periodoTributario}/1/0/exporta`;
          try {
            console.log(`[SIRE] Resumen exporta GET ${urlResumen}`);
            const r = await this.axiosInstance.get(urlResumen, {
              params: { codLibro: "080000" },
              headers: this.authHeaders(token, this.tokenGt),
              responseType: "arraybuffer",
            });
            console.log(`[SIRE] Resumen exporta OK, size=${r.data?.byteLength}`);
            const directKey = `DIRECT_${periodoTributario}_${Date.now()}`;
            directDownloadBuffers.set(directKey, Buffer.from(r.data));
            return directKey;
          } catch (e: any) {
            console.log(`[SIRE] Resumen exporta HTTP ${e?.response?.status}`);
          }

          const url535 = `${this.BASE}/rvierce/resumen/web/resumencomprobantes/${periodoTributario}/exportacionresumen`;
          const r2 = await this.axiosInstance.get(url535, {
            params: { codOrigenEnvio: 2 },
            headers: this.authHeaders(token, this.tokenGt),
          });
          const nt2 = r2.data?.numTicket ?? r2.data?.data?.numTicket;
          if (!nt2) throw new Error(`Sin numTicket resumen: ${JSON.stringify(r2.data)}`);
          return String(nt2);
        } else {
          throw new Error(`Tipo no soportado: ${tipo}`);
        }
      } catch (error: any) {
        if (!error?.response && !error?.request) throw error;
        if (error?.response) {
          const status = error.response.status;
          const data = error.response.data;
          const body = Buffer.isBuffer(data) ? data.toString("utf8") : JSON.stringify(data);
          console.error(`[SIRE] Error HTTP ${status} en requestDownloadTicket:`, body);
          throw new Error(`Failed to request ${tipo} ticket: HTTP ${status} - ${body}`);
        } else {
          console.error("[SIRE] Error de red en requestDownloadTicket:", error.message);
          throw new Error(`Failed to request ${tipo} ticket: sin respuesta - ${error.message}`);
        }
      }
    });
  }

  async checkTicketStatus(numTicket: string, periodoTributario?: string, codLibro = "080000"): Promise<TicketStatusResponse> {
    const periodo = periodoTributario ?? new Date().toISOString().slice(0, 7).replace("-", "");

    return this.withAutoRefresh(async (token) => {
      try {
        const url = `${this.BASE}/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets`;
        const params = {
          perIni: periodo,
          perFin: periodo,
          page: 1,
          perPage: 20,
          numTicket,
          codLibro,
          codOrigenEnvio: "2",
        };

        console.log(`[SIRE] 5.31 GET ${url}`, params);
        const response = await this.axiosInstance.get(url, {
          params,
          headers: this.authHeaders(token, this.tokenGt),
        });

        console.log(`[SIRE] 5.31 respuesta:`, JSON.stringify(response.data));

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

        let nomArchivoReporte = primerArchivo?.nomArchivoReporte ?? item.detalleTicket?.nomArchivoReporte;
        if (!nomArchivoReporte && estado === "Terminado") {
          nomArchivoReporte = `${this.ruc}_RCE_${periodo}_${numTicket}.zip`;
          console.log(`[SIRE] nomArchivoReporte construido: ${nomArchivoReporte}`);
        }

        const errores = item.errores ?? item.detalleTicket?.errores ?? [];

        return {
          numTicket: item.numTicket ?? numTicket,
          estado,
          codEstado,
          codEstadoProceso,
          nomArchivoReporte,
          codProceso: item.codProceso,
          codLibro: item.codLibro ?? "080000",
          perTributario: item.perTributario ?? periodo,
          archivoReporte,
          errores,
        };
      } catch (error: any) {
        if (error?.response) {
          const status = error.response.status;
          const data = error.response.data;
          const body = Buffer.isBuffer(data) ? data.toString("utf8") : JSON.stringify(data);
          console.error(`[SIRE] Error 5.31 HTTP ${status}:`, body);
          throw new Error(`Failed to check ticket status: HTTP ${status} - ${body}`);
        } else if (error?.request) {
          console.error("[SIRE] Error 5.31 de red:", error.message);
          throw new Error(`Failed to check ticket status: sin respuesta - ${error.message}`);
        } else {
          throw error;
        }
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
        const url = `${this.BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte`;
        const params: Record<string, string> = {
          nomArchivoReporte,
          codLibro: extra?.codLibro ?? "080000",
        };
        if (extra?.codTipoArchivoReporte != null) params.codTipoArchivoReporte = extra.codTipoArchivoReporte;
        if (extra?.perTributario) params.perTributario = extra.perTributario;
        if (extra?.codProceso) params.codProceso = extra.codProceso;
        if (extra?.numTicket) params.numTicket = extra.numTicket;

        console.log(`[SIRE] 5.32 GET ${url}`, params);
        const response = await this.axiosInstance.get(url, {
          params,
          headers: this.authHeaders(token, this.tokenGt),
          responseType: "arraybuffer",
        });

        const data = response.data;
        if (Buffer.isBuffer(data)) {
          const str = data.toString("utf8");
          if (/^[A-Za-z0-9+/=]+$/.test(str.trim())) {
            try {
              return Buffer.from(str, "base64");
            } catch {
              return data;
            }
          }
          return data;
        }
        if (typeof data === "object" && data?.archivo) {
          return Buffer.from(data.archivo, "base64");
        }
        if (typeof data === "string") {
          return Buffer.from(data, "base64");
        }
        return Buffer.from(data);
      } catch (error: any) {
        if (error?.response) {
          const status = error.response.status;
          const data = error.response.data;
          const body = Buffer.isBuffer(data) ? data.toString("utf8") : JSON.stringify(data);
          console.error(`[SIRE] Error 5.32 HTTP ${status}:`, body);
          throw new Error(`Failed to download file from SUNAT: HTTP ${status} - ${body}`);
        } else if (error?.request) {
          console.error("[SIRE] Error 5.32 de red:", error.message);
          throw new Error(`Failed to download file from SUNAT: sin respuesta - ${error.message}`);
        } else {
          console.error("[SIRE] Error 5.32 desconocido:", error.message);
          throw new Error(`Failed to download file from SUNAT: ${error.message}`);
        }
      }
    });
  }

  async getPeriodos(codLibro = "080000"): Promise<any[]> {
    return this.withAutoRefresh(async (token) => {
      const url = `${this.BASE}/rvierce/padron/web/omisos/${codLibro}/periodos`;
      console.log(`[SIRE] 5.33 GET ${url}`);
      try {
        const response = await this.axiosInstance.get(url, {
          headers: this.authHeaders(token, this.tokenGt),
        });
        const data = response.data;
        console.log(`[SIRE] 5.33 respuesta:`, JSON.stringify(data));

        if (data?.codRespuesta === "1070") {
          console.log(`[SIRE] 5.33 sin periodos disponibles (1070): ${data.msgRespuesta}`);
          return [];
        }

        const periodos: any[] = data?.listaPeriodos ?? data?.periodos ?? (Array.isArray(data) ? data.flatMap((e: any) => e.lisPeriodos ?? []) : []);
        console.log(`[SIRE] 5.33 total periodos obtenidos: ${periodos.length}`);
        return periodos;
      } catch (error: any) {
        if (error?.response) {
          const status = error.response.status;
          const data = error.response.data;
          const body = Buffer.isBuffer(data) ? data.toString("utf8") : JSON.stringify(data);
          if (status === 422) {
            const parsed = typeof data === "object" ? data : {};
            if (parsed?.codRespuesta === "1070") return [];
            throw new Error(`SUNAT validación (422): ${parsed?.msgRespuesta ?? body}`);
          }
          console.error(`[SIRE] Error 5.33 HTTP ${status}:`, body);
          throw new Error(`Failed to get periodos: HTTP ${status} - ${body}`);
        } else if (error?.request) {
          console.error("[SIRE] Error 5.33 de red:", error.message);
          throw new Error(`Failed to get periodos: sin respuesta - ${error.message}`);
        } else {
          throw error;
        }
      }
    });
  }
}
