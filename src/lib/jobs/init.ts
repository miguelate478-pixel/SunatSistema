/**
 * Job system initialization — called once at server startup.
 *
 * Registers all workers and starts the scheduler.
 * Import this in instrumentation.ts (Next.js 15+).
 */

import { logger } from "@/lib/logger";

let _initialized = false;

export async function initJobs(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  if (process.env.NODE_ENV === "test") return;

  try {
    // Register download worker
    await import("./download.worker");
    logger.info("[Jobs] Download worker registered");

    // Start scheduler (daily sync)
    const { initScheduler } = await import("./scheduler");
    await initScheduler();
    logger.info("[Jobs] Scheduler initialized");
  } catch (err) {
    logger.error("[Jobs] Failed to initialize job system", { error: String(err) });
  }
}
