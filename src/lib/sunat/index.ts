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
      let claveSol: string;
      try {
        clientSecret = decrypt(cred.clientSecretEnc);
        claveSol = cred.claveSolEnc ? decrypt(cred.claveSolEnc) : "";
      } catch (decryptErr) {
        logger.warn("[SUNAT] Failed to decrypt credentials", { companyId, error: String(decryptErr) });
        throw new Error("No se puede descifrar las credenciales. Vuelve a guardarlas en /configuracion.");
      }
      if (!clientSecret || clientSecret.trim() === "") {
        throw new Error("El client_secret está vacío. Vuelve a guardar las credenciales en /configuracion.");
      }
      if (!claveSol || claveSol.trim() === "") {
        throw new Error("La clave SOL está vacía. Vuelve a guardar las credenciales en /configuracion.");
      }
      logger.info("[SUNAT] Using DB credentials for company", { companyId, ruc: cred.ruc });
      return new RealSunatProvider({
        clientId: cred.clientId,
        clientSecret,
        ruc: cred.ruc,
        usuarioSol: cred.usuarioSol,
        claveSol,
      });
    }
  } catch (err) {
    logger.warn("[SUNAT] Could not load DB credentials", { companyId, error: String(err) });
    throw err; // Re-throw so the caller gets the real error message
  }

  // Fallback to env vars
  const clientId = process.env.SUNAT_CLIENT_ID;
  const clientSecret = process.env.SUNAT_CLIENT_SECRET;
  const ruc = process.env.SUNAT_RUC;
  const usuarioSol = process.env.SUNAT_USUARIO_SOL ?? "";
  const claveSol = process.env.SUNAT_CLAVE_SOL ?? "";

  if (clientId && clientSecret && ruc) {
    return new RealSunatProvider({ clientId, clientSecret, ruc, usuarioSol, claveSol });
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
  const usuarioSol = process.env.SUNAT_USUARIO_SOL ?? "";
  const claveSol = process.env.SUNAT_CLAVE_SOL ?? "";
  if (!clientId || !clientSecret || !ruc) return new MockSunatProvider();
  return new RealSunatProvider({ clientId, clientSecret, ruc, usuarioSol, claveSol });
}
