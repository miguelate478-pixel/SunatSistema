/**
 * GET  /api/sire?companyId=...&periodo=2026-04&tipo=RCE|RVIE
 *   → Genera y devuelve el archivo TXT del registro SIRE
 *
 * POST /api/sire
 *   → Genera y guarda el registro SIRE, devuelve metadata + contenido
 */

import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import { generarRCE, generarRVIE } from "@/lib/sunat/sire.service";
import { z } from "zod";

const querySchema = z.object({
  companyId: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Período debe ser YYYY-MM"),
  tipo: z.enum(["RCE", "RVIE"]),
});

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const params = querySchema.parse({
      companyId: sp.get("companyId"),
      periodo: sp.get("periodo"),
      tipo: sp.get("tipo"),
    });

    await requireCompanyAccess(params.companyId);

    const result = params.tipo === "RCE"
      ? await generarRCE(params.companyId, params.periodo)
      : await generarRVIE(params.companyId, params.periodo);

    // Return as downloadable TXT file
    return new NextResponse(result.contenidoTxt, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-SIRE-Registros": String(result.registros),
        "X-SIRE-Periodo": result.periodo,
        "X-SIRE-Tipo": result.tipo,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al generar registro SIRE";
    return NextResponse.json({ success: false, error: msg }, {
      status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 400,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = querySchema.parse(body);

    await requireCompanyAccess(params.companyId);

    const result = params.tipo === "RCE"
      ? await generarRCE(params.companyId, params.periodo)
      : await generarRVIE(params.companyId, params.periodo);

    return NextResponse.json({
      success: true,
      data: {
        companyId: result.companyId,
        periodo: result.periodo,
        tipo: result.tipo,
        registros: result.registros,
        filename: result.filename,
        generadoAt: result.generadoAt,
        contenidoTxt: result.contenidoTxt, // base64 or raw — client downloads
      },
      message: `${result.tipo} generado: ${result.registros} registros para ${result.periodo}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al generar registro SIRE";
    return NextResponse.json({ success: false, error: msg }, {
      status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 400,
    });
  }
}
