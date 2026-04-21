import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/server/services/auth.service";
import { loginSchema } from "@/lib/validators/auth";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { audit, requestMeta } from "@/lib/audit";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return secret;
}
const TOKEN_NAME = "auth-token";

export async function POST(request: NextRequest) {
  // Rate limiting by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(`login:${ip}`, RATE_LIMITS.LOGIN);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Demasiados intentos. Espera 15 minutos e intenta nuevamente." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  try {
    const body = await request.json();

    // Validate input
    const validatedData = loginSchema.parse(body);

    // Login
    const { user } = await authService.login(validatedData);

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: "7d" });

    // Build response
    const responseData = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        avatar: user.avatar,
        companyRoles: Array.isArray(user.companyRoles)
          ? (user.companyRoles as Array<{
              isActive: boolean;
              company: { id: string; ruc: string; razonSocial: string; nombreComercial: string | null; plan: string };
              role: { id: string; name: string };
            }>).map((cr) => ({
              companyId: cr.company.id,
              roleId: cr.role.id,
              roleName: cr.role.name,
              company: {
                id: cr.company.id,
                ruc: cr.company.ruc,
                razonSocial: cr.company.razonSocial,
                nombreComercial: cr.company.nombreComercial,
                plan: cr.company.plan,
              },
            }))
          : [],
      },
    };

    // Set cookie directly on the NextResponse (the only reliable way in Route Handlers)
    const response = NextResponse.json(responseData);
    response.cookies.set(TOKEN_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Audit log — non-blocking
    const meta = requestMeta(request);
    audit({
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ...meta,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError?.message ?? "Datos inválidos" },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "";

    if (
      errorMessage.includes("P1001") ||
      errorMessage.includes("Can't reach database") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("connect ETIMEDOUT")
    ) {
      return NextResponse.json(
        { success: false, error: "No se pudo conectar a la base de datos. Verifica que el servidor esté activo." },
        { status: 503 }
      );
    }

    if (errorMessage.includes("Credenciales inválidas")) {
      return NextResponse.json(
        { success: false, error: "Email o contraseña incorrectos" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Error al iniciar sesión. Intenta nuevamente." },
      { status: 500 }
    );
  }
}
