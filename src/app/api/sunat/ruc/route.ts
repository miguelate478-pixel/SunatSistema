/**
 * GET /api/sunat/ruc?ruc=20512345678
 * Consulta la razón social de un RUC.
 * Usa la API pública de SUNAT Padrones (no requiere captcha ni token).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

async function lookupRuc(ruc: string): Promise<{ razonSocial: string; estado?: string } | null> {
  // SUNAT API Padrones — public endpoint, no auth required
  const endpoints = [
    // Option 1: SUNAT API Padrones
    async () => {
      const res = await fetch(
        `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/validarcontribuyente`,
        {
          headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0",
          },
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
      const razonSocial = data.razonSocial ?? data.nombre ?? null;
      if (!razonSocial) return null;
      return { razonSocial, estado: data.estadoContribuyente };
    },
    // Option 2: SUNAT CPE API (requires no auth for basic lookup)
    async () => {
      const res = await fetch(
        `https://api-cpe.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}`,
        {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) return null;
      const data = await res.json() as { razonSocial?: string; nombre?: string };
      const razonSocial = data.razonSocial ?? data.nombre ?? null;
      if (!razonSocial) return null;
      return { razonSocial };
    },
    // Option 3: DNI/RUC public lookup
    async () => {
      const res = await fetch(
        `https://dniruc.apisperu.com/api/v1/ruc/${ruc}`,
        {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) return null;
      const data = await res.json() as { razonSocial?: string; nombre?: string };
      const razonSocial = data.razonSocial ?? data.nombre ?? null;
      if (!razonSocial) return null;
      return { razonSocial };
    },
  ];

  for (const endpoint of endpoints) {
    try {
      const result = await endpoint();
      if (result?.razonSocial) return result;
    } catch {
      continue;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const ruc = request.nextUrl.searchParams.get("ruc");
    if (!ruc || ruc.length !== 11 || !/^\d{11}$/.test(ruc)) {
      return NextResponse.json({ success: false, error: "RUC debe tener 11 dígitos numéricos" }, { status: 400 });
    }

    const result = await lookupRuc(ruc);

    if (!result) {
      return NextResponse.json({
        success: false,
        error: "No se encontró información para este RUC. Verifica que sea correcto o ingrésalo manualmente.",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { ruc, razonSocial: result.razonSocial, estado: result.estado },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al consultar RUC";
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg === "No autenticado" ? 401 : 500 }
    );
  }
}
