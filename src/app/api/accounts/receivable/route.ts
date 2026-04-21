import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    const accounts = await prisma.accountReceivable.findMany({
      where: { companyId },
      orderBy: { fechaVencimiento: "asc" },
    });

    // Recalculate diasVencimiento dynamically
    const now = new Date();
    const data = accounts.map((a) => {
      const venc = new Date(a.fechaVencimiento);
      const dias = Math.ceil((venc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const estado = dias < 0 ? "VENCIDO" : dias === 0 ? "VENCE_HOY" : "VIGENTE";
      return {
        id: a.id,
        cliente: a.cliente,
        ruc: a.ruc,
        documento: a.documento,
        monto: Number(a.monto),
        saldo: Number(a.saldo),
        montoPagado: Number(a.montoPagado),
        moneda: a.moneda,
        fechaEmision: a.fechaEmision.toISOString(),
        fechaVencimiento: a.fechaVencimiento.toISOString(),
        diasVencimiento: dias,
        estado,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener cuentas por cobrar";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 500 });
  }
}
