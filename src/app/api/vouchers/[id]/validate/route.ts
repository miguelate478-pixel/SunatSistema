import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { voucherService } from "@/server/services/voucher.service";
import { audit, requestMeta } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD"]);
    const { id } = await params;

    const voucher = await voucherService.updateVoucher(id, { estado: "ACEPTADO" });

    audit({
      userId: session.id,
      companyId: session.companyRoles[0]?.companyId,
      action: "VOUCHER_VALIDATE",
      entity: "Voucher",
      entityId: id,
      changes: { estado: "ACEPTADO" },
      ...requestMeta(request),
    });

    return NextResponse.json({ success: true, data: voucher, message: "Comprobante validado exitosamente" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al validar comprobante";
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500 }
    );
  }
}
