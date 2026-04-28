import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { SunatClient } from "@/lib/sunat/sunat-client";
import { getTicketPoller } from "@/lib/sunat/ticket-poller";
import { z } from "zod";

const requestDownloadSchema = z.object({
  companyId: z.string().uuid(),
  tipo: z.enum(["propuesta-compras", "propuesta-ventas", "propuesta", "resumen", "comprobantes"]),
  periodo: z.string().regex(/^\d{6}$/),
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
    const validation = requestDownloadSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { companyId, tipo, periodo } = validation.data;

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

    const numTicket = await client.requestDownloadTicket(tipo, periodo);

    const downloadJob = await prisma.downloadJob.create({
      data: {
        companyId,
        numTicket,
        tipo,
        periodo,
        status: "PENDING",
        progress: 0,
      },
    });

    // Start polling
    const poller = getTicketPoller();
    poller.startPolling(downloadJob.id, companyId, credentials.id);

    return NextResponse.json({
      success: true,
      data: {
        jobId: downloadJob.id,
        numTicket,
        tipo,
        periodo,
      },
      message: "Descarga solicitada correctamente",
    });
  } catch (error) {
    console.error("Error requesting download:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error al solicitar descarga" },
      { status: 500 }
    );
  }
}
