/**
 * SUNAT Auth Service — Capa de Seguridad
 *
 * Responsabilidad única: obtener y cachear tokens OAuth2 por empresa.
 * Todos los demás servicios SUNAT dependen de esta capa.
 *
 * Flujo OAuth2:
 *   POST https://api-seguridad.sunat.gob.pe/v1/clientessol/{clientId}/oauth2/token/
 *   grant_type=password
 *   username={RUC}{usuarioSOL}
 *   password={claveSOL}
 *   scope=https://api-cpe.sunat.gob.pe  (para CPE)
 *   scope=https://api-sire.sunat.gob.pe (para SIRE — mismo endpoint, scope diferente)
 */

import { SunatAuthError, SunatTokenError } from "./errors";
import { logger } from "@/lib/logger";

export type SunatScope = "cpe" | "sire";

const SCOPE_MAP: Record<SunatScope, string> = {
  cpe:  "https://api-cpe.sunat.gob.pe",
  sire: "https://api-sire.sunat.gob.pe",
};

const TOKEN_URL_BASE = "https://api-seguridad.sunat.gob.pe/v1/clientessol";

interface TokenEntry {
  token: string;
  expiresAt: number;
}

// In-process cache: companyId+scope → token
// In production with multiple instances, this resets per instance (acceptable — tokens are short-lived)
const tokenCache = new Map<string, TokenEntry>();

export interface SunatCredentials {
  clientId: string;
  clientSecret: string;
  ruc: string;
  usuarioSol: string;
  claveSol: string;
}

/**
 * Get a valid OAuth2 token for the given credentials and scope.
 * Caches tokens until 60s before expiry.
 */
export async function getSunatToken(
  creds: SunatCredentials,
  scope: SunatScope = "cpe"
): Promise<string> {
  const cacheKey = `${creds.ruc}:${scope}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const url = `${TOKEN_URL_BASE}/${creds.clientId}/oauth2/token/`;
  logger.info("[SUNAT:Auth] Requesting token", { ruc: creds.ruc, scope });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        scope: SCOPE_MAP[scope],
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        username: `${creds.ruc}${creds.usuarioSol}`,
        password: creds.claveSol,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new SunatTokenError(`No se pudo conectar al servidor de autenticación SUNAT: ${String(err)}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new SunatAuthError("Credenciales SUNAT inválidas (client_id / client_secret / usuario SOL)", res.status);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SunatTokenError(`Error de token SUNAT HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new SunatTokenError("SUNAT no devolvió access_token en la respuesta");
  }

  const expiresIn = data.expires_in ?? 3600;
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  });

  logger.info("[SUNAT:Auth] Token obtained", { ruc: creds.ruc, scope, expiresIn });
  return data.access_token;
}

/** Invalidate cached token (call after 401 responses) */
export function invalidateToken(ruc: string, scope: SunatScope = "cpe"): void {
  tokenCache.delete(`${ruc}:${scope}`);
}

/** Load credentials for a company from DB */
export async function loadCompanyCredentials(companyId: string): Promise<SunatCredentials> {
  const { default: prisma } = await import("@/lib/db/prisma");
  const { decrypt } = await import("./crypto");

  const cred = await prisma.sunatCredential.findUnique({ where: { companyId } });
  if (!cred || !cred.isActive) {
    throw new Error("No hay credenciales SUNAT configuradas para esta empresa. Ve a /configuracion.");
  }

  let clientSecret: string;
  let claveSol: string;
  try {
    // For now, using plain text (in production should be encrypted)
    clientSecret = cred.clientSecret;
    claveSol = cred.claveSol;
  } catch {
    throw new Error("No se pueden leer las credenciales. Vuelve a guardarlas en /configuracion.");
  }

  if (!clientSecret?.trim()) throw new Error("client_secret vacío. Vuelve a guardar las credenciales.");
  if (!claveSol?.trim()) throw new Error("Clave SOL vacía. Vuelve a guardar las credenciales.");

  return {
    clientId: cred.clientId,
    clientSecret,
    ruc: cred.ruc,
    usuarioSol: cred.usuario,
    claveSol,
  };
}
