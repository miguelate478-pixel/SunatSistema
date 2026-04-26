/**
 * POST /api/auth/change-password
 * Cambia la contraseña del usuario autenticado.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  currentPassword: z.string().min(1, "Contraseña actual requerida"),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { currentPassword, newPassword } = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ success: false, error: "La contraseña actual es incorrecta" }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ success: false, error: "La nueva contraseña debe ser diferente a la actual" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: session.id }, data: { password: hashed } });

    return NextResponse.json({ success: true, message: "Contraseña actualizada correctamente" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al cambiar contraseña";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 400 });
  }
}
