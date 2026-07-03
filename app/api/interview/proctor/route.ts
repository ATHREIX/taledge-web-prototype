import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession, incrementProctorViolations, MAX_PROCTOR_VIOLATIONS } from "@/lib/session-store";
import { getPrincipal, unauthorized, forbidden } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";

export const runtime = "nodejs";

// Server-authoritative proctoring sink. The client reports each violation /
// successful face check here; the SERVER owns the count and the blocked state,
// so a page reload can no longer reset the candidate's violation tally (the #1
// audit finding — proctoring previously lived only in client React state).
// Threshold is owned by the session store (single source of truth for the
// server-authoritative count + the atomic increment path).
const MAX_VIOLATIONS = MAX_PROCTOR_VIOLATIONS;
const MAX_REASON = 300;

type Body = {
  sessionId?: string;
  event?: "violation" | "verified";
  reason?: string;
};

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  const limited = await enforceRateLimit(req, { uid, limit: 60, windowMs: 60000, scope: "interview-proctor" });
  if (limited) return limited;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body.sessionId !== "string" || !body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  if (body.event !== "violation" && body.event !== "verified") {
    return NextResponse.json({ error: "event must be 'violation' or 'verified'" }, { status: 400 });
  }
  const reason =
    typeof body.reason === "string" ? body.reason.slice(0, MAX_REASON) : "unspecified";

  const session = await getSession(body.sessionId);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.ownerUid !== uid) return forbidden();

  if (body.event === "verified") {
    await updateSession(body.sessionId, { faceVerified: true });
    return NextResponse.json({ ok: true, faceVerified: true });
  }

  // event === "violation" — ATOMIC increment in the store (a racy read+write
  // here previously let concurrent reports both read N and write N+1, dropping
  // violations so a cheater could slip past MAX_VIOLATIONS).
  const result = await incrementProctorViolations(body.sessionId);
  if (!result) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const { violations: proctorViolations, blocked } = result;
  logger.info("[proctor] violation", { uid, sessionId: body.sessionId, proctorViolations, blocked, reason: isProd ? undefined : reason });

  return NextResponse.json({ ok: true, proctorViolations, blocked, max: MAX_VIOLATIONS });
}
