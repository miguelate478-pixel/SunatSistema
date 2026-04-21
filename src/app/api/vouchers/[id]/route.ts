import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { voucherService } from "@/server/services/voucher.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const voucher = await voucherService.getVoucherById(id);

    return NextResponse.json({
      success: true,
      data: voucher,
    });
  } catch (error) {
    console.error("Voucher detail error:", error);
    const message = error instanceof Error ? error.message : "Error al obtener comprobante";
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "No autenticado" ? 401 : message === "Comprobante no encontrado" ? 404 : 500 }
    );
  }
}
