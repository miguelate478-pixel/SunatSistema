/**
 * GET /api/sunat/ruc?ruc=20512345678
 * Consulta la razón social de un RUC usando la API pública de SUNAT.
 * No requiere credenciales — usa el endpoint público de consulta.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const ruc = request.nextUrl.searchParams.get("ruc");
    if (!ruc || ruc.length !== 11) {
      return NextResponse.json({ success: false, error: "RUC debe tener 11 dígitos" }, { status: 400 });
    }

    // Try multiple public APIs for RUC lookup
    let razonSocial: string | null = null;

    // Option 1: apis.net.pe (free, no auth required)
    try {
      const res = await fetch(`https://api.apis.net.pe/v2/sunat/ruc?numero=${ruc}`, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "ControlSUNAT/1.0",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json() as { razonSocial?: string; nombre?: string };
        razonSocial = data.razonSocial ?? data.nombre ?? null;
      }
    } catch {
      // Try next option
    }

    // Option 2: apiperu.dev (fallback)
    if (!razonSocial) {
      try {
        const res = await fetch(`https://apiperu.dev/api/ruc/${ruc}`, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json() as { data?: { nombre_o_razon_social?: string } };
          razonSocial = data.data?.nombre_o_razon_social ?? null;
        }
      } catch {
        // Both failed
      }
    }

    if (!razonSocial) {
      return NextResponse.json({
        success: false,
        error: "No se pudo obtener la razón social. Verifica el RUC o ingrésala manualmente.",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { ruc, razonSocial },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al consultar RUC";
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg === "No autenticado" ? 401 : 500 }
    );
  }
}
