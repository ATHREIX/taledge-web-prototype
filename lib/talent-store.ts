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
import { COLLECTIONS } from "@/lib/firestore/schema";
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

/**
 * A durable exam-aspirant record = the seed `ExamAspirant` shape PLUS the
 * institute-scoping + real-result facets an assessment upsert carries. Mirrors
 * how a CandidateRecord extends Student. Every added field is OPTIONAL so a
 * plain seed `ExamAspirant` is a valid record and `listExamAspirants` keeps
 * returning `ExamAspirant[]` unchanged.
 */
export type ExamAspirantRecord = ExamAspirant & {
  /** Which institute owns this aspirant (institute exam-cohort scoping). Empty
   *  for a self-serve aspirant not bound to an institute cohort. */
  instituteId?: string;
  /** The cohort/batch within the institute (e.g. "UPSC 2026"). */
  cohort?: string;
  /** Headline exam scores from the assessment — same shape as a candidate's fit
   *  block (technical/behavioural/fit/successProbability). */
  fit?: Student["fit"];
  /** Durable full Fit Score report JSON (survives device switch / storage clear). */
  fitReportJson?: string;
  /** Epoch ms the fitReportJson was written. */
  fitReportTs?: number;
  /** "seed" = demo data; "interview" = upserted from a real assessment result. */
  sourcedFrom?: "seed" | "interview";
  updatedAt?: number;
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

// Sourced from the single COLLECTIONS registry (lib/firestore/schema) so the
// name of every collection lives in exactly one place. The short keys here
// (jobs/invites/shortlists) are the local call-site names; the VALUES are the
// canonical strings from the registry — identical to before, no data change.
const COL = {
  candidates: COLLECTIONS.candidates,
  institutes: COLLECTIONS.institutes,
  examAspirants: COLLECTIONS.examAspirants,
  jobs: COLLECTIONS.recruiterJobs,
  shortlists: COLLECTIONS.recruiterShortlists,
  shareLinks: COLLECTIONS.shareLinks,
  interventions: COLLECTIONS.interventions,
  invites: COLLECTIONS.recruiterInvites,
} as const;

const useFirestore = () => isAdminConfigured && !!adminDb;

/**
 * PROD vs DEMO error policy. When admin is configured, Firestore IS the backend,
 * so a Firestore error must NOT fall through to the per-instance temp file: on
 * Cloud Run that store is ephemeral + per-instance, so a silent fallback means
 * lost writes and seed-only reads that diverge across the fleet. Rethrow so the
 * caller surfaces a real, retryable error. In local/demo (no admin creds) the
 * file store is the real backend, so just log and let the caller proceed to it.
 */
function onFirestoreError(scope: string, e: unknown): void {
  logger.error(`[talent-store] ${scope} failed`, { err: String(e) });
  if (isAdminConfigured) throw e instanceof Error ? e : new Error(String(e));
}

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

/** A minimal base ExamAspirant for an aspirant that has NO seed persona (e.g. an
 *  institute exam-cohort invitee). The upsert patch fills the real result fields;
 *  the wellbeing trends/indices stay neutral until a tracking signal feeds them.
 *  Analogous to seedCandidate's bare-record path in upsertCandidate. */
function blankExamAspirant(id: string, name: string): ExamAspirant {
  return {
    id,
    name: name || "Aspirant",
    avatar: "",
    exam: "",
    attempt: "",
    monthsPreparing: 0,
    successPotential: 0,
    motivation: 0,
    consistency: 0,
    resilience: 0,
    stressIndex: 0,
    risks: [],
    consistencyTrend: [],
    moodTrend: [],
    studyHoursTrend: [],
    institute: "",
  };
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

/**
 * Firestore reads return class instances (Timestamp) and other non-plain values.
 * Passing those from a Server Component into a Client Component throws
 * "Only plain objects ... can be passed to Client Components" (a candidate doc
 * whose createdAt/updatedAt were Timestamps crashed /student/<id>). Deep-convert
 * to plain, JSON-safe data: Timestamps -> epoch millis, everything else
 * recursively plainified.
 */
function toPlain<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const v = value as any;
  // Firestore Timestamp: admin SDK exposes toMillis(); the raw shape has _seconds.
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v._seconds === "number" && typeof v._nanoseconds === "number") {
    return (v._seconds * 1000 + Math.round(v._nanoseconds / 1e6)) as any;
  }
  if (Array.isArray(value)) return value.map((x) => toPlain(x)) as any;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v)) out[k] = toPlain(v[k]);
  return out as T;
}

