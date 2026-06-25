import "server-only";
/**
 * Talent data store — the durable, server-side source of truth for the
 * recruiter and institute surfaces (candidates, institutes, exam aspirants,
 * recruiter job postings, and recruiter shortlists).
 *
 * Backend selection is automatic (same pattern as session-store.ts):
 *   - Firebase Admin configured -> Firestore collections.
 *   - Otherwise (local/demo)     -> a single JSON file under the OS temp dir.
 *
 * On first access each collection is SEEDED from the in-repo demo data
 * (lib/data.ts), so the dashboards render real, queryable, MUTABLE records out
 * of the box — and the moment a service-account key is added, the very same
 * code persists to Firestore instead. Candidate records are later UPSERTED with
 * real interview/DNLA results so recruiters/institutes see actual performance.
 */
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import {
  students as seedStudents,
  institutes as seedInstitutes,
  examAspirants as seedExamAspirants,
  type Student,
  type Institute,
  type ExamAspirant,
} from "@/lib/data";

/* ------------------------------- types ---------------------------------- */

/** A candidate record = the Student shape plus recruiter/institute facets. */
export type CandidateRecord = Student & {
  /** Hiring segment used by recruiter filters. Campus students default fresher. */
  experience: "fresher" | "1-3";
  /** Which institute owns this candidate (institute dashboard scoping). Empty
   *  string for an off-campus candidate that belongs to a recruiter, not an
   *  institute. */
  instituteId: string;
  /** The cohort/batch within the institute (e.g. "CSE 2026"). */
  cohort?: string;
  /** For OFF-CAMPUS candidates a recruiter invited: the owning recruiter's uid.
   *  Only that recruiter sees them in their pool (multi-recruiter isolation). */
  recruiterId?: string;
  /** The recruiter posting this candidate came in through — drives the dashboard
   *  "Posting" filter so they surface under that specific job. */
  jobId?: string;
  /** "seed" = demo data; "interview" = upserted from a real assessment result. */
  sourcedFrom: "seed" | "interview";
  /** True once the candidate publishes their report to recruiters (PRD consent). */
  publishedToRecruiters?: boolean;
  /** Epoch ms when the candidate published to recruiters. */
  publishedAt?: number;
  /** True when the candidate completed the flow under a real signed-in account
   *  (not anonymous) — recruiters see a "Verified" badge for these. */
  verified?: boolean;
  updatedAt: number;
};

export type Job = {
  id: string;
  recruiterId: string;
  title: string;
  /** "job" = 1–3 yr role, "internship" = fresher segment (per PRD §4.5). */
  type: "job" | "internship";
  experience: "fresher" | "1-3";
  location: string;
  ctc: string;
  skills: string[];
  description: string;
  status: "open" | "closed";
  createdAt: number;
};

export type Shortlist = {
  /** doc id === recruiterId (one shortlist per recruiter). */
  recruiterId: string;
  candidateIds: string[];
  updatedAt: number;
};

/** A scoped, expiring recruiter access link an institute generates (PRD §4.6). */
export type ShareLink = {
  token: string;
  instituteId: string;
  label: string;
  createdAt: number;
  expiresAt: number;
  // When set, the link exposes ONLY these (consented) student ids — a hand-picked
  // shortlist. Absent/empty ⇒ the institute's whole published pool (legacy behaviour).
  studentIds?: string[];
  // Recruiter the shortlist was emailed to (for the institute's own audit trail).
  recruiterEmail?: string;
};

/** A candidate invite a recruiter sends for an off-campus assessment (§4.5). */
export type Invite = {
  token: string;
  recruiterId: string;
  jobId: string;
  name: string;
  email: string;
  link: string;
  status: "invited" | "started" | "completed";
  createdAt: number;
  // Institute-issued invites (the institute Cohort Builder) bind the resulting
  // assessment to a cohort instead of a recruiter job. Recruiter invites leave
  // these empty; institute invites leave recruiterId/jobId empty.
  instituteId?: string;
  cohort?: string;
  track?: "placement" | "exam";
};

