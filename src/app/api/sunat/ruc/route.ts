/**
 * GET /api/sunat/ruc?ruc=20512345678
 * Consulta la razón social de un RUC usando APIs públicas.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

interface RucResult {
  razonSocial: string;
  estado?: string;
  condicion?: string;
}

async function lookupFromApisNetPe(ruc: string): Promise<RucResult | null> {
  try {
    const res = await fetch(`https://api.apis.net.pe/v2/sunat/ruc?numero=${ruc}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://e-consultaruc.sunat.gob.pe/",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { razonSocial?: string; nombre?: string; estado?: string; condicion?: string };
    const razonSocial = data.razonSocial ?? data.nombre ?? null;
    if (!razonSocial) return null;
    return { razonSocial, estado: data.estado, condicion: data.condicion };
  } catch {
    return null;
  }
}

async function lookupFromApiPeru(ruc: string): Promise<RucResult | null> {
  try {
    const res = await fetch(`https://apiperu.dev/api/ruc/${ruc}`, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { nombre_o_razon_social?: string; estado_contribuyente?: string } };
    const razonSocial = data.data?.nombre_o_razon_social ?? null;
    if (!razonSocial) return null;
    return { razonSocial, estado: data.data?.estado_contribuyente };
  } catch {
    return null;
  }
}

async function lookupFromSunatConsulta(ruc: string): Promise<RucResult | null> {
  try {
    // SUNAT public consultation endpoint
    const res = await fetch(
      `https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias?accion=consPorRuc&nroRuc=${ruc}&contexto=ti-it&modo=1`,
      {
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const html = await res.text();
    // Extract razon social from HTML response
    const match = html.match(/Nombre Comercial[^<]*<[^>]+>([^<]+)</i) ??
                  html.match(/Apellidos y Nombres[^<]*<[^>]+>([^<]+)</i) ??
                  html.match(/Razón Social[^<]*<[^>]+>([^<]+)</i);
    if (!match?.[1]) return null;
    const razonSocial = match[1].trim();
    if (!razonSocial || razonSocial.length < 3) return null;
    return { razonSocial };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const ruc = request.nextUrl.searchParams.get("ruc");
    if (!ruc || ruc.length !== 11 || !/^\d{11}$/.test(ruc)) {
      return NextResponse.json({ success: false, error: "RUC debe tener 11 dígitos numéricos" }, { status: 400 });
    }

    // Try APIs in parallel for speed
    const [result1, result2] = await Promise.all([
      lookupFromApisNetPe(ruc),
      lookupFromApiPeru(ruc),
    ]);

    const result = result1 ?? result2;

    if (!result) {
      // Last resort: SUNAT direct
      const result3 = await lookupFromSunatConsulta(ruc);
      if (result3) {
        return NextResponse.json({ success: true, data: { ruc, ...result3 } });
      }

      return NextResponse.json({
        success: false,
        error: "No se encontró información para este RUC. Verifica que sea correcto.",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { ruc, ...result },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al consultar RUC";
    return NextResponse.json(
      { success: false, error: msg },
      { status: msg === "No autenticado" ? 401 : 500 }
    );
  }
}
