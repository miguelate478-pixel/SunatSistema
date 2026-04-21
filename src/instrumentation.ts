/**
 * Next.js Instrumentation Hook
 * Runs once at server startup (Node.js runtime only).
 * Initializes job workers and the daily sync scheduler.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initJobs } = await import("./lib/jobs/init");
    await initJobs();
  }
}
