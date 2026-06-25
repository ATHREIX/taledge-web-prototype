import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createTan, isDnlaConfigured, DnlaError } from "@/lib/dnla-client";
import { createDnlaSession } from "@/lib/dnla-store";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Start a DNLA assessment for the signed-in candidate.
 *
 * Server-side: creates a DNLA TAN (api_key never leaves the server), records the
 * TAN↔candidate mapping in Firestore, and returns the DNLA-hosted `start_url`
 * the browser should open. Completion is delivered later via /api/dnla/webhook.
 */
export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();

  const limited = enforceRateLimit(req, {
    uid: principal.uid,
    limit: 10,
    windowMs: 60_000,
    scope: "dnla-start",
  });
  if (limited) return limited;

  if (!isDnlaConfigured()) {
    return NextResponse.json(
      { ok: false, error: "DNLA is not configured on this deployment yet." },
      { status: 503 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* body optional */
  }
  const candidateId = String(body?.candidateId || "").trim();
  if (!candidateId) {
    return NextResponse.json({ ok: false, error: "candidateId is required." }, { status: 400 });
  }

  try {
    const created = await createTan({
      email: body?.email ? String(body.email).slice(0, 200) : principal.email,
      firstname: body?.firstname ? String(body.firstname).slice(0, 120) : undefined,
      lastname: body?.lastname ? String(body.lastname).slice(0, 120) : undefined,
    });

    await createDnlaSession({
      tan: created.tan.tan_nummer,
      ownerUid: principal.uid,
      candidateId,
      startUrl: created.tan.start_url,
    });

    logger.info("[dnla/start] tan created", { uid: principal.uid, candidateId });
    return NextResponse.json({
      ok: true,
      startUrl: created.tan.start_url,
      tan: created.tan.tan_nummer,
    });
  } catch (e: any) {
    const status = e instanceof DnlaError ? e.status : 502;
    logger.error("[dnla/start] failed", { err: String(e?.message || e), status });
    return NextResponse.json(
      { ok: false, error: "Could not start the DNLA assessment. Please try again." },
      { status }
    );
  }
}
