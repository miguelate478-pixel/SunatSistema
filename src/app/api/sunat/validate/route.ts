/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { SunatClient } from "@/lib/sunat/sunat-client";
import { z } from "zod";

const validateSchema = z.object({
  companyId: z.string().uuid(),
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
    const validation = validateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { companyId } = validation.data;

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
        success: false,
        valid: false,
        message: "No hay credenciales configuradas",
      });
    }

    const client = new SunatClient(
      credentials.clientId,
      credentials.clientSecret,
      credentials.ruc,
      credentials.usuario,
      credentials.claveSol
    );

    try {
      const token = await client.getOAuth2Token();

      // Test getPeriodos endpoint
      let periodoTest = null;
      let periodoError = null;
      try {
        periodoTest = await client.getPeriodos("080000");
        console.log("[SIRE] 5.33 periodos:", JSON.stringify(periodoTest));
      } catch (e: any) {
        periodoError = `HTTP ${e?.response?.status}: ${JSON.stringify(e?.response?.data ?? e?.message)}`;
        console.log("[SIRE] 5.33 error:", periodoError);
      }

      // Update credentials test status
      await prisma.sunatCredential.update({
        where: { id: credentials.id },
        data: {
          lastTestedAt: new Date(),
          lastTestOk: true,
          lastTestMessage: "Credenciales válidas",
        },
      });

      return NextResponse.json({
        success: true,
        valid: true,
        message: "Token obtenido correctamente",
        tokenPreview: token.substring(0, 30) + "...",
        ruc: credentials.ruc,
        clientId: credentials.clientId,
        periodoTest,
        periodoError,
      });
    } catch (error: any) {
      // Update credentials test status
      await prisma.sunatCredential.update({
        where: { id: credentials.id },
        data: {
          lastTestedAt: new Date(),
          lastTestOk: false,
          lastTestMessage: error.message,
        },
      });

      return NextResponse.json({
        success: false,
        valid: false,
        message: error.message,
      });
    }
  } catch (error) {
    console.error("Error validating credentials:", error);
    return NextResponse.json(
      { success: false, error: "Error al validar credenciales" },
      { status: 500 }
    );
  }
}
