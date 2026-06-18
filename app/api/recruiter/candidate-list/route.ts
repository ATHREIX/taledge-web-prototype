import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";

export const runtime = "nodejs";

type CandidateInvite = {
  name?: string;
  email?: string;
  targetRole?: string;
  experienceBand?: "fresher" | "1-3";
};

type Body = {
  recruiterId?: string;
  jobId?: string;
  paid?: boolean;
  candidates?: CandidateInvite[];
};

const MAX_CANDIDATES = 500;
const MAX_FIELD_LEN = 200;

function isShortString(v: unknown, max = MAX_FIELD_LEN): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

export async function POST(req: NextRequest) {
  // 1. Authenticate. The principal is the authorization subject - never the body.
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  // Lightweight abuse guard on this billing-adjacent action endpoint.
  const limited = enforceRateLimit(req, {
    uid,
    limit: 30,
    windowMs: 60000,
    scope: "recruiter-candidate-list",
  });
  if (limited) return limited;

  // 2. Parse + validate body.
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!isShortString(body.jobId)) {
    return NextResponse.json(
      { ok: false, error: "jobId is required" },
      { status: 400 }
    );
  }
  const jobId = body.jobId;

  if (body.recruiterId !== undefined && !isShortString(body.recruiterId)) {
    return NextResponse.json(
      { ok: false, error: "recruiterId is invalid" },
      { status: 400 }
    );
  }

  if (body.candidates !== undefined && !Array.isArray(body.candidates)) {
    return NextResponse.json(
      { ok: false, error: "candidates must be an array" },
      { status: 400 }
    );
  }

  if (Array.isArray(body.candidates) && body.candidates.length > MAX_CANDIDATES) {
    return NextResponse.json(
      { ok: false, error: `candidates exceeds maximum of ${MAX_CANDIDATES}` },
      { status: 400 }
    );
  }

  // SECURITY: gate access on the authenticated principal, NOT on a
  // client-supplied recruiterId. The body recruiterId (if present and valid)
  // is only echoed back for UI continuity; it must never determine identity
  // or whether the action is permitted.
  const recruiterId = uid;

  // SECURITY: do NOT trust a client-supplied `paid` boolean as the gate.
  // In demo/dev the action proceeds; in production this must be backed by a
  // verified entitlement for the authenticated principal. Until that exists,
  // fail closed in production rather than honoring a body flag.
  if (isProd) {
    logger.warn("candidate-list invoked in prod without verified entitlement", { uid, jobId });
    return NextResponse.json(
      {
        ok: false,
        status: "payment_required",
        error: "Payment confirmation is required before candidate links are sent",
        quoteId: `quote_${recruiterId}_${Date.now()}`,
      },
      { status: 402 }
    );
  }

  try {
    const candidates = Array.isArray(body.candidates) ? body.candidates : [];
    const validCandidates = candidates.filter(
      (c) => c && typeof c === "object" && isShortString(c.email) && isShortString(c.name)
    );

    return NextResponse.json({
      ok: true,
      status: "links_queued",
      recruiterId,
      jobId,
      received: candidates.length,
      queued: validCandidates.length,
      inviteBatchId: `batch_${jobId}_${Math.random().toString(36).slice(2, 8)}`,
      nextStep: "Candidates receive profile, assessment, and AI interview links.",
    });
  } catch (err) {
    logger.error("candidate-list failed", { uid, jobId, err: String(err) });
    return NextResponse.json(
      { ok: false, error: isProd ? "Unable to queue candidate links" : String(err) },
      { status: 500 }
    );
  }
}
