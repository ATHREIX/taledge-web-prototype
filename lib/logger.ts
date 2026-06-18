import "server-only";

/**
 * Minimal structured logger. Swap the sink for Sentry/Datadog in production
 * (single import surface). Never logs secrets - redacts common key names.
 */

const REDACT = /(api[_-]?key|authorization|password|token|secret|private[_-]?key)/i;

function redact(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = REDACT.test(k) ? "[redacted]" : v;
  }
  return out;
}

function emit(level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) {
  const line = { level, msg, ...(redact(meta) || {}) };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(line));
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
