/**
 * Rate Limiter — in-memory fallback, Redis when REDIS_URL is set
 */

import { logger } from "@/lib/logger";

export interface RateLimitConfig { windowMs: number; max: number }
export interface RateLimitResult { allowed: boolean; remaining: number; resetAt: number }

// ── In-memory ─────────────────────────────────────────────────────────────────

interface Entry { count: number; resetAt: number }
const memStore = new Map<string, Entry>();
setInterval(() => { const now = Date.now(); for (const [k, v] of memStore) if (v.resetAt < now) memStore.delete(k); }, 5 * 60 * 1000);

function memRateLimit(id: string, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = memStore.get(id);
  if (!entry || entry.resetAt < now) {
    const resetAt = now + cfg.windowMs;
    memStore.set(id, { count: 1, resetAt });
    return { allowed: true, remaining: cfg.max - 1, resetAt };
  }
  if (entry.count >= cfg.max) return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  entry.count++;
  return { allowed: true, remaining: cfg.max - entry.count, resetAt: entry.resetAt };
}

// ── Redis sliding window ──────────────────────────────────────────────────────

let _redis: import("ioredis").Redis | null = null;

async function getRedis(): Promise<import("ioredis").Redis> {
  if (_redis) return _redis;
  const { Redis } = await import("ioredis");
  _redis = new Redis(process.env.REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 1 });
  return _redis;
}

async function redisRateLimit(id: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  try {
    const redis = await getRedis();
    const key = `rl:${id}`;
    const windowSec = Math.ceil(cfg.windowMs / 1000);
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSec);
    const results = await pipeline.exec();
    const count = (results?.[0]?.[1] as number) ?? 1;
    const resetAt = Date.now() + cfg.windowMs;
    return count > cfg.max
      ? { allowed: false, remaining: 0, resetAt }
      : { allowed: true, remaining: cfg.max - count, resetAt };
  } catch (err) {
    logger.warn("[RateLimit] Redis error, failing open", { error: String(err) });
    return { allowed: true, remaining: cfg.max, resetAt: Date.now() + cfg.windowMs };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function rateLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
  return process.env.REDIS_URL ? redisRateLimit(identifier, config) : memRateLimit(identifier, config);
}

export const RATE_LIMITS = {
  LOGIN:           { windowMs: 15 * 60 * 1000, max: 10  },
  API_GENERAL:     { windowMs: 60 * 1000,       max: 120 },
  REPORT_GENERATE: { windowMs: 60 * 1000,       max: 10  },
  DOWNLOAD_JOB:    { windowMs: 60 * 1000,       max: 5   },
  AI_QUERY:        { windowMs: 60 * 1000,       max: 20  },
} as const;
