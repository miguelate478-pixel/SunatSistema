import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import { dashboardService } from "@/server/services/dashboard.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    const [summary, topProveedores, recentVouchers, recentAlertas] = await Promise.all([
      dashboardService.getSummary(companyId),
      dashboardService.getTopProveedores(companyId, 4),
      dashboardService.getRecentVouchers(companyId, 5),
      dashboardService.getRecentAlertas(companyId, 5),
    ]);

    return NextResponse.json({ success: true, data: { ...summary, topProveedores, recentVouchers, recentAlertas } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener resumen";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 500 });
  }
}
