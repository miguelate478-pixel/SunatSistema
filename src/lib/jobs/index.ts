/**
 * Job Queue — BullMQ with Redis fallback to in-process
 * Set REDIS_URL to enable BullMQ for production.
 */

import { logger } from "@/lib/logger";

export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface JobPayload {
  jobId: string;
  companyId: string;
  tipo: string;
  parametros: Record<string, unknown>;
}

export type JobHandler = (payload: JobPayload) => Promise<void>;

export const JOB_TYPES = {
  DOWNLOAD_SUNAT: "download:sunat",
  GENERATE_REPORT: "report:generate",
} as const;

// ── In-process fallback ────────────────────────────────────────────────────────

class InProcessQueue {
  private handlers = new Map<string, JobHandler>();

  register(jobType: string, handler: JobHandler) {
    this.handlers.set(jobType, handler);
  }

  async enqueue(jobType: string, payload: JobPayload): Promise<void> {
    const handler = this.handlers.get(jobType);
    if (!handler) { logger.warn(`[JobQueue] No handler for: ${jobType}`); return; }
    setImmediate(async () => {
      try {
        logger.job(jobType, payload.jobId, "started");
        await handler(payload);
        logger.job(jobType, payload.jobId, "completed");
      } catch (err) {
        logger.error("[JobQueue] Job failed", { jobType, jobId: payload.jobId, error: String(err) });
      }
    });
  }
}

// ── BullMQ (Redis) ─────────────────────────────────────────────────────────────

class BullMQQueue {
  private initialized = false;
  private handlers = new Map<string, JobHandler>();
  private queues = new Map<string, unknown>();
  private workers = new Map<string, unknown>();

  private async init(jobType: string, handler: JobHandler) {
    const { Queue, Worker } = await import("bullmq");
    const { Redis } = await import("ioredis");
    const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

    const queue = new Queue(jobType, { connection });
    this.queues.set(jobType, queue);

    const worker = new Worker(
      jobType,
      async (job) => {
        logger.job(jobType, (job.data as JobPayload).jobId, "started", { attempt: job.attemptsMade });
        await handler(job.data as JobPayload);
        logger.job(jobType, (job.data as JobPayload).jobId, "completed");
      },
      { connection: new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null }), concurrency: 2 }
    );

    worker.on("failed", (job, err) => {
      logger.error("[BullMQ] Job failed", { jobType, jobId: (job?.data as JobPayload)?.jobId, error: String(err) });
    });

    this.workers.set(jobType, worker);
    this.handlers.set(jobType, handler);
  }

  async register(jobType: string, handler: JobHandler) {
    await this.init(jobType, handler);
  }

  async enqueue(jobType: string, payload: JobPayload): Promise<void> {
    const queue = this.queues.get(jobType) as import("bullmq").Queue | undefined;
    if (!queue) throw new Error(`Queue not registered: ${jobType}`);
    await queue.add(jobType, payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
    logger.job(jobType, payload.jobId, "enqueued");
  }
}

// ── Unified interface ──────────────────────────────────────────────────────────

interface IQueue {
  register(jobType: string, handler: JobHandler): void | Promise<void>;
  enqueue(jobType: string, payload: JobPayload): Promise<void>;
}

class QueueFacade implements IQueue {
  private impl: InProcessQueue | BullMQQueue;

  constructor() {
    if (process.env.REDIS_URL) {
      logger.info("[JobQueue] Using BullMQ with Redis");
      this.impl = new BullMQQueue();
    } else {
      logger.info("[JobQueue] Using in-process queue (no REDIS_URL)");
      this.impl = new InProcessQueue();
    }
  }

  register(jobType: string, handler: JobHandler) {
    return this.impl.register(jobType, handler);
  }

  enqueue(jobType: string, payload: JobPayload) {
    return this.impl.enqueue(jobType, payload);
  }
}

export const jobQueue = new QueueFacade();
