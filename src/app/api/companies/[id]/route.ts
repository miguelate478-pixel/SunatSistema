/**
 * GET    /api/companies/[id]  — get company detail
 * PATCH  /api/companies/[id]  — update company
 * DELETE /api/companies/[id]  — deactivate company (soft)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const updateSchema = z.object({
  razonSocial: z.string().min(3).optional(),
  nombreComercial: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  sector: z.string().optional(),
  plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA"]);
    const { id } = await params;
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        sunatCredential: { select: { ruc: true, isActive: true, lastTestOk: true, lastSyncAt: true } },
        _count: { select: { vouchers: true, userRoles: true } },
      },
    });
    if (!company) return NextResponse.json({ success: false, error: "Empresa no encontrada" }, { status: 404 });
    return NextResponse.json({ success: true, data: company });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: msg }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA"]);
    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...(data.razonSocial && { razonSocial: data.razonSocial }),
        ...(data.nombreComercial !== undefined && { nombreComercial: data.nombreComercial || null }),
        ...(data.direccion !== undefined && { direccion: data.direccion || null }),
        ...(data.telefono !== undefined && { telefono: data.telefono || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.sector && { sector: data.sector }),
        ...(data.plan && { plan: data.plan }),
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: company.id, ruc: company.ruc, razonSocial: company.razonSocial },
      message: "Empresa actualizada correctamente",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al actualizar";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const { id } = await params;
    await prisma.company.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, message: "Empresa desactivada" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
