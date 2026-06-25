import { NextRequest, NextResponse } from "next/server";
import { getResults, DnlaError } from "@/lib/dnla-client";
import { normalizeDnlaResults } from "@/lib/dnla-mapping";
import { getDnlaSessionByTan, updateDnlaSession } from "@/lib/dnla-store";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * DNLA completion webhook (server-to-server; NOT user-authenticated).
 *
 * DNLA calls this when a participant finishes the questionnaire. We use the TAN
 * to find OUR candidate, fetch the structured result by DNLA's numeric id,
 * normalize it onto the 4 axes, and persist it so the Fit Score can use it.
 *
 * Protect with a shared secret: set DNLA_WEBHOOK_SECRET and register the webhook
 * URL as  /api/dnla/webhook?secret=<value>  (or send header x-dnla-secret).
 *
 * NOTE: the exact webhook payload field names are not in the public spec —
 * extraction below is defensive. Confirm against your DNLA partner portal and
 * tighten if needed.
 */
function authorized(req: NextRequest): "ok" | "unauthorized" | "misconfigured" {
  const secret = process.env.DNLA_WEBHOOK_SECRET?.trim();
  const isProd =
    process.env.NODE_ENV === "production" || process.env.AUTH_ENFORCED === "true";
  if (!secret) {
    // FAIL CLOSED in production: an unconfigured secret must NOT accept forged
    // completion payloads. Only the local/dev convenience path may skip the check.
    return isProd ? "misconfigured" : "ok";
  }
  const provided =
    req.nextUrl.searchParams.get("secret") || req.headers.get("x-dnla-secret") || "";
  return provided === secret ? "ok" : "unauthorized";
}

export async function POST(req: NextRequest) {
  const auth = authorized(req);
  if (auth === "misconfigured") {
    logger.error("dnla-webhook: DNLA_WEBHOOK_SECRET is not set in production — rejecting");
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }
  if (auth === "unauthorized") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* tolerate empty/non-JSON */
  }

  const tan = String(body?.tan ?? body?.tan_nummer ?? "").trim();
  const resultId = String(
    body?.id ?? body?.session_id ?? body?.results_id ?? body?.result_id ?? ""
  ).trim();

  if (!tan || !resultId) {
    logger.error("[dnla/webhook] missing tan or result id", { keys: Object.keys(body || {}) });
    return NextResponse.json({ ok: false, error: "tan and result id are required." }, { status: 422 });
  }

  const session = await getDnlaSessionByTan(tan);
  if (!session) {
    logger.error("[dnla/webhook] unknown tan", { tan });
    return NextResponse.json({ ok: false, error: "unknown tan" }, { status: 404 });
  }

  try {
    const results = await getResults(resultId);
    const normalized = normalizeDnlaResults(results);
    await updateDnlaSession(tan, {
      status: "complete",
      resultId,
      normalized,
      finishedAt: Date.now(),
      error: null,
    });
    logger.info("[dnla/webhook] result stored", { tan, resultId, baseline: normalized.baseline });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || e);
    await updateDnlaSession(tan, { status: "error", resultId, error: msg });
    logger.error("[dnla/webhook] result fetch failed", { tan, resultId, err: msg });
    const status = e instanceof DnlaError ? e.status : 502;
    return NextResponse.json({ ok: false, error: "could not fetch results" }, { status });
  }
}
