import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const companyId = new URL(req.url).searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    await prisma.alert.updateMany({
      where: { companyId, leida: false, deletedAt: null },
      data: { leida: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 500 });
  }
}
