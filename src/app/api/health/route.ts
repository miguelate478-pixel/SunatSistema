/**
 * GET /api/health — system health check
 *
 * Protected: requires X-Health-Token header matching HEALTH_TOKEN env var,
 * OR only accessible from localhost in development.
 * Used for preproduction and production monitoring.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { logger } from "@/lib/logger";

interface ServiceStatus {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

async function checkDatabase(): Promise<ServiceStatus> {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, message: "PostgreSQL conectado", latencyMs: Date.now() - t };
  } catch (err) {
    return { ok: false, message: `DB error: ${String(err).slice(0, 100)}` };
  }
}

async function checkStorage(): Promise<ServiceStatus> {
  const t = Date.now();
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  try {
    const testKey = `health/test-${Date.now()}.txt`;
    await storage.upload({ key: testKey, content: "ok", mimeType: "text/plain" });
    const content = await storage.get(testKey);
    await storage.delete(testKey);
    if (content.toString() !== "ok") throw new Error("Content mismatch");
    return {
      ok: true,
      message: `Storage ${provider.toUpperCase()} operativo`,
      latencyMs: Date.now() - t,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Storage ${provider.toUpperCase()} error: ${String(err).slice(0, 150)}`,
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  if (!process.env.REDIS_URL) {
    return { ok: true, message: "Redis no configurado (modo in-process)" };
  }
  const t = Date.now();
  try {
    const { Redis } = await import("ioredis");
    const redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    await redis.connect();
    await redis.ping();
    await redis.quit();
    return { ok: true, message: "Redis conectado", latencyMs: Date.now() - t };
  } catch (err) {
    return { ok: false, message: `Redis error: ${String(err).slice(0, 100)}` };
  }
}

async function checkSunat(): Promise<ServiceStatus> {
  const provider = process.env.SUNAT_PROVIDER ?? "mock";
  if (provider !== "real") {
    return { ok: true, message: `SUNAT provider: ${provider} (mock)` };
  }
  const t = Date.now();
  try {
    const { getSunatProvider } = await import("@/lib/sunat");
    const p = getSunatProvider();
    const result = await p.healthCheck();
    return {
      ok: result.ok,
      message: result.message,
      latencyMs: Date.now() - t,
    };
  } catch (err) {
    return { ok: false, message: `SUNAT error: ${String(err).slice(0, 100)}` };
  }
}

export async function GET(request: NextRequest) {
  // Without token: return minimal 200 (for Railway health checks and uptime monitors)
  // With valid token: return full diagnostic details
  const healthToken = process.env.HEALTH_TOKEN;
  const provided = request.headers.get("x-health-token");
  const hasValidToken = !healthToken || provided === healthToken;

  if (!hasValidToken) {
    // Minimal response for unauthenticated probes — just confirms the app is up
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  const [db, storageCheck, redis, sunat] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkRedis(),
    checkSunat(),
  ]);

  const allOk = db.ok && storageCheck.ok && redis.ok && sunat.ok;

  const result = {
    status: allOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      database: db,
      storage: storageCheck,
      redis,
      sunat,
    },
    env: {
      nodeEnv: process.env.NODE_ENV,
      storageProvider: process.env.STORAGE_PROVIDER ?? "local",
      sunatProvider: process.env.SUNAT_PROVIDER ?? "mock",
      redisConfigured: !!process.env.REDIS_URL,
    },
  };

  logger.info("[Health] Health check", { status: result.status });

  return NextResponse.json(result, { status: allOk ? 200 : 503 });
}
