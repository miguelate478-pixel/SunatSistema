import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { userRepository } from "@/server/repositories/user.repository";
import type { UserWithRoles, CompanyRole } from "@/lib/db/types";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return secret;
}

const TOKEN_NAME = "auth-token";

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  avatar?: string;
  companyRoles: Array<{
    companyId: string;
    roleId: string;
    roleName: string;
    company: {
      id: string;
      ruc: string;
      razonSocial: string;
      nombreComercial?: string;
      plan: string;
    };
  }>;
}

export async function createSession(userId: string): Promise<string> {
  const token = jwt.sign({ userId }, getJwtSecret(), { expiresIn: "7d" });

  const cookieStore = await cookies();
  cookieStore.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_NAME)?.value;
    if (!token) return null;

    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    const user = await userRepository.findById(decoded.userId) as UserWithRoles | null;
    if (!user || !user.isActive) return null;

    return {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      avatar: user.avatar || undefined,
      companyRoles: user.companyRoles
        .filter((cr: CompanyRole) => cr.isActive)
        .map((cr: CompanyRole) => ({
          companyId: cr.company.id,
          roleId: cr.role.id,
          roleName: cr.role.name,
          company: {
            id: cr.company.id,
            ruc: cr.company.ruc,
            razonSocial: cr.company.razonSocial,
            nombreComercial: cr.company.nombreComercial || undefined,
            plan: cr.company.plan,
          },
        })),
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_NAME);
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("No autenticado");
  return session;
}

export async function requireRole(allowedRoles: string[], companyId?: string): Promise<SessionUser> {
  const session = await requireAuth();
  const hasRole = session.companyRoles.some((cr) => {
    const roleMatch = allowedRoles.includes(cr.roleName) || allowedRoles.includes("*");
    const companyMatch = !companyId || cr.companyId === companyId;
    return roleMatch && companyMatch;
  });
  if (!hasRole) throw new Error("No autorizado");
  return session;
}

/**
 * Verify the authenticated user has access to a specific company.
 * Throws "No autorizado" if not.
 * Use this in every API route that receives a companyId param.
 */
export async function requireCompanyAccess(companyId: string): Promise<SessionUser> {
  const session = await requireAuth();
  const hasAccess = session.companyRoles.some((cr) => cr.companyId === companyId);
  if (!hasAccess) throw new Error("No autorizado");
  return session;
}
