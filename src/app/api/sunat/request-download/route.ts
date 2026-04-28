/**
 * POST /api/sunat/request-download
 *
 * Flujo correcto SIRE:
 * 1. Solicita ticket con exportacioncomprobantepropuesta (codProceso=10)
 * 2. El ticket termina con nomArchivoReporte = "RUC-FECHA-propuesta.zip"
 * 3. Ese archivo NO se puede descargar directamente (SUNAT devuelve 422)
 * 4. En cambio, hay que buscar el ticket codProceso=5 (Generación de Registros)
 *    que tiene los archivos LE...zip con los datos reales
 *
 * Estrategia: al crear el job, guardamos el período y tipo.
 * process-job buscará todos los tickets del período y descargará
 * los archivos LE...zip del ticket codProceso=5.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const schema = z.object({
  companyId: z.string().uuid(),
  tipo: z.enum(["propuesta-compras", "propuesta-ventas"]),
  periodo: z.string().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const body = await req.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0].message }, { status: 400 });
    }

    const { companyId, tipo, periodo } = validation.data;

    const hasAccess = session.companyRoles.some((cr) => cr.company.id === companyId);
    if (!hasAccess) return NextResponse.json({ success: false, error: "Sin acceso" }, { status: 403 });

    const credentials = await prisma.sunatCredential.findUnique({ where: { companyId } });
    if (!credentials) return NextResponse.json({ success: false, error: "Sin credenciales SUNAT" }, { status: 400 });

    // Create job — numTicket will be set to "SCAN" to indicate we need to scan for LE files
    const job = await prisma.downloadJob.create({
      data: {
        companyId,
        numTicket: `SCAN_${tipo}_${periodo}_${Date.now()}`,
        tipo,
        periodo,
        status: "PENDING",
        progress: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: { jobId: job.id, tipo, periodo },
      message: "Descarga iniciada",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
