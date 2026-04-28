import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const syncSchema = z.object({
  companyId: z.string().uuid(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  downloadFiles: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const validation = syncSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { companyId, fechaInicio, fechaFin } = validation.data;

    const hasAccess = session.companyRoles.some((cr) => cr.company.id === companyId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: "No tienes acceso a esta empresa" }, { status: 403 });
    }

    // Create sync execution record
    const syncExecution = await prisma.syncExecution.create({
      data: {
        companyId,
        tipo: "MANUAL",
        estado: "RUNNING",
        fechaInicio,
        fechaFin,
        docsNuevos: 0,
        docsOk: 0,
        docsError: 0,
        triggeredBy: session.id,
        startedAt: new Date(),
      },
    });

    // Count existing vouchers in period as proxy for "new docs"
    const docsNuevos = await prisma.voucher.count({
      where: {
        companyId,
        fechaEmision: {
          gte: new Date(fechaInicio),
          lte: new Date(fechaFin),
        },
        deletedAt: null,
      },
    });

    await prisma.syncExecution.update({
      where: { id: syncExecution.id },
      data: {
        estado: "COMPLETED",
        docsNuevos,
        docsOk: docsNuevos,
        docsError: 0,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { syncId: syncExecution.id, docsNuevos },
    });
  } catch (error) {
    console.error("Error syncing:", error);
    return NextResponse.json({ success: false, error: "Error al sincronizar" }, { status: 500 });
  }
}
