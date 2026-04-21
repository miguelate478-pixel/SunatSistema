import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    // Build context-aware suggestions based on real data
    const [alertas, detracciones, sinXML, cxcVencidas] = await Promise.all([
      prisma.alert.count({ where: { companyId, deletedAt: null, leida: false, tipo: "ERROR" } }),
      prisma.detraction.count({ where: { voucher: { companyId }, estado: "PENDIENTE" } }),
      prisma.voucher.count({ where: { companyId, deletedAt: null, tieneXML: false } }),
      prisma.accountReceivable.count({ where: { companyId, estado: "VENCIDO" } }),
    ]);

    const suggestions = [
      "Resumen ejecutivo del mes",
      "Resumen de compras del mes",
      "Resumen de ventas del mes",
    ];

    if (alertas > 0) suggestions.unshift(`Tengo ${alertas} alertas críticas, ¿qué debo hacer?`);
    if (detracciones > 0) suggestions.unshift(`¿Cuáles son mis ${detracciones} detracciones pendientes?`);
    if (sinXML > 0) suggestions.push(`¿Qué documentos me faltan? (${sinXML} sin XML)`);
    if (cxcVencidas > 0) suggestions.push(`¿Qué clientes tienen facturas vencidas?`);

    suggestions.push("¿Cuánto debo pagar a mis proveedores?");
    suggestions.push("¿Cuánto me deben mis clientes?");

    return NextResponse.json({ success: true, data: suggestions.slice(0, 6) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener sugerencias";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 500 });
  }
}
