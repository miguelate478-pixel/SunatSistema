type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = { level, message, timestamp: new Date().toISOString(), ...meta };
  if (process.env.NODE_ENV === "production") {
    console[level === "debug" ? "log" : level](JSON.stringify(entry));
  } else {
    const prefix = `[${entry.timestamp.slice(11, 23)}] [${level.toUpperCase().padEnd(5)}]`;
    const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    console[level === "debug" ? "log" : level](`${prefix} ${message}${metaStr}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => log("info",  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log("warn",  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  request: (method: string, path: string, status: number, ms: number) =>
    log("info", `${method} ${path} ${status}`, { durationMs: ms }),
  job: (type: string, id: string, event: string, meta?: Record<string, unknown>) =>
    log("info", `[Job:${type}] ${event}`, { jobId: id, ...meta }),
  exception: (err: unknown, ctx?: Record<string, unknown>) => {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", msg, { ...ctx, stack: err instanceof Error ? err.stack : undefined });
  },
};
