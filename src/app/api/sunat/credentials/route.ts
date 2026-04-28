import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const saveCredentialsSchema = z.object({
  companyId: z.string().uuid(),
  ruc: z.string().length(11),
  usuario: z.string().min(1),
  claveSol: z.string().optional().default(""),
  clientId: z.string().min(1),
  clientSecret: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
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

    const hasAccess = session.companyRoles.some((cr) => cr.company.id === companyId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "No tienes acceso a esta empresa" }, { status: 403 });
    }

    // Check if credentials already exist
    const existing = await prisma.sunatCredential.findUnique({ where: { companyId } });

    if (existing) {
      // Update — only overwrite secrets if provided
      await prisma.sunatCredential.update({
        where: { companyId },
        data: {
          ruc,
          usuario,
          clientId,
          isActive: true,
          ...(clientSecret ? { clientSecret } : {}),
          ...(claveSol ? { claveSol } : {}),
        },
      });
    } else {
      // Create — require secrets on first save
      await prisma.sunatCredential.create({
        data: {
          companyId,
          ruc,
          usuario,
          clientId,
          clientSecret: clientSecret || "",
          claveSol: claveSol || "",
          isActive: true,
        },
      });
    }

    return NextResponse.json({ success: true, message: "Credenciales guardadas correctamente" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error saving credentials:", msg);
    return NextResponse.json(
      { success: false, error: `Error al guardar credenciales: ${msg}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const companyId = new URL(req.url).searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });
    }

    const hasAccess = session.companyRoles.some((cr) => cr.company.id === companyId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "No tienes acceso a esta empresa" }, { status: 403 });
    }

    const credentials = await prisma.sunatCredential.findUnique({ where: { companyId } });

    if (!credentials) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: credentials.id,
        ruc: credentials.ruc,
        usuarioSol: credentials.usuario,
        clientId: credentials.clientId,
        isActive: credentials.isActive,
        lastTestedAt: credentials.lastTestedAt,
        lastTestOk: credentials.lastTestOk,
        lastTestMessage: credentials.lastTestMessage,
        lastSyncAt: credentials.lastSyncAt,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error getting credentials:", msg);
    return NextResponse.json({ success: false, error: "Error al obtener credenciales" }, { status: 500 });
  }
}
