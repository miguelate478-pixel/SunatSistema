import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { SunatClient } from "@/lib/sunat/sunat-client";

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
    const codLibro = searchParams.get("codLibro") || "080000";

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
      return NextResponse.json(
        { success: false, error: "No hay credenciales SUNAT configuradas" },
        { status: 400 }
      );
    }

    const client = new SunatClient(
      credentials.clientId,
      credentials.clientSecret,
      credentials.ruc,
      credentials.usuario,
      credentials.claveSol
    );

    const periodos = await client.getPeriodos(codLibro);

    return NextResponse.json({
      success: true,
      data: periodos,
    });
  } catch (error) {
    console.error("Error getting periodos:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error al obtener periodos" },
      { status: 500 }
    );
  }
}
