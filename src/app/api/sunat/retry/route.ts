import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { SunatClient } from "@/lib/sunat/sunat-client";
import { getTicketPoller } from "@/lib/sunat/ticket-poller";
import { z } from "zod";

const retrySchema = z.object({
  jobId: z.string().uuid(),
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
    const validation = retrySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { jobId } = validation.data;

    const job = await prisma.downloadJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Trabajo no encontrado" },
        { status: 404 }
      );
    }

    // Verify user has access to this company
    const hasAccess = session.companyRoles.some((cr) => cr.company.id === job.companyId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "No tienes acceso a esta empresa" },
        { status: 403 }
      );
    }

    const credentials = await prisma.sunatCredential.findUnique({
      where: { companyId: job.companyId },
    });

    if (!credentials) {
      return NextResponse.json(
        { success: false, error: "No hay credenciales SUNAT configuradas" },
        { status: 400 }
      );
    }

    // Reset job status
    await prisma.downloadJob.update({
      where: { id: jobId },
      data: {
        status: "PENDING",
        progress: 0,
        errorMessage: null,
      },
    });

    // Request new ticket
    const client = new SunatClient(
      credentials.clientId,
      credentials.clientSecret,
      credentials.ruc,
      credentials.usuario,
      credentials.claveSol
    );

    const numTicket = await client.requestDownloadTicket(
      job.tipo as "propuesta-compras" | "propuesta-ventas" | "resumen" | "comprobantes",
      job.periodo
    );

    await prisma.downloadJob.update({
      where: { id: jobId },
      data: { numTicket },
    });

    // Start polling
    const poller = getTicketPoller();
    poller.startPolling(jobId, job.companyId, credentials.id);

    return NextResponse.json({
      success: true,
      message: "Reintento iniciado correctamente",
    });
  } catch (error) {
    console.error("Error retrying job:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Error al reintentar" },
      { status: 500 }
    );
  }
}
