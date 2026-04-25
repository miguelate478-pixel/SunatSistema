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
  // clientSecret is optional when updating — empty string means "keep existing"
  clientSecret: z.string().optional(),
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

    // Check if credentials already exist
    const existing = await prisma.sunatCredential.findUnique({ where: { companyId: data.companyId } });

    // Verify company exists — RUC in credentials is independent of company.ruc
    // (the SUNAT OAuth credentials can belong to any valid RUC)
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { ruc: true, razonSocial: true },
    });
    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada" }, { status: 404 });
    }

    // clientSecret is required only on first save
    if (!existing && (!data.clientSecret || data.clientSecret.trim() === "")) {
      return NextResponse.json(
        { success: false, error: "client_secret es requerido para la primera configuración" },
        { status: 400 }
      );
    }

    // Build update data — only update secret if provided
    // Do NOT reset lastTestedAt/lastTestOk when only updating RUC/clientId
    // Only reset test status if credentials actually changed
    const secretChanged = !!(data.clientSecret && data.clientSecret.trim() !== "");
    const updateData: {
      ruc: string;
      clientId: string;
      isActive: boolean;
      lastTestedAt?: null;
      lastTestOk?: null;
      lastTestMessage?: null;
      clientSecretEnc?: string;
    } = {
      ruc: data.ruc,
      clientId: data.clientId,
      isActive: true,
    };

    if (secretChanged) {
      updateData.clientSecretEnc = encrypt(data.clientSecret!);
      // Only reset test status when secret changes
      updateData.lastTestedAt = null;
      updateData.lastTestOk = null;
      updateData.lastTestMessage = null;
    }

    const cred = await prisma.sunatCredential.upsert({
      where: { companyId: data.companyId },
      create: {
        companyId: data.companyId,
        ruc: data.ruc,
        clientId: data.clientId,
        clientSecretEnc: encrypt(data.clientSecret!),
        isActive: true,
      },
      update: updateData,
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
