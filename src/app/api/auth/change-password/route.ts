import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { AuthService } from "@/server/services/auth.service";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Contraseña actual requerida"),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Verify current password
    const authService = new AuthService();
    const user = await authService.validateCredentials(session.email, currentPassword);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Contraseña actual incorrecta" },
        { status: 400 }
      );
    }

    // Update password
    await authService.updatePassword(session.id, newPassword);

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { success: false, error: "Error al cambiar contraseña" },
      { status: 500 }
    );
  }
}