/** A targeted intervention an institute plans + tracks (PRD §4 / §4.4). */
export type Intervention = {
  id: string;
  instituteId: string;
  title: string;
  category: string; // Counselling · Study plan · Stress · Communication · ...
  audience: string; // whole cohort / a batch / a specific learner
  owner: string;    // coach / counsellor running it
  status: "Planned" | "In progress" | "Completed";
  note: string;
  createdAt: number;
  updatedAt: number;
};

/* ------------------------------ backend --------------------------------- */

const COL = {
  candidates: "candidates",
  institutes: "institutes",
  examAspirants: "examAspirants",
  jobs: "recruiterJobs",
  shortlists: "recruiterShortlists",
  shareLinks: "shareLinks",
  interventions: "interventions",
  invites: "recruiterInvites",
} as const;

const useFirestore = () => isAdminConfigured && !!adminDb;

// DEMO/local fallback only. Production should configure firebase-admin.
const DIR = path.join(os.tmpdir(), "taledge-talent");
const FILE = path.join(DIR, "talent.json");

type FileShape = {
  seeded?: boolean;
  candidates: Record<string, CandidateRecord>;
  institutes: Record<string, Institute>;
  examAspirants: Record<string, ExamAspirant>;
  recruiterJobs: Record<string, Job>;
  recruiterShortlists: Record<string, Shortlist>;
  shareLinks: Record<string, ShareLink>;
  interventions: Record<string, Intervention>;
  recruiterInvites: Record<string, Invite>;
};

function emptyFile(): FileShape {
  return { candidates: {}, institutes: {}, examAspirants: {}, recruiterJobs: {}, recruiterShortlists: {}, shareLinks: {}, interventions: {}, recruiterInvites: {} };
}

/* ------------------------------- seed ----------------------------------- */

/** Map a seed Student → a CandidateRecord. All campus students are freshers and
 *  belong to the placement institute in the pilot data. */
// Map a candidate's college → its institute (multi-institute tenancy). Extend
// this as real institutes onboard; unknown colleges fall to the flagship.
function instituteOf(college: string): string {
  if (/institute of technology/i.test(college)) return "institute-tech";
  return "institute-placement";
}

function seedCandidate(s: Student): CandidateRecord {
  // A brand-new/minimal record (e.g. an off-campus invite id with no college)
  // must NOT default into the flagship institute — that would leak it into a
  // real tenant's cohort. Only a known college maps to an institute.
  const isSeed = !!s.college && !!s.branch;
  return {
    ...s,
    experience: "fresher",
    instituteId: s.college ? instituteOf(s.college) : "",
    cohort: s.branch && s.year ? `${s.branch} ${s.year}` : "",
    // Seed personas represent real, account-holding, consented candidates; a
    // bare upsert-created record is none of those until it earns them.
    verified: isSeed,
    publishedToRecruiters: isSeed,
    sourcedFrom: "seed",
    updatedAt: 0,
  };
}

function seededCandidates(): Record<string, CandidateRecord> {
  const out: Record<string, CandidateRecord> = {};
  for (const s of seedStudents) out[s.id] = seedCandidate(s);
  return out;
}
function seededInstitutes(): Record<string, Institute> {
  const out: Record<string, Institute> = {};
  for (const i of seedInstitutes) out[i.id] = i;
  return out;
}
function seededExam(): Record<string, ExamAspirant> {
  const out: Record<string, ExamAspirant> = {};
  for (const a of seedExamAspirants) out[a.id] = a;
  return out;
}

