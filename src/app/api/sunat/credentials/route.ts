import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const saveCredentialsSchema = z.object({
  companyId: z.string().uuid(),
  ruc: z.string().length(11),
  usuario: z.string().min(1),
  claveSol: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
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
    const validation = saveCredentialsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { companyId, ruc, usuario, claveSol, clientId, clientSecret } = validation.data;

    // Verify user has access to this company
    const hasAccess = session.companyRoles.some((cr) => cr.company.id === companyId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "No tienes acceso a esta empresa" },
        { status: 403 }
      );
    }

    // Upsert credentials
    await prisma.sunatCredential.upsert({
      where: { companyId },
      create: {
        companyId,
        ruc,
        usuario,
        claveSol,
        clientId,
        clientSecret,
        isActive: true,
      },
      update: {
        ruc,
        usuario,
        claveSol,
        clientId,
        clientSecret,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Credenciales guardadas correctamente",
    });
  } catch (error) {
    console.error("Error saving credentials:", error);
    return NextResponse.json(
      { success: false, error: "Error al guardar credenciales" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "companyId requerido" },
        { status: 400 }
      );
    }

    // Verify user has access to this company
    const hasAccess = session.companyRoles.some((cr) => cr.company.id === companyId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "No tienes acceso a esta empresa" },
        { status: 403 }
      );
    }

    const credentials = await prisma.sunatCredential.findUnique({
      where: { companyId },
    });

    if (!credentials) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: credentials.id,
        ruc: credentials.ruc,
        usuario: credentials.usuario,
        clientId: credentials.clientId,
        isActive: credentials.isActive,
        lastTestedAt: credentials.lastTestedAt,
        lastTestOk: credentials.lastTestOk,
        lastTestMessage: credentials.lastTestMessage,
      },
    });
  } catch (error) {
    console.error("Error getting credentials:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener credenciales" },
      { status: 500 }
    );
  }
}
