/**
 * SUNAT Credentials management
 * GET  /api/sunat/credentials?companyId=...  — get status (never returns secrets)
 * POST /api/sunat/credentials                — save/update credentials
 *
 * SUNAT CPE API uses grant_type=password with:
 *   username = RUC + usuarioSol  (e.g. "20610169849MODDATOS")
 *   password = claveSol
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
  clientSecret: z.string().optional(),
  usuarioSol: z.string().min(1, "Usuario SOL requerido"),
  claveSol: z.string().optional(), // optional on update — empty = keep existing
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
        usuarioSol: cred.usuarioSol,
        // Never return secrets
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

    const existing = await prisma.sunatCredential.findUnique({ where: { companyId: data.companyId } });

    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
      select: { ruc: true },
    });
    if (!company) {
      return NextResponse.json({ success: false, error: "Empresa no encontrada" }, { status: 404 });
    }

    // On first save, both secrets are required
    if (!existing) {
      if (!data.clientSecret || data.clientSecret.trim() === "") {
        return NextResponse.json({ success: false, error: "client_secret es requerido para la primera configuración" }, { status: 400 });
      }
      if (!data.claveSol || data.claveSol.trim() === "") {
        return NextResponse.json({ success: false, error: "Clave SOL es requerida para la primera configuración" }, { status: 400 });
      }
    }

    const secretChanged = !!(data.clientSecret && data.clientSecret.trim() !== "");
    const claveSolChanged = !!(data.claveSol && data.claveSol.trim() !== "");

    const updateData: Record<string, unknown> = {
      ruc: data.ruc,
      clientId: data.clientId,
      usuarioSol: data.usuarioSol,
      isActive: true,
    };

    if (secretChanged) {
      updateData.clientSecretEnc = encrypt(data.clientSecret!);
      updateData.lastTestedAt = null;
      updateData.lastTestOk = null;
      updateData.lastTestMessage = null;
    }
    if (claveSolChanged) {
      updateData.claveSolEnc = encrypt(data.claveSol!);
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
        usuarioSol: data.usuarioSol,
        claveSolEnc: encrypt(data.claveSol!),
        isActive: true,
      },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { id: cred.id, companyId: cred.companyId, ruc: cred.ruc, clientId: cred.clientId, usuarioSol: cred.usuarioSol, isActive: cred.isActive },
      message: "Credenciales SUNAT guardadas correctamente",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al guardar credenciales";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 400 });
  }
}
