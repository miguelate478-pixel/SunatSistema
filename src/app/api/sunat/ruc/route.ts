/**
 * GET /api/sunat/ruc?ruc=20610169849&companyId=...
 *
 * Consulta razón social de un RUC.
 * Usa padrones.service.ts que intenta:
 *   1. API autenticada SUNAT (con token SOL si hay companyId)
 *   2. API pública SUNAT Padrones
 *   3. APIs de terceros (apis.net.pe)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { lookupRuc } from "@/lib/sunat/padrones.service";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const ruc = request.nextUrl.searchParams.get("ruc");
    const companyId = request.nextUrl.searchParams.get("companyId") ?? undefined;

    if (!ruc || ruc.length !== 11 || !/^\d{11}$/.test(ruc)) {
      return NextResponse.json({ success: false, error: "RUC debe tener 11 dígitos numéricos" }, { status: 400 });
    }

    const result = await lookupRuc(ruc, companyId);

    if (!result) {
      return NextResponse.json({
        success: false,
        error: "No se encontró la razón social. Puedes ingresarla manualmente.",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ruc: result.ruc,
        razonSocial: result.razonSocial,
        estado: result.estado,
        condicion: result.condicion,
        fuente: result.fuente,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al consultar RUC";
    return NextResponse.json({ success: false, error: msg }, {
      status: msg === "No autenticado" ? 401 : 500,
    });
  }
}
