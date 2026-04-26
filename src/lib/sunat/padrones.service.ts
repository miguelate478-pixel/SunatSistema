/**
 * SUNAT Padrones Service — Capa de Validación
 *
 * Responsabilidad: validar RUC, obtener razón social, verificar consistencia.
 *
 * Fuentes disponibles (en orden de prioridad):
 *   1. API autenticada CPE (requiere token SOL) — más confiable
 *   2. API pública SUNAT Padrones — sin auth, no siempre disponible
 *   3. APIs de terceros (apis.net.pe, etc.) — fallback
 */

import { logger } from "@/lib/logger";

export interface RucInfo {
  ruc: string;
  razonSocial: string;
  estado?: string;        // ACTIVO, BAJA, etc.
  condicion?: string;     // HABIDO, NO HABIDO
  direccion?: string;
  fuente: "sunat_auth" | "sunat_public" | "tercero";
}

/**
 * Lookup RUC usando token autenticado de SUNAT (más confiable).
 * Requiere que la empresa tenga credenciales configuradas.
 */
export async function lookupRucAutenticado(
  ruc: string,
  companyId: string
): Promise<RucInfo | null> {
  try {
    const { loadCompanyCredentials, getSunatToken } = await import("./auth.service");
    const creds = await loadCompanyCredentials(companyId);
    const token = await getSunatToken(creds, "cpe");

    const res = await fetch(
      `https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/contribuyentes/${ruc}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json() as {
      razonSocial?: string;
      nombre?: string;
      estadoContribuyente?: string;
      condicionContribuyente?: string;
    };

    const razonSocial = data.razonSocial ?? data.nombre;
    if (!razonSocial) return null;

    return {
      ruc,
      razonSocial,
      estado: data.estadoContribuyente,
      condicion: data.condicionContribuyente,
      fuente: "sunat_auth",
    };
  } catch (err) {
    logger.warn("[SUNAT:Padrones] Authenticated lookup failed", { ruc, error: String(err) });
    return null;
  }
}

/**
 * Lookup RUC usando APIs públicas (sin autenticación).
 * Intenta múltiples fuentes en orden.
 */
export async function lookupRucPublico(ruc: string): Promise<RucInfo | null> {
  const endpoints: Array<() => Promise<RucInfo | null>> = [
    // SUNAT API Padrones oficial
    async () => {
      const res = await fetch(
        `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/validarcontribuyente`,
        {
          headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(6000),
        }
      );
      if (!res.ok) return null;
      const data = await res.json() as {
        razonSocial?: string;
        nombre?: string;
        estadoContribuyente?: string;
        condicionContribuyente?: string;
      };
      const razonSocial = data.razonSocial ?? data.nombre;
      if (!razonSocial) return null;
      return {
        ruc,
        razonSocial,
        estado: data.estadoContribuyente,
        condicion: data.condicionContribuyente,
        fuente: "sunat_public",
      };
    },
    // apis.net.pe (tercero confiable)
    async () => {
      const res = await fetch(
        `https://api.apis.net.pe/v2/ruc?numero=${ruc}`,
        {
          headers: { Accept: "application/json", Referer: "https://apis.net.pe" },
          signal: AbortSignal.timeout(6000),
        }
      );
      if (!res.ok) return null;
      const data = await res.json() as {
        razonSocial?: string;
        nombre?: string;
        estado?: string;
        condicion?: string;
        direccion?: string;
      };
      const razonSocial = data.razonSocial ?? data.nombre;
      if (!razonSocial) return null;
      return {
        ruc,
        razonSocial,
        estado: data.estado,
        condicion: data.condicion,
        direccion: data.direccion,
        fuente: "tercero",
      };
    },
  ];

  for (const fn of endpoints) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Lookup completo: intenta autenticado primero, luego público.
 */
export async function lookupRuc(
  ruc: string,
  companyId?: string
): Promise<RucInfo | null> {
  // Validación básica
  if (!ruc || ruc.length !== 11 || !/^\d{11}$/.test(ruc)) return null;

  // Intenta con token si hay companyId
  if (companyId) {
    const result = await lookupRucAutenticado(ruc, companyId);
    if (result) return result;
  }

  // Fallback a APIs públicas
  return lookupRucPublico(ruc);
}

/**
 * Valida que el RUC configurado en las credenciales SUNAT
 * coincida con el RUC de la empresa activa.
 * Retorna null si todo está bien, o un mensaje de advertencia.
 */
export async function validarConsistenciaRuc(companyId: string): Promise<string | null> {
  const { default: prisma } = await import("@/lib/db/prisma");

  const [company, cred] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { ruc: true, razonSocial: true } }),
    prisma.sunatCredential.findUnique({ where: { companyId }, select: { ruc: true } }),
  ]);

  if (!company || !cred) return null;

  if (company.ruc !== cred.ruc) {
    return `El RUC de la empresa (${company.ruc}) no coincide con el RUC configurado en las credenciales SUNAT (${cred.ruc}). Esto puede causar errores en la descarga de documentos.`;
  }

  return null;
}
