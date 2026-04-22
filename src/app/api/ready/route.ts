/**
 * GET /api/ready — Railway healthcheck endpoint
 *
 * Simple, public, no auth required.
 * Returns 200 when the app is up and DB is reachable.
 * Does NOT check Redis, S3, or SUNAT — those are optional.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export async function GET() {
  try {
    // Minimal DB check — if this passes, the app is ready
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    // DB not ready yet — return 503 so Railway retries
    return NextResponse.json({ status: "db_unavailable" }, { status: 503 });
  }
}