/* --------------------------- file fallback ------------------------------ */

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
}
function loadFile(): FileShape {
  let data: FileShape;
  try {
    data = fs.existsSync(FILE) ? (JSON.parse(fs.readFileSync(FILE, "utf-8")) as FileShape) : emptyFile();
  } catch {
    data = emptyFile();
  }
  // Lazy, idempotent seed of any empty collection.
  let changed = false;
  if (!data.candidates || Object.keys(data.candidates).length === 0) { data.candidates = seededCandidates(); changed = true; }
  if (!data.institutes || Object.keys(data.institutes).length === 0) { data.institutes = seededInstitutes(); changed = true; }
  if (!data.examAspirants || Object.keys(data.examAspirants).length === 0) { data.examAspirants = seededExam(); changed = true; }
  if (!data.recruiterJobs) { data.recruiterJobs = {}; changed = true; }
  if (!data.recruiterShortlists) { data.recruiterShortlists = {}; changed = true; }
  if (!data.shareLinks) { data.shareLinks = {}; changed = true; }
  if (!data.interventions) { data.interventions = {}; changed = true; }
  if (!data.recruiterInvites) { data.recruiterInvites = {}; changed = true; }
  if (changed) saveFile(data);
  return data;
}
function saveFile(data: FileShape) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");
}

/* ----------------------- Firestore seed helper -------------------------- */

/** Seed a Firestore collection from a record map IF it is currently empty.
 *  Best-effort and idempotent (only writes when the collection has no docs). */
async function seedFirestoreCollection(
  collection: string,
  docs: Record<string, any>
): Promise<void> {
  try {
    const snap = await adminDb!.collection(collection).limit(1).get();
    if (!snap.empty) return; // already has data
    const batch = adminDb!.batch();
    for (const [id, doc] of Object.entries(docs)) {
      batch.set(adminDb!.collection(collection).doc(id), doc);
    }
    await batch.commit();
  } catch (e) {
    logger.error(`[talent-store] Firestore seed failed for ${collection}`, { err: String(e) });
  }
}

async function readCollection<T>(collection: string, seed: () => Record<string, T>): Promise<T[]> {
  if (useFirestore()) {
    try {
      let snap = await adminDb!.collection(collection).get();
      if (snap.empty) {
        await seedFirestoreCollection(collection, seed());
        snap = await adminDb!.collection(collection).get();
      }
      return snap.docs.map((d) => d.data() as T);
    } catch (e) {
      logger.error(`[talent-store] Firestore read ${collection} failed; file fallback`, { err: String(e) });
    }
  }
  // File fallback — pick the right slice off the seeded file.
  const f = loadFile();
  const map = (f as any)[collection] as Record<string, T> | undefined;
  return Object.values(map ?? seed());
}

/**
 * SCALE: indexed, scoped query — `WHERE field == value`. On Firestore this reads
 * ONLY the matching docs (with an index), so it stays fast at 10k+ records
 * instead of pulling the whole collection. Seeds the collection on first access.
 * The file fallback filters in-memory (fine for the local/demo dataset).
 */
async function queryByField<T>(
  collection: string,
  field: string,
  value: unknown,
  seed: () => Record<string, T>
): Promise<T[]> {
  if (useFirestore()) {
    try {
      // A `where` on an empty collection returns nothing and would skip seeding,
      // so probe + seed first on cold start.
      const probe = await adminDb!.collection(collection).limit(1).get();
      if (probe.empty) await seedFirestoreCollection(collection, seed());
      const snap = await adminDb!.collection(collection).where(field as any, "==", value as any).get();
      return snap.docs.map((d) => d.data() as T);
    } catch (e) {
      logger.error(`[talent-store] indexed query ${collection}.${field} failed; file fallback`, { err: String(e) });
    }
  }
  const f = loadFile();
  const map = ((f as any)[collection] as Record<string, T>) ?? seed();
  return Object.values(map).filter((d: any) => d?.[field] === value);
}

/* -------------------------------- API ----------------------------------- */

export async function listCandidates(): Promise<CandidateRecord[]> {
  return readCollection<CandidateRecord>(COL.candidates, seededCandidates);
}

