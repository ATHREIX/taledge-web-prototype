import "server-only";
import { NextResponse } from "next/server";

/**
 * Lightweight in-memory token-bucket rate limiter.
 *
 * NOTE: per-instance only - correct for single-node/dev and a meaningful first
 * line of defense on serverless (per-lambda). For strict global limits in
 * production, back this with Upstash/Redis (same call signature). The goal here
 * is to stop trivial billing-abuse loops against the paid Gemini routes.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  b.count += 1;
  const ok = b.count <= limit;
  return { ok, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

/** Best-effort client key from headers (IP) combined with a principal id. */
export function clientKey(req: Request, uid?: string): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || "unknown";
  return `${uid || "anon"}:${ip}`;
}

/** Convenience: enforce a limit and return a 429 response when exceeded. */
export function enforceRateLimit(
  req: Request,
  opts: { uid?: string; limit: number; windowMs: number; scope: string }
): NextResponse | null {
  const { ok, resetAt } = rateLimit(`${opts.scope}:${clientKey(req, opts.uid)}`, opts.limit, opts.windowMs);
  if (ok) return null;
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { ok: false, error: "Rate limit exceeded. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
