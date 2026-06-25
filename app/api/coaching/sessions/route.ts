import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";
import { listCoachingSessions, addCoachingSession, type CoachingSession } from "@/lib/coaching-store";

export const runtime = "nodejs";

const MAX_FIELD_LEN = 200;

function isShortString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= MAX_FIELD_LEN;
}

export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  const sessions = await listCoachingSessions(uid);
  return NextResponse.json({ ok: true, sessions });
}

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const uid = principal.uid;

  let body: {
    studentId?: unknown;
    coachId?: unknown;
    track?: unknown;
    topic?: unknown;
    scheduledFor?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !isShortString(body.studentId) ||
    !isShortString(body.coachId) ||
    !isShortString(body.topic) ||
    (body.track !== "placement" && body.track !== "exam")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "studentId, coachId, topic, and a valid track ('placement' | 'exam') are required",
      },
      { status: 400 }
    );
  }

  if (
    body.scheduledFor !== undefined &&
    body.scheduledFor !== null &&
    !isShortString(body.scheduledFor)
  ) {
    return NextResponse.json(
      { ok: false, error: "scheduledFor must be a string when provided" },
      { status: 400 }
    );
  }

  try {
    const studentId = body.studentId as string;
    const coachId = body.coachId as string;
    const track = body.track as "placement" | "exam";
    const topic = body.topic as string;
    const scheduledFor = (body.scheduledFor as string | undefined) || null;

    const session: CoachingSession = {
      id: `sess_${studentId}_${Math.random().toString(36).slice(2, 8)}`,
      ownerUid: uid,
      studentId,
      coachId,
      track,
      topic,
      status: "scheduled",
      scheduledFor,
      privacy:
        track === "exam"
          ? "exam risk indicators remain restricted to candidate, counsellor, and exam institute"
          : "placement development insights visible to authorized placement stakeholders",
      createdAt: Date.now(),
    };

    // Durably persist owner-scoped (Firestore or file) so it survives restarts
    // and is shared across serverless instances — no longer an in-memory Map.
    await addCoachingSession(session);

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    logger.error("coaching/sessions POST failed", { err: String(err) });
    return NextResponse.json(
      {
        ok: false,
        error: isProd ? "Unable to create coaching session" : String(err),
      },
      { status: 500 }
    );
  }
}
