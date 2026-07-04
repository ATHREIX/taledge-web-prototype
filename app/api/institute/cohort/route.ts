import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPrincipal, unauthorized, forbidden } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";
import {
  createInstituteInvites,
  listInstituteInvites,
  listCandidatesByInstitute,
  getInstituteRecord,
  canAdministerInstitute,
} from "@/lib/talent-store";
import { isEmailConfigured, sendInviteEmails } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Institute Cohort Builder (PRD §4). An institute admin adds students to a
 * cohort and sends them assessment-invite links; the completed results bind
 * back to THIS institute's cohort (via the invite token, server-side).
 *
 * GET  ?instituteId=  -> { cohort: <assessed students>, invites: <pending invites> }
 * POST { instituteId, cohort?, track?, students:[{name,email}] } -> creates invites
 */

const MAX_STUDENTS = 500;
const MAX_FIELD_LEN = 200;

function isShortString(v: unknown, max = MAX_FIELD_LEN): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

async function ownsOrForbidden(instituteId: string, uid: string, demo: boolean) {
  const inst = await getInstituteRecord(instituteId);
  if (!inst) return { error: NextResponse.json({ ok: false, error: "Unknown institute" }, { status: 404 }) };
  if (!(await canAdministerInstitute(instituteId, uid, demo))) {
    return { error: forbidden("You are not an admin of this institute") };
  }
  return { inst };
}

export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();

  const instituteId = req.nextUrl.searchParams.get("instituteId") || "";
  if (!instituteId) return NextResponse.json({ ok: false, error: "instituteId required" }, { status: 400 });

  const gate = await ownsOrForbidden(instituteId, principal.uid, principal.demo);
  if (gate.error) return gate.error;

  const [cohort, invites] = await Promise.all([
    listCandidatesByInstitute(instituteId),
    listInstituteInvites(instituteId),
  ]);

  // Surface only what the management view needs (no heavy nested fields).
  return NextResponse.json({
    ok: true,
    instituteId,
    cohort: cohort.map((c) => ({
      id: c.id,
      name: c.name,
      cohort: (c as { cohort?: string }).cohort ?? "",
      status: c.status ?? "",
      fit: c.fit?.fit ?? null,
      verified: (c as { verified?: boolean }).verified ?? false,
      published: (c as { publishedToRecruiters?: boolean }).publishedToRecruiters ?? false,
    })),
    invites: invites.map((i) => ({
      token: i.token,
      name: i.name,
      email: i.email,
      cohort: i.cohort ?? "",
      status: i.status,
      link: i.link,
      createdAt: i.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();

  const limited = await enforceRateLimit(req, {
    uid: principal.uid,
    limit: 30,
    windowMs: 60_000,
    scope: "institute-cohort",
  });
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const instituteId = typeof body.instituteId === "string" ? body.instituteId : "";
  if (!instituteId) return NextResponse.json({ ok: false, error: "instituteId required" }, { status: 400 });

  const gate = await ownsOrForbidden(instituteId, principal.uid, principal.demo);
  if (gate.error) return gate.error;

  const track: "placement" | "exam" = body.track === "exam" ? "exam" : "placement";
  const cohort = isShortString(body.cohort) ? body.cohort.trim() : "";

  if (!Array.isArray(body.students)) {
    return NextResponse.json({ ok: false, error: "students must be an array" }, { status: 400 });
  }
  if (body.students.length > MAX_STUDENTS) {
    return NextResponse.json({ ok: false, error: `students exceeds maximum of ${MAX_STUDENTS}` }, { status: 400 });
  }

  // De-dupe by email and keep only valid {name,email} rows.
  const seen = new Set<string>();
  const valid = body.students
    .filter((s: unknown): s is { name: string; email: string } =>
      !!s && typeof s === "object" && isShortString((s as any).name) && isShortString((s as any).email)
    )
    .map((s: { name: string; email: string }) => ({ name: s.name.trim(), email: s.email.trim() }))
    .filter((s: { email: string }) => {
      const key = s.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (valid.length === 0) {
    return NextResponse.json({ ok: false, error: "No valid students (each needs a name and email)." }, { status: 400 });
  }

  try {
    const invites = await createInstituteInvites(instituteId, cohort, track, req.nextUrl.origin, valid);

    // Auto-send invite emails IF a provider is configured; else the institute
    // copies the links from the UI (graceful, no-key fallback).
    let emailsSent = 0;
    if (isEmailConfigured()) {
      emailsSent = await sendInviteEmails(invites, cohort ? `${cohort} cohort assessment` : "Cohort assessment");
    }

    return NextResponse.json({
      ok: true,
      instituteId,
      cohort,
      received: body.students.length,
      queued: invites.length,
      invites: invites.map((i) => ({ name: i.name, email: i.email, link: i.link })),
      emailsSent,
      nextStep:
        emailsSent > 0
          ? `${emailsSent} invite email${emailsSent === 1 ? "" : "s"} sent automatically.`
          : "Copy each link to the student. Add RESEND_API_KEY to auto-send emails.",
    });
  } catch (err) {
    logger.error("institute-cohort failed", { uid: principal.uid, instituteId, err: String(err) });
    return NextResponse.json(
      { ok: false, error: isProd ? "Unable to create cohort invites" : String(err) },
      { status: 500 }
    );
  }
}
