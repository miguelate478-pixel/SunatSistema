/**
 * SUNAT provider factory
 *
 * - SUNAT_PROVIDER=mock  → MockSunatProvider (default, demo)
 * - SUNAT_PROVIDER=real  → RealSunatProvider with credentials from DB
 *
 * Per-company credentials are stored encrypted in sunat_credentials table.
 * Falls back to env vars if no DB credentials found.
 */

import type { ISunatProvider } from "./provider.interface";
import { MockSunatProvider } from "./mock.provider";
import { RealSunatProvider } from "./real.provider";
import { decrypt } from "./crypto";
import { logger } from "@/lib/logger";

export type { ISunatProvider };
export { MockSunatProvider, RealSunatProvider };
export * from "./errors";
export * from "./provider.interface";

/** Get provider for a specific company (loads credentials from DB) */
export async function getSunatProviderForCompany(companyId: string): Promise<ISunatProvider> {
  if ((process.env.SUNAT_PROVIDER ?? "mock") !== "real") {
    return new MockSunatProvider();
  }

  try {
    const prisma = (await import("@/lib/db/prisma")).default;
    const cred = await prisma.sunatCredential.findUnique({ where: { companyId } });

    if (cred && cred.isActive) {
      let clientSecret: string;
      try {
        clientSecret = decrypt(cred.clientSecretEnc);
      } catch (decryptErr) {
        logger.warn("[SUNAT] Failed to decrypt client secret — credentials may have been saved with a different key. Re-save credentials in /configuracion.", { companyId, error: String(decryptErr) });
        throw new Error("No se puede descifrar el client_secret. Vuelve a guardar las credenciales en /configuracion con el client_secret real.");
      }
      if (!clientSecret || clientSecret.trim() === "") {
        throw new Error("El client_secret descifrado está vacío. Vuelve a guardar las credenciales en /configuracion.");
      }
      logger.info("[SUNAT] Using DB credentials for company", { companyId, ruc: cred.ruc });
      return new RealSunatProvider({ clientId: cred.clientId, clientSecret, ruc: cred.ruc });
    }
  } catch (err) {
    logger.warn("[SUNAT] Could not load DB credentials", { companyId, error: String(err) });
    throw err; // Re-throw so the caller gets the real error message
  }

  // Fallback to env vars
  const clientId = process.env.SUNAT_CLIENT_ID;
  const clientSecret = process.env.SUNAT_CLIENT_SECRET;
  const ruc = process.env.SUNAT_RUC;

  if (clientId && clientSecret && ruc) {
    return new RealSunatProvider({ clientId, clientSecret, ruc });
  }

  logger.warn("[SUNAT] No credentials found, using mock provider", { companyId });
  return new MockSunatProvider();
}

/** Legacy: global provider from env (used when companyId not available) */
export function getSunatProvider(): ISunatProvider {
  if ((process.env.SUNAT_PROVIDER ?? "mock") !== "real") return new MockSunatProvider();
  const clientId = process.env.SUNAT_CLIENT_ID;
  const clientSecret = process.env.SUNAT_CLIENT_SECRET;
  const ruc = process.env.SUNAT_RUC;
  if (!clientId || !clientSecret || !ruc) return new MockSunatProvider();
  return new RealSunatProvider({ clientId, clientSecret, ruc });
}
