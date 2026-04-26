/**
 * GET /api/sunat/ruc?ruc=20610169849&companyId=...
 * Consulta la razón social de un RUC.
 * Intenta múltiples fuentes en orden:
 *   1. APIs públicas de SUNAT/terceros (sin auth)
 *   2. API autenticada de SUNAT usando credenciales de la empresa (si companyId provisto)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSunatProviderForCompany } from "@/lib/sunat";
import { RealSunatProvider } from "@/lib/sunat/real.provider";

async function lookupPublic(ruc: string): Promise<string | null> {
  const endpoints: Array<() => Promise<string | null>> = [
    // SUNAT API Padrones
    async () => {
      const res = await fetch(
        `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/validarcontribuyente`,
        { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return null;
      const data = await res.json() as { razonSocial?: string; nombre?: string };
      return data.razonSocial ?? data.nombre ?? null;
    },
    // SUNAT CPE API básica
    async () => {
      const res = await fetch(
        `https://api-cpe.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return null;
      const data = await res.json() as { razonSocial?: string; nombre?: string };
      return data.razonSocial ?? data.nombre ?? null;
    },
    // APIs Peru (tercero)
    async () => {
      const res = await fetch(
        `https://dniruc.apisperu.com/api/v1/ruc/${ruc}`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return null;
      const data = await res.json() as { razonSocial?: string; nombre?: string };
      return data.razonSocial ?? data.nombre ?? null;
    },
    // APIs.net.pe (tercero alternativo)
    async () => {
      const res = await fetch(
        `https://api.apis.net.pe/v2/ruc?numero=${ruc}`,
        { headers: { Accept: "application/json", Referer: "https://apis.net.pe" }, signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) return null;
      const data = await res.json() as { razonSocial?: string; nombre?: string };
      return data.razonSocial ?? data.nombre ?? null;
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

async function lookupWithSunatToken(ruc: string, companyId: string): Promise<string | null> {
  try {
    const provider = await getSunatProviderForCompany(companyId);
    // Only attempt if we have a real provider (not mock)
    if (!(provider instanceof RealSunatProvider)) return null;

    const res = await (provider as RealSunatProvider).lookupContribuyente(ruc);
    return res ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const ruc = request.nextUrl.searchParams.get("ruc");
    const companyId = request.nextUrl.searchParams.get("companyId");

    if (!ruc || ruc.length !== 11 || !/^\d{11}$/.test(ruc)) {
      return NextResponse.json({ success: false, error: "RUC debe tener 11 dígitos numéricos" }, { status: 400 });
    }

    // 1. Try public APIs first (fast, no auth needed)
    let razonSocial = await lookupPublic(ruc);

    // 2. If public APIs fail and we have a companyId, try with SUNAT token
    if (!razonSocial && companyId) {
      razonSocial = await lookupWithSunatToken(ruc, companyId);
    }

    if (!razonSocial) {
      return NextResponse.json({
        success: false,
        error: "No se encontró la razón social. Puedes ingresarla manualmente.",
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { ruc, razonSocial } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al consultar RUC";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 500 });
  }
}
