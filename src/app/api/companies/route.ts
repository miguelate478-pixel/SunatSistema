/**
 * GET  /api/companies          — list companies for current user
 * POST /api/companies          — create new company
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createSchema = z.object({
  ruc: z.string().length(11, "RUC debe tener 11 dígitos"),
  razonSocial: z.string().min(3, "Razón social requerida"),
  nombreComercial: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  sector: z.string().default("Comercio"),
  plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]).default("PROFESSIONAL"),
});

export async function GET(_request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA"]);

    // SUPER_ADMIN sees all; others see only their companies
    const isSuperAdmin = session.companyRoles.some((r: { roleName: string }) => r.roleName === "SUPER_ADMIN");

    let companies;
    if (isSuperAdmin) {
      companies = await prisma.company.findMany({
        where: { isActive: true },
        orderBy: { razonSocial: "asc" },
        select: {
          id: true, ruc: true, razonSocial: true, nombreComercial: true,
          sector: true, plan: true, isActive: true, createdAt: true,
          _count: { select: { vouchers: true, userRoles: true } },
        },
      });
    } else {
      const companyIds = session.companyRoles.map((r: { companyId: string }) => r.companyId);
      companies = await prisma.company.findMany({
        where: { id: { in: companyIds }, isActive: true },
        orderBy: { razonSocial: "asc" },
        select: {
          id: true, ruc: true, razonSocial: true, nombreComercial: true,
          sector: true, plan: true, isActive: true, createdAt: true,
          _count: { select: { vouchers: true, userRoles: true } },
        },
      });
    }

    return NextResponse.json({ success: true, data: companies });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await request.json();
    const data = createSchema.parse(body);

    // Check RUC uniqueness
    const existing = await prisma.company.findUnique({ where: { ruc: data.ruc } });
    if (existing) {
      return NextResponse.json({ success: false, error: `Ya existe una empresa con RUC ${data.ruc}` }, { status: 409 });
    }

    const company = await prisma.company.create({
      data: {
        ruc: data.ruc,
        razonSocial: data.razonSocial,
        nombreComercial: data.nombreComercial || null,
        direccion: data.direccion || null,
        telefono: data.telefono || null,
        email: data.email || null,
        sector: data.sector,
        plan: data.plan,
        createdById: session.id,
      },
    });

    // Assign creator as ADMIN_EMPRESA
    const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN_EMPRESA" } });
    if (adminRole) {
      await prisma.userCompanyRole.create({
        data: { userId: session.id, companyId: company.id, roleId: adminRole.id },
      });
    }

    return NextResponse.json({
      success: true,
      data: { id: company.id, ruc: company.ruc, razonSocial: company.razonSocial },
      message: `Empresa ${company.razonSocial} creada correctamente`,
    }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al crear empresa";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 400 });
  }
}
