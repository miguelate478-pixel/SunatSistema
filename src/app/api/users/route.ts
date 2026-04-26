/**
 * GET  /api/users  — list users (filtered by company for non-superadmin)
 * POST /api/users  — create user and assign to company+role
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const createSchema = z.object({
  email: z.string().email("Email inválido"),
  nombre: z.string().min(2, "Nombre requerido"),
  password: z.string().min(8, "Contraseña mínimo 8 caracteres"),
  companyId: z.string().uuid(),
  roleName: z.enum(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD", "TESORERIA", "GERENCIA", "AUDITOR"]),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA"]);
    const companyId = request.nextUrl.searchParams.get("companyId");
    const isSuperAdmin = session.companyRoles.some((r: { roleName: string }) => r.roleName === "SUPER_ADMIN");

    let where: Prisma.UserWhereInput = {};
    if (companyId) {
      where = { companyRoles: { some: { companyId, isActive: true } } };
    } else if (!isSuperAdmin) {
      const ids = session.companyRoles.map((r: { companyId: string }) => r.companyId);
      where = { companyRoles: { some: { companyId: { in: ids }, isActive: true } } };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, email: true, nombre: true, isActive: true, createdAt: true,
        companyRoles: {
          where: { isActive: true },
          select: {
            companyId: true,
            company: { select: { razonSocial: true, nombreComercial: true, ruc: true } },
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA"]);
    const body = await request.json();
    const data = createSchema.parse(body);

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ success: false, error: `Ya existe un usuario con email ${data.email}` }, { status: 409 });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company) return NextResponse.json({ success: false, error: "Empresa no encontrada" }, { status: 404 });

    // Get role
    const role = await prisma.role.findUnique({ where: { name: data.roleName } });
    if (!role) return NextResponse.json({ success: false, error: "Rol no encontrado" }, { status: 404 });

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        nombre: data.nombre,
        password: hashedPassword,
        companyRoles: {
          create: { companyId: data.companyId, roleId: role.id },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: user.id, email: user.email, nombre: user.nombre },
      message: `Usuario ${user.nombre} creado correctamente`,
    }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al crear usuario";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 400 });
  }
}
