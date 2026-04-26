/**
 * PATCH  /api/users/[id]  — update user (nombre, activar/desactivar, cambiar rol)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  nombre: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  companyId: z.string().uuid().optional(),
  roleName: z.enum(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD", "TESORERIA", "GERENCIA", "AUDITOR"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA"]);
    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.nombre) updateData.nombre = data.nombre;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.update({ where: { id }, data: updateData });

    // Update role if provided
    if (data.companyId && data.roleName) {
      const role = await prisma.role.findUnique({ where: { name: data.roleName } });
      if (role) {
        await prisma.userCompanyRole.updateMany({
          where: { userId: id, companyId: data.companyId },
          data: { roleId: role.id },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { id: user.id, email: user.email, nombre: user.nombre, isActive: user.isActive },
      message: "Usuario actualizado correctamente",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al actualizar usuario";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