export async function getCandidate(id: string): Promise<CandidateRecord | null> {
  if (useFirestore()) {
    try {
      const snap = await adminDb!.collection(COL.candidates).doc(id).get();
      if (snap.exists) return snap.data() as CandidateRecord;
    } catch (e) {
      logger.error("[talent-store] getCandidate failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  return f.candidates[id] ?? null;
}

/**
 * Upsert a candidate's assessment result. Merges the provided fields onto the
 * existing (seed or prior) record so recruiters/institutes see REAL scores once
 * a candidate completes the interview/DNLA flow. Creates the record if absent.
 */
export async function upsertCandidate(
  id: string,
  patch: Partial<CandidateRecord> & { fit?: Student["fit"]; dnla?: Student["dnla"] }
): Promise<CandidateRecord> {
  const now = Date.now();
  if (useFirestore()) {
    try {
      const ref = adminDb!.collection(COL.candidates).doc(id);
      const snap = await ref.get();
      const base = (snap.exists ? snap.data() : seededCandidates()[id]) as CandidateRecord | undefined;
      const merged: CandidateRecord = {
        ...(base ?? (seedCandidate(seedStudents.find((s) => s.id === id) ?? ({ id } as Student)))),
        ...patch,
        id,
        sourcedFrom: "interview",
        updatedAt: now,
      };
      await ref.set(merged, { merge: true });
      return merged;
    } catch (e) {
      logger.error("[talent-store] upsertCandidate failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  const base = f.candidates[id] ?? seedCandidate(seedStudents.find((s) => s.id === id) ?? ({ id } as Student));
  const merged: CandidateRecord = { ...base, ...patch, id, sourcedFrom: "interview", updatedAt: now };
  f.candidates[id] = merged;
  saveFile(f);
  return merged;
}

export async function listInstitutes(): Promise<Institute[]> {
  return readCollection<Institute>(COL.institutes, seededInstitutes);
}
export async function getInstituteRecord(id: string): Promise<Institute | null> {
  const all = await listInstitutes();
  return all.find((i) => i.id === id) ?? null;
}

/**
 * Resolve the institute a viewer should see from a route param that may be EITHER
 * an institute doc-id (demo mode / direct links like `institute-placement`) OR a
 * logged-in user's uid (enforced mode, where nav builds `/institute/<uid>`).
 *
 * Order: (1) exact doc-id, (2) institute whose `adminUids` contains the uid,
 * (3) pilot fallback to the default placement institute so a freshly-registered
 * institute account still lands on a working dashboard instead of a hard 404.
 * Returns null only if there are no institutes at all.
 */
export async function resolveInstituteForView(idOrUid: string): Promise<Institute | null> {
  const all = await listInstitutes();
  const direct = all.find((i) => i.id === idOrUid);
  if (direct) return direct;
  const byAdmin = all.find(
    (i) => Array.isArray(i.adminUids) && i.adminUids.includes(idOrUid)
  );
  if (byAdmin) return byAdmin;
  return all.find((i) => i.id === "institute-placement") ?? all[0] ?? null;
}
export async function listExamAspirants(): Promise<ExamAspirant[]> {
  return readCollection<ExamAspirant>(COL.examAspirants, seededExam);
}

/* ------------------------------- jobs ----------------------------------- */

export async function listJobs(recruiterId?: string): Promise<Job[]> {
  // SCALE: scoped to one recruiter via an indexed query; only the admin/all view
  // reads the whole collection.
  const rows = recruiterId
    ? await queryByField<Job>(COL.jobs, "recruiterId", recruiterId, () => ({}))
    : await readCollection<Job>(COL.jobs, () => ({}));
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createJob(job: Job): Promise<Job> {
  if (useFirestore()) {
    try {
      await adminDb!.collection(COL.jobs).doc(job.id).set(job);
      return job;
    } catch (e) {
      logger.error("[talent-store] createJob failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  f.recruiterJobs[job.id] = job;
  saveFile(f);
  return job;
}

export async function deleteJob(id: string, recruiterId: string): Promise<boolean> {
  if (useFirestore()) {
    try {
      const ref = adminDb!.collection(COL.jobs).doc(id);
      const snap = await ref.get();
      if (!snap.exists || (snap.data() as Job).recruiterId !== recruiterId) return false;
      await ref.delete();
      return true;
    } catch (e) {
      logger.error("[talent-store] deleteJob failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  const j = f.recruiterJobs[id];
  if (!j || j.recruiterId !== recruiterId) return false;
  delete f.recruiterJobs[id];
  saveFile(f);
  return true;
}

/* ---------------------------- shortlists -------------------------------- */

export async function getShortlist(recruiterId: string): Promise<string[]> {
  if (useFirestore()) {
    try {
      const snap = await adminDb!.collection(COL.shortlists).doc(recruiterId).get();
      return snap.exists ? (snap.data() as Shortlist).candidateIds ?? [] : [];
    } catch (e) {
      logger.error("[talent-store] getShortlist failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  return f.recruiterShortlists[recruiterId]?.candidateIds ?? [];
}

export async function setShortlist(recruiterId: string, candidateIds: string[]): Promise<string[]> {
  const clean = Array.from(new Set(candidateIds.filter(Boolean))).slice(0, 1000);
  const doc: Shortlist = { recruiterId, candidateIds: clean, updatedAt: Date.now() };
  if (useFirestore()) {
    try {
      await adminDb!.collection(COL.shortlists).doc(recruiterId).set(doc);
      return clean;
    } catch (e) {
      logger.error("[talent-store] setShortlist failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  f.recruiterShortlists[recruiterId] = doc;
  saveFile(f);
  return clean;
}

/* --------------------------- share links -------------------------------- */

const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Generate a scoped, expiring recruiter access link for an institute (§4.6). */
export async function createShareLink(
  instituteId: string,
  label: string,
  opts?: { studentIds?: string[]; recruiterEmail?: string }
): Promise<ShareLink> {
  const link: ShareLink = {
    token: crypto.randomBytes(16).toString("hex"),
    instituteId,
    label: (label || "Recruiter access").slice(0, 120),
    createdAt: Date.now(),
    expiresAt: Date.now() + SHARE_TTL_MS,
  };
  // Only set optional fields when present — Firestore rejects `undefined` values.
  const ids = (opts?.studentIds ?? []).filter((v) => typeof v === "string" && v);
  if (ids.length) link.studentIds = Array.from(new Set(ids)).slice(0, 500);
  if (opts?.recruiterEmail) link.recruiterEmail = opts.recruiterEmail.slice(0, 200);
  if (useFirestore()) {
    try {
      await adminDb!.collection(COL.shareLinks).doc(link.token).set(link);
      return link;
    } catch (e) {
      logger.error("[talent-store] createShareLink failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  f.shareLinks[link.token] = link;
  saveFile(f);
  return link;
}

/** Resolve a share token to its (non-expired) link, or null. */
export async function getShareLink(token: string): Promise<ShareLink | null> {
  if (useFirestore()) {
    try {
      const snap = await adminDb!.collection(COL.shareLinks).doc(token).get();
      if (!snap.exists) return null;
      const l = snap.data() as ShareLink;
      return l.expiresAt && l.expiresAt < Date.now() ? null : l;
    } catch (e) {
      logger.error("[talent-store] getShareLink failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  const l = f.shareLinks[token];
  return l && (!l.expiresAt || l.expiresAt >= Date.now()) ? l : null;
}

/** Candidates belonging to one institute (institute dashboard / shared view). */
/**
 * Authorization: may this uid administer this institute? Used to gate
 * institute-admin writes (share links, interventions). FAIL-CLOSED in enforced
 * auth: an institute with no adminUids configured denies everyone. Callers pass
 * `demo` (principal.demo) to keep the open demo browsable.
 */
export async function isInstituteAdmin(instituteId: string, uid: string, demo: boolean): Promise<boolean> {
  if (demo) return true; // demo mode is intentionally open
  const inst = await getInstituteRecord(instituteId);
  if (inst && Array.isArray(inst.adminUids) && inst.adminUids.includes(uid)) return true;
  // PILOT FALLBACK: an institute account not bound to any institute (e.g. a fresh
  // signup) administers the institute it RESOLVES to — the same one its dashboard
  // view falls back to (resolveInstituteForView). Without this, such an account
  // could view the dashboard but every admin action (share link, add students,
  // interventions) would 403. Strictly-bound institutes stay scoped: their admins
  // resolve to their own institute, never someone else's.
  const resolved = await resolveInstituteForView(uid);
  return !!resolved && resolved.id === instituteId;
}

/** SCALE: one institute's cohort via an indexed `instituteId ==` query (not a
 *  full-collection scan), so it stays fast at 10k+ candidates. */
export async function listCandidatesByInstitute(instituteId: string): Promise<CandidateRecord[]> {
  return queryByField<CandidateRecord>(COL.candidates, "instituteId", instituteId, seededCandidates);
}

/** SCALE: the candidates ONE recruiter may see — the globally published pool
 *  PLUS their own off-campus invitees — via two indexed queries merged + deduped
 *  (Firestore has no cross-field OR index; two `==` lookups are the scalable
 *  shape). File fallback filters in-memory. */
export async function listRecruiterVisibleCandidates(recruiterId: string): Promise<CandidateRecord[]> {
  if (useFirestore()) {
    try {
      const probe = await adminDb!.collection(COL.candidates).limit(1).get();
      if (probe.empty) await seedFirestoreCollection(COL.candidates, seededCandidates());
      const [pub, own] = await Promise.all([
        adminDb!.collection(COL.candidates).where("publishedToRecruiters", "==", true).get(),
        adminDb!.collection(COL.candidates).where("recruiterId", "==", recruiterId).get(),
      ]);
      const merged = new Map<string, CandidateRecord>();
      for (const d of [...pub.docs, ...own.docs]) merged.set(d.id, d.data() as CandidateRecord);
      return Array.from(merged.values());
    } catch (e) {
      logger.error("[talent-store] listRecruiterVisibleCandidates failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  return Object.values(f.candidates).filter(
    (c) => c.publishedToRecruiters || c.recruiterId === recruiterId
  );
}

/* ----------------------------- invites ---------------------------------- */

/** Create real, persisted invite links for an off-campus candidate batch (§4.5).
 *  Each candidate gets a unique tokenised link into the assessment flow. The
 *  actual email dispatch is a separate concern (needs an email provider). */
export async function createInvites(
  recruiterId: string,
  jobId: string,
  origin: string,
  candidates: { name: string; email: string }[]
): Promise<Invite[]> {
  const now = Date.now();
  const invites: Invite[] = candidates.map((c) => {
    const token = crypto.randomBytes(12).toString("hex");
    return {
      token,
      recruiterId,
      jobId,
      name: c.name,
      email: c.email,
      link: `${origin}/onboarding?invite=${token}`,
      status: "invited" as const,
      createdAt: now,
    };
  });
  if (useFirestore()) {
    try {
      const batch = adminDb!.batch();
      for (const inv of invites) batch.set(adminDb!.collection(COL.invites).doc(inv.token), inv);
      await batch.commit();
      return invites;
    } catch (e) {
      logger.error("[talent-store] createInvites failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  for (const inv of invites) f.recruiterInvites[inv.token] = inv;
  saveFile(f);
  return invites;
}

/** A recruiter's sent invites, newest first (indexed `recruiterId ==` query). */
export async function listInvites(recruiterId: string): Promise<Invite[]> {
  const rows = await queryByField<Invite>(COL.invites, "recruiterId", recruiterId, () => ({}));
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

/** Create persisted invite links for an INSTITUTE cohort (PRD §4). Each student
 *  gets a unique tokenised link into the assessment flow; the completed result
 *  binds back to this institute/cohort (not to a recruiter). recruiterId/jobId
 *  are intentionally empty — these students are NOT auto-shared to recruiters
 *  (that's the separate consent/publish step §4.6). */
export async function createInstituteInvites(
  instituteId: string,
  cohort: string,
  track: "placement" | "exam",
  origin: string,
  candidates: { name: string; email: string }[]
): Promise<Invite[]> {
  const now = Date.now();
  const invites: Invite[] = candidates.map((c) => {
    const token = crypto.randomBytes(12).toString("hex");
    return {
      token,
      recruiterId: "",
      jobId: "",
      instituteId,
      cohort,
      track,
      name: c.name,
      email: c.email,
      link: `${origin}/onboarding?invite=${token}`,
      status: "invited" as const,
      createdAt: now,
    };
  });
  if (useFirestore()) {
    try {
      const batch = adminDb!.batch();
      for (const inv of invites) batch.set(adminDb!.collection(COL.invites).doc(inv.token), inv);
      await batch.commit();
      return invites;
    } catch (e) {
      logger.error("[talent-store] createInstituteInvites failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  for (const inv of invites) f.recruiterInvites[inv.token] = inv;
  saveFile(f);
  return invites;
}

/** An institute's sent cohort invites, newest first (indexed `instituteId ==`). */
export async function listInstituteInvites(instituteId: string): Promise<Invite[]> {
  const rows = await queryByField<Invite>(COL.invites, "instituteId", instituteId, () => ({}));
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

/** Resolve a single invite by its token (the off-campus link credential). */
export async function getInvite(token: string): Promise<Invite | null> {
  if (useFirestore()) {
    try {
      const doc = await adminDb!.collection(COL.invites).doc(token).get();
      return doc.exists ? (doc.data() as Invite) : null;
    } catch (e) {
      logger.error("[talent-store] getInvite failed; file fallback", { err: String(e) });
    }
  }
  return loadFile().recruiterInvites[token] ?? null;
}

/** Advance an invite's status as the candidate moves through the flow
 *  (invited → started → completed), so the recruiter/institute can track
 *  progress. MONOTONIC: only ever advances — a later partial re-generation can
 *  never regress a "completed" invite back to "started". */
const INVITE_STATUS_RANK: Record<Invite["status"], number> = { invited: 0, started: 1, completed: 2 };
export async function updateInviteStatus(token: string, status: Invite["status"]): Promise<void> {
  const next = INVITE_STATUS_RANK[status] ?? 0;
  if (useFirestore()) {
    try {
      const ref = adminDb!.collection(COL.invites).doc(token);
      const snap = await ref.get();
      if (!snap.exists) return;
      const cur = (snap.data() as Invite).status;
      if ((INVITE_STATUS_RANK[cur] ?? 0) >= next) return; // never regress
      await ref.set({ status }, { merge: true });
      return;
    } catch (e) {
      logger.error("[talent-store] updateInviteStatus failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  const inv = f.recruiterInvites[token];
  if (inv && (INVITE_STATUS_RANK[inv.status] ?? 0) < next) {
    inv.status = status;
    saveFile(f);
  }
}

/* --------------------------- interventions ------------------------------ */

/** Institute's planned/tracked interventions, newest first (indexed query). */
export async function listInterventions(instituteId: string): Promise<Intervention[]> {
  const rows = await queryByField<Intervention>(COL.interventions, "instituteId", instituteId, () => ({}));
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createIntervention(i: Intervention): Promise<Intervention> {
  if (useFirestore()) {
    try { await adminDb!.collection(COL.interventions).doc(i.id).set(i); return i; }
    catch (e) { logger.error("[talent-store] createIntervention failed; file fallback", { err: String(e) }); }
  }
  const f = loadFile();
  f.interventions[i.id] = i;
  saveFile(f);
  return i;
}

/** Advance an intervention's status (track improvement) — owner institute only. */
export async function updateInterventionStatus(
  id: string,
  instituteId: string,
  status: Intervention["status"]
): Promise<Intervention | null> {
  if (useFirestore()) {
    try {
      const ref = adminDb!.collection(COL.interventions).doc(id);
      const snap = await ref.get();
      if (!snap.exists || (snap.data() as Intervention).instituteId !== instituteId) return null;
      const updated = { ...(snap.data() as Intervention), status, updatedAt: Date.now() };
      await ref.set(updated, { merge: true });
      return updated;
    } catch (e) { logger.error("[talent-store] updateInterventionStatus failed; file fallback", { err: String(e) }); }
  }
  const f = loadFile();
  const cur = f.interventions[id];
  if (!cur || cur.instituteId !== instituteId) return null;
  const updated = { ...cur, status, updatedAt: Date.now() };
  f.interventions[id] = updated;
  saveFile(f);
  return updated;
}

/* ---------------------- derived recruiter view -------------------------- */

/** DNLA group averages (0-100) for the recruiter's advanced multi-criteria
 *  filters (PRD §4.5: "high resilience + high initiative + ..."). The four
 *  groups are consistent across all candidates, so this is robust regardless of
 *  the underlying competency labels. */
export type DnlaGroups = { achievement: number; interpersonal: number; execution: number; resilience: number };

function dnlaGroupScores(dnla: Student["dnla"]): DnlaGroups {
  const buckets: Record<string, number[]> = {
    "Achievement Dynamics": [], "Interpersonal Skills": [], Execution: [], "Stress & Resilience": [],
  };
  for (const d of dnla ?? []) if (buckets[d.group]) buckets[d.group].push(d.score);
  const avg = (a: number[]) => (a.length ? Math.round(((a.reduce((x, y) => x + y, 0) / a.length) / 7) * 100) : 0);
  return {
    achievement: avg(buckets["Achievement Dynamics"]),
    interpersonal: avg(buckets["Interpersonal Skills"]),
    execution: avg(buckets["Execution"]),
    resilience: avg(buckets["Stress & Resilience"]),
  };
}

export type RecruiterCandidateRow = {
  studentId: string;
  name: string;
  avatar: string;
  college: string;
  role: string;
  experience: "fresher" | "1-3";
  fit: number;
  tech: number;
  behav: number;
  success: number;
  dnlaReady: boolean;
  dnlaGroups: DnlaGroups;
  flags: string[];
  status: Student["status"];
  published: boolean;
  publishedAt: number;
  verified: boolean;
  jobId: string;
};

/** Flatten candidate records into the recruiter table row shape. NULL-SAFE: a
 *  record missing `fit` (e.g. a candidate published before scoring) must never
 *  throw — one bad record would otherwise 500 the entire recruiter pool. */
export function toRecruiterRow(c: CandidateRecord): RecruiterCandidateRow {
  const fit = c.fit ?? { technical: 0, behavioural: 0, fit: 0, successProbability: 0 };
  return {
    studentId: c.id,
    name: c.name ?? "Candidate",
    avatar: c.avatar ?? "",
    college: c.college ?? "",
    role: c.targetRole ?? "",
    experience: c.experience ?? "fresher",
    fit: fit.fit ?? 0,
    tech: fit.technical ?? 0,
    behav: fit.behavioural ?? 0,
    success: fit.successProbability ?? 0,
    dnlaReady: (c.dnla?.length ?? 0) > 0,
    dnlaGroups: dnlaGroupScores(c.dnla),
    flags: c.risks ?? [],
    status: c.status ?? "Not started",
    published: !!c.publishedToRecruiters,
    publishedAt: c.publishedAt ?? 0,
    verified: !!c.verified,
    jobId: c.jobId ?? "",
  };
}
