import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { listJobs, createJob, deleteJob, type Job } from "@/lib/talent-store";

export const runtime = "nodejs";

const cap = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n).trim() : "");

/** List the authenticated recruiter's job & internship postings (PRD §4.5). */
export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const limited = enforceRateLimit(req, { uid: principal.uid, limit: 60, windowMs: 60_000, scope: "recruiter-jobs" });
  if (limited) return limited;
  const jobs = await listJobs(principal.uid);
  return NextResponse.json({ ok: true, jobs });
}

/** Create a job (1–3 yr) or internship (fresher) posting. */
export async function POST(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const limited = enforceRateLimit(req, { uid: principal.uid, limit: 20, windowMs: 60_000, scope: "recruiter-jobs-write" });
  if (limited) return limited;

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const title = cap(body.title, 120);
  if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
  const type: Job["type"] = body.type === "internship" ? "internship" : "job";
  // Internships are the fresher segment; jobs default to the 1–3 yr segment.
  const experience: Job["experience"] = body.experience === "1-3" || body.experience === "fresher"
    ? body.experience
    : type === "internship" ? "fresher" : "1-3";
  const skills = Array.isArray(body.skills)
    ? body.skills.map((s: unknown) => cap(s, 40)).filter(Boolean).slice(0, 20)
    : cap(body.skills, 400).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);

  const job: Job = {
    id: `job-${principal.uid}-${Date.now()}-${Math.floor(performance.now()) % 1000}`,
    recruiterId: principal.uid,
    title,
    type,
    experience,
    location: cap(body.location, 120),
    ctc: cap(body.ctc, 60),
    skills,
    description: cap(body.description, 2000),
    status: "open",
    createdAt: Date.now(),
  };
  await createJob(job);
  return NextResponse.json({ ok: true, job });
}

/** Delete a posting by id (owner-scoped). */
export async function DELETE(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();
  const limited = enforceRateLimit(req, { uid: principal.uid, limit: 30, windowMs: 60_000, scope: "recruiter-jobs-write" });
  if (limited) return limited;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const ok = await deleteJob(id, principal.uid);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
