/**
 * SUNAT Integration — Punto de entrada
 *
 * Arquitectura de capas:
 *
 *   auth.service.ts      → OAuth2 tokens, cache, refresh
 *   cpe.service.ts       → Descarga XML/PDF/CDR (emisor)
 *   sire.service.ts      → Generación RCE/RVIE (formato PLE)
 *   padrones.service.ts  → Validación RUC, razón social
 *   real.provider.ts     → Adaptador ISunatProvider (compatibilidad)
 *   mock.provider.ts     → Simulación para desarrollo
 */

import type { ISunatProvider } from "./provider.interface";
import { MockSunatProvider } from "./mock.provider";
import { RealSunatProvider } from "./real.provider";
import { loadCompanyCredentials } from "./auth.service";
import { logger } from "@/lib/logger";

export type { ISunatProvider };
export { MockSunatProvider, RealSunatProvider };
export * from "./errors";
export * from "./provider.interface";

// Re-export services for direct use
export { getSunatToken, loadCompanyCredentials, invalidateToken } from "./auth.service";
export { CpeService } from "./cpe.service";
export { generarRCE, generarRVIE } from "./sire.service";
export { lookupRuc, validarConsistenciaRuc } from "./padrones.service";

/**
 * Get ISunatProvider for a company.
 * Uses SUNAT_PROVIDER env var to switch between real and mock.
 */
export async function getSunatProviderForCompany(companyId: string): Promise<ISunatProvider> {
  if ((process.env.SUNAT_PROVIDER ?? "mock") !== "real") {
    return new MockSunatProvider();
  }

  try {
    const creds = await loadCompanyCredentials(companyId);
    logger.info("[SUNAT] Using real provider for company", { companyId, ruc: creds.ruc });
    return new RealSunatProvider(creds);
  } catch (err) {
    logger.warn("[SUNAT] Could not load credentials, re-throwing", { companyId, error: String(err) });
    throw err;
  }
}

/** Legacy: global provider from env vars */
export function getSunatProvider(): ISunatProvider {
  if ((process.env.SUNAT_PROVIDER ?? "mock") !== "real") return new MockSunatProvider();
  const clientId = process.env.SUNAT_CLIENT_ID;
  const clientSecret = process.env.SUNAT_CLIENT_SECRET;
  const ruc = process.env.SUNAT_RUC;
  const usuarioSol = process.env.SUNAT_USUARIO_SOL ?? "";
  const claveSol = process.env.SUNAT_CLAVE_SOL ?? "";
  if (!clientId || !clientSecret || !ruc) return new MockSunatProvider();
  return new RealSunatProvider({ clientId, clientSecret, ruc, usuarioSol, claveSol });
}
