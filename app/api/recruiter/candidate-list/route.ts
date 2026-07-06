import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized, forbidden, principalHasRole, getPublicBaseUrl } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";
import { createInvites, listJobs, listInvites } from "@/lib/talent-store";
import { isEmailConfigured, sendInviteEmails } from "@/lib/email";

export const runtime = "nodejs";

/**
 * The recruiter's sent off-campus invites with live status tracking
 * (invited → started → completed). Owner-scoped to the authenticated uid.
 */
export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  if (!(await principalHasRole(principal, "recruiter"))) return forbidden("Recruiter access required.");
  const invites = await listInvites(principal.uid);
  return NextResponse.json({
    ok: true,
    invites: invites.map((i) => ({
      token: i.token,
      name: i.name,
      email: i.email,
      jobId: i.jobId,
      status: i.status,
      createdAt: i.createdAt,
    })),
  });
}

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
  if (!(await principalHasRole(principal, "recruiter"))) return forbidden("Recruiter access required.");
  const uid = principal.uid;

  // Lightweight abuse guard on this billing-adjacent action endpoint.
  const limited = await enforceRateLimit(req, {
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
  // The gate is OPT-IN via PAYMENTS_ENABLED. While it's off (the pilot default),
  // invites send free. When an operator sets PAYMENTS_ENABLED=true, this fails
  // closed in production until a real verified entitlement/provider is wired —
  // a client `paid` flag is never honoured.
  const paymentsEnabled = process.env.PAYMENTS_ENABLED === "true";
  if (isProd && paymentsEnabled) {
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
    const validCandidates = candidates
      .filter((c) => c && typeof c === "object" && isShortString(c.email) && isShortString(c.name))
      .map((c) => ({ name: c.name as string, email: c.email as string }));

    // Generate REAL, persisted, tokenised invite links into the assessment flow.
    // (The actual email send is a separate concern that needs an email provider —
    // here the recruiter copies/sends the links; `emailDispatched` says so plainly.)
    const invites = await createInvites(recruiterId, jobId, getPublicBaseUrl(req), validCandidates);

    // Auto-send the invite emails IF an email provider is configured; otherwise
    // the recruiter copies the links from the UI (graceful, no-key fallback).
    let emailsSent = 0;
    if (isEmailConfigured()) {
      const job = (await listJobs(recruiterId)).find((j) => j.id === jobId);
      emailsSent = await sendInviteEmails(invites, job?.title);
    }

    return NextResponse.json({
      ok: true,
      status: "links_queued",
      recruiterId,
      jobId,
      received: candidates.length,
      queued: invites.length,
      inviteBatchId: `batch_${jobId}_${Math.random().toString(36).slice(2, 8)}`,
      invites: invites.map((i) => ({ name: i.name, email: i.email, link: i.link })),
      emailDispatched: emailsSent > 0,
      emailsSent,
      nextStep:
        emailsSent > 0
          ? `${emailsSent} invite email${emailsSent === 1 ? "" : "s"} sent automatically.`
          : "Copy each link to the candidate. Add RESEND_API_KEY to auto-send emails.",
    });
  } catch (err) {
    logger.error("candidate-list failed", { uid, jobId, err: String(err) });
    return NextResponse.json(
      { ok: false, error: isProd ? "Unable to queue candidate links" : String(err) },
      { status: 500 }
    );
  }
}
