/**
 * POST /api/sunat/test-connection
 * Tests SUNAT credentials for a company.
 * Returns: { connected: boolean, message: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { getSunatProviderForCompany } from "@/lib/sunat";
import { logger } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({ companyId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA"]);
    const body = await request.json();
    const { companyId } = schema.parse(body);

    logger.info("[SUNAT] Testing connection", { companyId });

    const provider = await getSunatProviderForCompany(companyId);
    const result = await provider.healthCheck();

    // Persist test result
    await prisma.sunatCredential.updateMany({
      where: { companyId },
      data: {
        lastTestedAt: new Date(),
        lastTestOk: result.ok,
        lastTestMessage: result.message,
      },
    });

    logger.info("[SUNAT] Connection test result", { companyId, ok: result.ok, message: result.message });

    return NextResponse.json({
      success: true,
      data: {
        connected: result.ok,
        message: result.message,
        testedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al probar conexión";
    logger.error("[SUNAT] Connection test failed", { error: msg });
    return NextResponse.json(
      { success: false, error: "No se pudo probar la conexión SUNAT. Verifica las credenciales." },
      { status: msg === "No autenticado" ? 401 : 400 }
    );
  }
}
