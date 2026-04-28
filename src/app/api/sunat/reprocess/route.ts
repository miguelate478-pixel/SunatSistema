/**
 * POST /api/sunat/reprocess
 * Reprocesa un job SUCCESS con 0 registros — vuelve a descargar y parsear el ZIP.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const schema = z.object({ jobId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { jobId } = schema.parse(await req.json());

    // Reset to PENDING so process-job will reprocess it
    await prisma.downloadJob.update({
      where: { id: jobId },
      data: { status: "PENDING", progress: 0, errorMessage: null, completedAt: null },
    });

    return NextResponse.json({ success: true, message: "Job reseteado para reprocesar" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
