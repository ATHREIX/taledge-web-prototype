import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPrincipal, unauthorized, forbidden, getPublicBaseUrl } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createShareLink, getInstituteRecord, canAdministerInstitute, listCandidatesByInstitute } from "@/lib/talent-store";
import { sendRecruiterShareEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const runtime = "nodejs";

/**
 * Generate a scoped, expiring recruiter access link for an institute (PRD §4.6).
 * The returned token IS the access credential for the shared recruiter view.
 */
export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const limited = await enforceRateLimit(req, { uid: principal.uid, limit: 20, windowMs: 60_000, scope: "institute-share-link" });
  if (limited) return limited;

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }
  const instituteId = typeof body.instituteId === "string" ? body.instituteId : "";
  if (!instituteId) return NextResponse.json({ ok: false, error: "instituteId required" }, { status: 400 });

  const inst = await getInstituteRecord(instituteId);
  if (!inst) return NextResponse.json({ ok: false, error: "Unknown institute" }, { status: 404 });

  // OWNERSHIP: only an admin of THIS institute may mint a recruiter link to its
  // cohort. Open in demo; fail-closed once auth is enforced.
  if (!(await canAdministerInstitute(instituteId, principal.uid, principal.demo))) {
    return forbidden("You are not an admin of this institute");
  }

  // SHORTLIST (optional): restrict the link to a hand-picked set. Enforce the
  // SAME consent gate as the shared view — only students who published to
  // recruiters can be included. Silently drop the rest and report the count.
  const rawIds = Array.isArray(body.studentIds)
    ? body.studentIds.filter((v: unknown): v is string => typeof v === "string" && !!v)
    : [];
  let studentIds: string[] = [];
  let skipped = 0;
  if (rawIds.length) {
    const consented = new Set(
      (await listCandidatesByInstitute(instituteId))
        .filter((c) => c.publishedToRecruiters === true)
        .map((c) => c.id)
    );
    const uniq = Array.from(new Set<string>(rawIds));
    studentIds = uniq.filter((id) => consented.has(id));
    skipped = uniq.length - studentIds.length;
    if (studentIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "None of the selected students have consented to recruiter sharing yet." },
        { status: 400 }
      );
    }
  }

  const recruiterEmail =
    typeof body.recruiterEmail === "string" && EMAIL_RE.test(body.recruiterEmail.trim())
      ? body.recruiterEmail.trim()
      : "";

  const defaultLabel = studentIds.length
    ? `${inst.name} · shortlist (${studentIds.length})`
    : `${inst.name} · recruiter access`;
  const label = typeof body.label === "string" && body.label ? body.label : defaultLabel;

  const link = await createShareLink(instituteId, label, { studentIds, recruiterEmail });
  const path = `/recruiter/shared/${link.token}`;

  // Best-effort email (no-op unless RESEND_API_KEY is set — never blocks the link).
  let emailed = false;
  if (recruiterEmail) {
    const fullLink = new URL(path, getPublicBaseUrl(req)).toString();
    emailed = await sendRecruiterShareEmail({
      to: recruiterEmail,
      instituteName: inst.name,
      link: fullLink,
      count: studentIds.length,
    });
  }

  return NextResponse.json({
    ok: true,
    token: link.token,
    path,
    expiresAt: link.expiresAt,
    count: studentIds.length,
    skipped,
    emailed,
  });
}
