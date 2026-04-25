/**
 * GET /api/sunat/ruc?ruc=20512345678
 * Consulta la razón social directamente desde el portal público de SUNAT.
 * No requiere credenciales ni APIs de pago.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

async function lookupFromSunat(ruc: string): Promise<{ razonSocial: string; estado?: string } | null> {
  try {
    const url = `https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/jcrS00Alias?accion=consPorRuc&nroRuc=${ruc}&contexto=ti-it&modo=1`;
    const res = await fetch(url, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-PE,es;q=0.9",
        "Referer": "https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Extract razon social — SUNAT HTML has it in a table cell after "Nombre Comercial" or "Apellidos y Nombres"
    // Pattern: look for the value in the response table
    const patterns = [
      /Nombre Comercial[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
      /Apellidos y Nombres[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
      /Nombre o Raz[oó]n Social[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
      /<b>([A-ZÁÉÍÓÚÑ\s\.&,'-]{5,80})<\/b>/,
      /class="[^"]*tdReg[^"]*"[^>]*>([A-ZÁÉÍÓÚÑ\s\.&,'-]{5,80})</i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const razonSocial = match[1].trim().replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
        if (razonSocial.length >= 3 && !/^\d+$/.test(razonSocial)) {
          // Extract estado if available
          const estadoMatch = html.match(/Estado[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
          const estado = estadoMatch?.[1]?.trim();
          return { razonSocial, estado };
        }
      }
    }

    return null;
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

    const result = await lookupFromSunat(ruc);

    if (!result) {
      return NextResponse.json({
        success: false,
        error: "No se encontró información para este RUC en SUNAT.",
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
