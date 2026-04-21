/**
 * SUNAT Credentials management
 * GET  /api/sunat/credentials?companyId=...  — get status (never returns secret)
 * POST /api/sunat/credentials                — save/update credentials
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { encrypt } from "@/lib/sunat/crypto";
import { z } from "zod";

const saveSchema = z.object({
  companyId: z.string().uuid(),
  ruc: z.string().length(11, "RUC debe tener 11 dígitos"),
  clientId: z.string().min(1, "client_id requerido"),
  clientSecret: z.string().min(1, "client_secret requerido"),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA"]);
    const companyId = request.nextUrl.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    const cred = await prisma.sunatCredential.findUnique({ where: { companyId } });
    if (!cred) return NextResponse.json({ success: true, data: null });

    return NextResponse.json({
      success: true,
      data: {
        id: cred.id,
        companyId: cred.companyId,
        ruc: cred.ruc,
        clientId: cred.clientId,
        // Never return clientSecret
        isActive: cred.isActive,
        lastTestedAt: cred.lastTestedAt?.toISOString() ?? null,
        lastTestOk: cred.lastTestOk,
        lastTestMessage: cred.lastTestMessage,
        lastSyncAt: cred.lastSyncAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA"]);
    const body = await request.json();
    const data = saveSchema.parse(body);

    // Encrypt the secret before storing
    const clientSecretEnc = encrypt(data.clientSecret);

    const cred = await prisma.sunatCredential.upsert({
      where: { companyId: data.companyId },
      create: {
        companyId: data.companyId,
        ruc: data.ruc,
        clientId: data.clientId,
        clientSecretEnc,
        isActive: true,
      },
      update: {
        ruc: data.ruc,
        clientId: data.clientId,
        clientSecretEnc,
        isActive: true,
        // Reset test status on credential change
        lastTestedAt: null,
        lastTestOk: null,
        lastTestMessage: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: cred.id, companyId: cred.companyId, ruc: cred.ruc, clientId: cred.clientId, isActive: cred.isActive },
      message: "Credenciales SUNAT guardadas correctamente",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al guardar credenciales";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 400 });
  }
}
