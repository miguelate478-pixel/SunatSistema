import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import { dashboardService } from "@/server/services/dashboard.service";

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    const charts = await dashboardService.getCharts(companyId);
    return NextResponse.json({ success: true, data: charts });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener gráficos";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 500 });
  }
}
