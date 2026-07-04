import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPrincipal, unauthorized, forbidden } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getInstituteRecord, listInterventions, createIntervention, updateInterventionStatus, canAdministerInstitute, type Intervention } from "@/lib/talent-store";

export const runtime = "nodejs";

const cap = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n).trim() : "");

/** List an institute's planned/tracked interventions (PRD §4 / §4.4). */
export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const limited = await enforceRateLimit(req, { uid: principal.uid, limit: 60, windowMs: 60_000, scope: "institute-interventions" });
  if (limited) return limited;
  const instituteId = new URL(req.url).searchParams.get("instituteId") || "";
  if (!instituteId) return NextResponse.json({ ok: false, error: "instituteId required" }, { status: 400 });
  if (!(await canAdministerInstitute(instituteId, principal.uid, principal.demo))) return forbidden("You are not an admin of this institute");
  return NextResponse.json({ ok: true, interventions: await listInterventions(instituteId) });
}

/** Plan a new intervention. */
export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const limited = await enforceRateLimit(req, { uid: principal.uid, limit: 30, windowMs: 60_000, scope: "institute-interventions-write" });
  if (limited) return limited;

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }
  const instituteId = cap(body.instituteId, 120);
  const title = cap(body.title, 160);
  if (!instituteId || !title) return NextResponse.json({ ok: false, error: "instituteId and title are required." }, { status: 400 });
  if (!(await getInstituteRecord(instituteId))) return NextResponse.json({ ok: false, error: "Unknown institute" }, { status: 404 });
  if (!(await canAdministerInstitute(instituteId, principal.uid, principal.demo))) return forbidden("You are not an admin of this institute");

  const intervention: Intervention = {
    id: `iv-${instituteId}-${Date.now()}-${Math.floor(performance.now()) % 1000}`,
    instituteId,
    title,
    category: cap(body.category, 60) || "General",
    audience: cap(body.audience, 120) || "Whole cohort",
    owner: cap(body.owner, 120) || "Unassigned",
    status: "Planned",
    note: cap(body.note, 1000),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await createIntervention(intervention);
  return NextResponse.json({ ok: true, intervention });
}

/** Advance an intervention's status (track improvement). */
export async function PATCH(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const limited = await enforceRateLimit(req, { uid: principal.uid, limit: 60, windowMs: 60_000, scope: "institute-interventions-write" });
  if (limited) return limited;
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }
  const id = cap(body.id, 200);
  const instituteId = cap(body.instituteId, 120);
  const status = body.status;
  if (!id || !instituteId || !["Planned", "In progress", "Completed"].includes(status)) {
    return NextResponse.json({ ok: false, error: "id, instituteId and a valid status are required." }, { status: 400 });
  }
  if (!(await canAdministerInstitute(instituteId, principal.uid, principal.demo))) return forbidden("You are not an admin of this institute");
  const updated = await updateInterventionStatus(id, instituteId, status);
  return NextResponse.json({ ok: !!updated, intervention: updated }, { status: updated ? 200 : 404 });
}
