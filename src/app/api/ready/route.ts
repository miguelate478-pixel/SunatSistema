/**
 * GET /api/ready — Railway healthcheck endpoint
 *
 * Simple, public, no auth required.
 * Returns 200 when the app process is up.
 * DB check is optional — if DB fails, still returns 200 (app is ready, DB will connect later).
 */

import { NextResponse } from "next/server";

export async function GET() {
  // Minimal check — just confirm the app process is alive
  // Railway needs this to pass healthcheck even if DB isn't ready yet
  try {
    // Optional DB check — don't fail if DB unavailable
    if (process.env.DATABASE_URL) {
      const prisma = (await import("@/lib/db/prisma")).default;
      await prisma.$queryRaw`SELECT 1`;
    }
  } catch {
    // DB not ready — that's OK, app is still ready to receive requests
  }
  
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() }, { status: 200 });
}
