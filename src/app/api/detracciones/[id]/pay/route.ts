import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { audit, requestMeta } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA", "TESORERIA"]);
    const { id } = await params;
    const body = await request.json();

    const detraction = await prisma.detraction.update({
      where: { id },
      data: {
        estado: "PAGADO",
        fechaPago: new Date(),
        numeroConstancia: body.numeroConstancia || `CONST-${Date.now()}`,
      },
      include: { voucher: true },
    });

    await prisma.voucher.update({
      where: { id: detraction.voucherId },
      data: { estadoDetraccion: "PAGADO" },
    });

    // Audit log
    audit({
      userId: session.id,
      companyId: detraction.voucher.companyId,
      action: "DETRACTION_PAY",
      entity: "Detraction",
      entityId: id,
      changes: { estado: "PAGADO", numeroConstancia: detraction.numeroConstancia },
      ...requestMeta(request),
    });

    return NextResponse.json({
      success: true,
      data: detraction,
      message: "Detracción pagada exitosamente",
    });
  } catch (error) {
    console.error("Detraction pay error:", error);
    const message = error instanceof Error ? error.message : "Error al pagar detracción";
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "No autenticado" ? 401 : message === "No autorizado" ? 403 : 500 }
    );
  }
}
