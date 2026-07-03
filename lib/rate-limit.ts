import "server-only";
import { NextResponse } from "next/server";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";

/**
 * Rate limiter for the paid Gemini / abuse-sensitive routes.
 *
 * Two backends, selected automatically:
 *   - Firebase Admin configured (prod)  -> Firestore-backed fixed-window counter
 *     in the `rateLimits` collection. ONE counter doc per key, shared across all
 *     Cloud Run instances, so the limit is a true GLOBAL cap (not per-instance).
 *   - Otherwise (local/demo)            -> the per-instance in-memory Map below.
 *
 * The in-memory path is retained because with maxInstances=100 a module-level
 * Map gives an effective cap of ~100x the intended limit (and resets on every
 * cold start). Firestore gives one authoritative counter instead.
 *
 * FAIL OPEN: the Firestore path must never throw. On any Firestore error we fall
 * back to the in-memory check so a transient hiccup can never 500 a request or
 * lock a real user out of an interview.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Shared Firestore collection holding one fixed-window counter doc per key. */
const RATE_LIMIT_COLLECTION = "rateLimits";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/** Per-instance in-memory primitive. Synchronous; used for demo/dev and as the
 *  fail-open fallback when the Firestore path errors. */
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

/**
 * Shared Firestore-backed fixed-window counter. One doc per key holds
 * `{ count, windowStart, resetAt }`; a transaction serialises the read of the
 * current count and the write of count+1 so the cap is enforced globally across
 * instances. When the window has elapsed the counter is reset. Costs one
 * read + one write (a single doc) per call.
 */
async function rateLimitShared(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  // Doc IDs may not contain "/"; encode the key so any scope/uid/ip is safe.
  const ref = adminDb!.collection(RATE_LIMIT_COLLECTION).doc(encodeURIComponent(key));
  return adminDb!.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? (snap.data() as { count?: number; resetAt?: number }) : null;
    if (!data || typeof data.resetAt !== "number" || now > data.resetAt) {
      // Fresh window.
      const resetAt = now + windowMs;
      tx.set(ref, { count: 1, windowStart: now, resetAt });
      return { ok: true, remaining: limit - 1, resetAt };
    }
    const count = (data.count || 0) + 1;
    const ok = count <= limit;
    tx.update(ref, { count });
    return { ok, remaining: Math.max(0, limit - count), resetAt: data.resetAt };
  });
}

/** Best-effort client key from headers (IP) combined with a principal id. */
export function clientKey(req: Request, uid?: string): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || "unknown";
  return `${uid || "anon"}:${ip}`;
}

/** Convenience: enforce a limit and return a 429 response when exceeded. */
export async function enforceRateLimit(
  req: Request,
  opts: { uid?: string; limit: number; windowMs: number; scope: string }
): Promise<NextResponse | null> {
  const key = `${opts.scope}:${clientKey(req, opts.uid)}`;
  let result: RateLimitResult;
  if (isAdminConfigured && adminDb) {
    try {
      result = await rateLimitShared(key, opts.limit, opts.windowMs);
    } catch (e) {
      // FAIL OPEN: never block a legitimate user on a Firestore hiccup — fall
      // back to the per-instance in-memory check so *some* limit still applies.
      logger.warn("[rate-limit] shared limiter failed; using in-memory fallback", { err: String(e) });
      result = rateLimit(key, opts.limit, opts.windowMs);
    }
  } else {
    result = rateLimit(key, opts.limit, opts.windowMs);
  }
  if (result.ok) return null;
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { ok: false, error: "Rate limit exceeded. Try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