async function readCollection<T>(collection: string, seed: () => Record<string, T>): Promise<T[]> {
  if (useFirestore()) {
    try {
      let snap = await adminDb!.collection(collection).get();
      if (snap.empty) {
        await seedFirestoreCollection(collection, seed());
        snap = await adminDb!.collection(collection).get();
      }
      return snap.docs.map((d) => toPlain(d.data()) as T);
    } catch (e) {
      onFirestoreError(`read ${collection}`, e);
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
      return snap.docs.map((d) => toPlain(d.data()) as T);
    } catch (e) {
      onFirestoreError(`indexed query ${collection}.${field}`, e);
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
      if (snap.exists) return toPlain(snap.data()) as CandidateRecord;
    } catch (e) {
      onFirestoreError("getCandidate", e);
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
      onFirestoreError("upsertCandidate", e);
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

/** One exam aspirant's durable record (seed OR real result), or null. Mirrors
 *  getCandidate — used by the exam workspace hub to show real results. */
export async function getExamAspirant(id: string): Promise<ExamAspirantRecord | null> {
  if (useFirestore()) {
    try {
      const snap = await adminDb!.collection(COL.examAspirants).doc(id).get();
      if (snap.exists) return toPlain(snap.data()) as ExamAspirantRecord;
    } catch (e) {
      onFirestoreError("getExamAspirant", e);
    }
  }
  const f = loadFile();
  return (f.examAspirants?.[id] as ExamAspirantRecord) ?? null;
}

/**
 * Upsert an exam (Track 2) aspirant's assessment result into the SAME
 * examAspirants collection the institute exam-cohort view reads. Mirrors
 * upsertCandidate exactly: same dual backend (Firestore | file), same
 * onFirestoreError policy, same seed-or-prior merge — so a real exam aspirant's
 * result actually lands in the store instead of being dropped. Merges the patch
 * onto the existing (seed or prior) record; creates it from a blank base if
 * absent. Returns the merged record.
 */
export async function upsertExamAspirant(
  id: string,
  patch: Partial<ExamAspirantRecord> & { fit?: Student["fit"] }
): Promise<ExamAspirantRecord> {
  const now = Date.now();
  if (useFirestore()) {
    try {
      const ref = adminDb!.collection(COL.examAspirants).doc(id);
      const snap = await ref.get();
      const base = (snap.exists ? snap.data() : seededExam()[id]) as ExamAspirantRecord | undefined;
      const merged: ExamAspirantRecord = {
        ...(base ?? blankExamAspirant(id, patch.name ?? "")),
        ...patch,
        id,
        sourcedFrom: "interview",
        updatedAt: now,
      };
      await ref.set(merged, { merge: true });
      return merged;
    } catch (e) {
      onFirestoreError("upsertExamAspirant", e);
    }
  }
  const f = loadFile();
  const base = f.examAspirants[id] ?? blankExamAspirant(id, patch.name ?? "");
  const merged: ExamAspirantRecord = { ...base, ...patch, id, sourcedFrom: "interview", updatedAt: now };
  f.examAspirants[id] = merged;
  saveFile(f);
  return merged;
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
      onFirestoreError("createJob", e);
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
      onFirestoreError("deleteJob", e);
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
      onFirestoreError("getShortlist", e);
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
      onFirestoreError("setShortlist", e);
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
      onFirestoreError("createShareLink", e);
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
      onFirestoreError("getShareLink", e);
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
  // FAIL CLOSED: admin authority is EXACT `adminUids` membership only. We must
  // NOT fall back to resolveInstituteForView here — its pilot "which institute
  // does this account view" default resolves ANY uid to the placement institute,
  // which would make every logged-in user an admin of that tenant (cross-tenant
  // IDOR: reading invite tokens/PII, writing cohorts/share-links/interventions).
  // A real institute admin is granted access by seeding their uid into adminUids.
  const inst = await getInstituteRecord(instituteId);
  return !!inst && Array.isArray(inst.adminUids) && inst.adminUids.includes(uid);
}

/**
 * The stakeholder role stored at users/{uid}.role (server-side read), or null.
 * Used to authorize the institute DASHBOARD PAGE: an institute-role account with
 * no explicit adminUids binding may still view the pilot placement tenant (the
 * documented unbound-institute fallback), while non-institute accounts cannot.
 * Fail-closed: any read error returns null (→ access denied), never elevates.
 */
export async function getUserRole(uid: string): Promise<string | null> {
  if (!useFirestore()) return null;
  try {
    const snap = await adminDb!.collection("users").doc(uid).get();
    return snap.exists ? ((snap.data()?.role as string) ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * May this uid administer this institute — the single authorization used by BOTH
 * the dashboard page (read) AND the write actions (cohort, share links,
 * interventions), so a pilot account can't view the dashboard yet 403 on every
 * button. Grants access ONLY on exact `adminUids` membership (or demo). The old
 * pilot fallback — any institute-ROLE account administering the default tenants —
 * was REMOVED: `users/{uid}.role` is client-writable, so it let any signed-in user
 * self-assign role:"institute" and read a tenant's cohort PII + invite tokens
 * (candidate credentials → account takeover). Real institute admins must now be
 * bound via adminUids (scripts/bind-institute-admin). Fail-closed for everyone else.
 */
/**
 * The institute a real admin should land on — their bound tenant, or (for a
 * genuine institute-role account with NO binding) a freshly self-provisioned
 * EMPTY tenant of their own.
 *
 * WHY: the old pilot fallback ("any institute-role account administers the
 * default placement tenant") was removed as a cross-tenant IDOR, but that left
 * unbound institute accounts 404ing on their OWN workspace — the "university
 * login → click placement → thrown out" bug. Self-provisioning is safe where
 * the old fallback was not: the account only ever gets an empty tenant scoped
 * to itself (adminUids: [uid]), never another tenant's cohort/PII. users/…role
 * is client-writable, so the worst a self-assigned "institute" role yields is
 * an empty dashboard of your own.
 */
export async function ensureOwnInstituteForAdmin(uid: string): Promise<Institute | null> {
  if (!uid) return null;
  const all = await listInstitutes();
  const bound = all.find((i) => Array.isArray(i.adminUids) && i.adminUids.includes(uid));
  if (bound) return bound;
  const role = await getUserRole(uid);
  if (role !== "institute") return null;

  const id = `inst-${uid.slice(0, 12)}`;
  const existing = all.find((i) => i.id === id);
  if (existing) return existing;

  // Name the tenant from the account's own profile when available.
  let name = "Your Institute";
  if (useFirestore()) {
    try {
      const snap = await adminDb!.collection("users").doc(uid).get();
      const d = snap.data() as { institution?: string; fullName?: string } | undefined;
      name = d?.institution?.trim() || (d?.fullName ? `${d.fullName.trim()}'s Institute` : name);
    } catch {
      /* cosmetic only */
    }
  }
  const inst: Institute = {
    id,
    adminUids: [uid],
    name,
    kind: "placement",
    cohort: 0,
    interviewReady: 0,
    avgFit: 0,
    topGap: "-",
    insights: [],
    batches: [],
  };
  if (useFirestore()) {
    try {
      await adminDb!.collection(COL.institutes).doc(id).set(inst);
      return inst;
    } catch (e) {
      onFirestoreError("ensureOwnInstituteForAdmin", e);
    }
  }
  const f = loadFile();
  f.institutes[id] = inst;
  saveFile(f);
  return inst;
}

export async function canAdministerInstitute(
  instituteId: string,
  uid: string,
  demo: boolean
): Promise<boolean> {
  if (demo) return true;
  return isInstituteAdmin(instituteId, uid, false);
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
      for (const d of [...pub.docs, ...own.docs]) merged.set(d.id, toPlain(d.data()) as CandidateRecord);
      return Array.from(merged.values());
    } catch (e) {
      onFirestoreError("listRecruiterVisibleCandidates", e);
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
      onFirestoreError("createInvites", e);
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
      onFirestoreError("createInstituteInvites", e);
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
      onFirestoreError("getInvite", e);
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
      onFirestoreError("updateInviteStatus", e);
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
    catch (e) { onFirestoreError("createIntervention", e); }
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
    } catch (e) { onFirestoreError("updateInterventionStatus", e); }
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
