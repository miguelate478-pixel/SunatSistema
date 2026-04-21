/**
 * Scheduler — daily SUNAT sync via BullMQ repeat or node-cron fallback.
 *
 * With REDIS_URL:    BullMQ repeatable job (persistent, survives restarts)
 * Without REDIS_URL: node-cron in-process (development only)
 *
 * The scheduler is initialized once at app startup via src/lib/jobs/init.ts
 * which is imported in next.config.ts instrumentation hook.
 */

import { logger } from "@/lib/logger";
import { runDailySync } from "./sync.service";

// ── BullMQ repeatable scheduler ───────────────────────────────────────────────

async function startBullMQScheduler(): Promise<void> {
  const { Queue, Worker } = await import("bullmq");
  const { Redis } = await import("ioredis");

  const QUEUE_NAME = "sunat:daily-sync";
  const JOB_NAME = "daily-sync";

  const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  const connWorker = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

  const queue = new Queue(QUEUE_NAME, { connection });

  // Register repeatable job: every day at 02:00 Peru time (UTC-5 → 07:00 UTC)
  // Cron: "0 7 * * *" = 07:00 UTC daily
  const cronExpression = process.env.SYNC_CRON ?? "0 7 * * *";

  await queue.upsertJobScheduler(
    JOB_NAME,
    { pattern: cronExpression },
    { name: JOB_NAME, data: { triggeredBy: "cron" } }
  );

  logger.info("[Scheduler] BullMQ daily sync registered", { cron: cronExpression });

  // Worker that processes the scheduled job
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      logger.info("[Scheduler] Daily sync triggered by BullMQ");
      await runDailySync();
    },
    { connection: connWorker, concurrency: 1 }
  );

  worker.on("completed", () => {
    logger.info("[Scheduler] Daily sync job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error("[Scheduler] Daily sync job failed", { error: String(err) });
  });
}

// ── node-cron fallback (no Redis) ─────────────────────────────────────────────

async function startCronFallback(): Promise<void> {
  try {
    const cron = await import("node-cron");
    const cronExpression = process.env.SYNC_CRON ?? "0 7 * * *";

    cron.schedule(cronExpression, async () => {
      logger.info("[Scheduler] Daily sync triggered by node-cron");
      try {
        await runDailySync();
      } catch (err) {
        logger.error("[Scheduler] Daily sync failed", { error: String(err) });
      }
    });

    logger.info("[Scheduler] node-cron daily sync registered", { cron: cronExpression });
  } catch {
    logger.warn("[Scheduler] node-cron not available — scheduler disabled. Install node-cron for in-process scheduling.");
  }
}

// ── Public init ───────────────────────────────────────────────────────────────

let _initialized = false;

export async function initScheduler(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  // Skip in test environment
  if (process.env.NODE_ENV === "test") return;

  try {
    if (process.env.REDIS_URL) {
      await startBullMQScheduler();
    } else {
      await startCronFallback();
    }
  } catch (err) {
    logger.error("[Scheduler] Failed to initialize scheduler", { error: String(err) });
  }
}
