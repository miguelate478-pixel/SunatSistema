import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) return NextResponse.json({ success: false, error: "Alerta no encontrada" }, { status: 404 });

    await requireCompanyAccess(alert.companyId);

    await prisma.alert.update({ where: { id }, data: { leida: true } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 500 });
  }
}
