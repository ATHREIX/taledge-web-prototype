import "server-only";
/**
 * Interview voice-session store.
 *
 * Backend selection is automatic:
 *   - Firebase Admin configured  -> Firestore collection `interviewSessions`
 *     (one doc per session, atomic updates, owner-scoped, TTL via `expiresAt`).
 *   - Otherwise (local/demo)      -> JSON file under .sessions/ (dev only).
 *
 * All functions are async. Every session carries `ownerUid`; callers MUST
 * enforce `session.ownerUid === principal.uid` before returning data.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";

export interface TranscriptEntry {
  timestamp: number;
  role: "assistant" | "user";
  content: string;
}

export interface SessionState {
  sessionId: string;
  /** Authenticated owner. Authorization subject for all reads/writes. */
  ownerUid: string;
  studentId: string;
  role: string;
  /** Interview stage:
   *  - "technical"/"behavioural" = the AI interview rounds
   *  - "dnla"  = DNLA behavioural interview (provider questions, Gemini fallback)
   *  - "final" = final round that combines the AI + DNLA interviews */
  mode: "technical" | "behavioural" | "dnla" | "final";
  /** Which product track this interview belongs to. Drives interviewer persona:
   * "placement" = job/role interview, "exam" = competitive-exam readiness. */
  track?: "placement" | "exam";
  resumeSummary?: string;
  /** Compact DNLA report (competency scores vs benchmark) used to tailor questions. */
  dnlaSummary?: string;
  /** Condensed transcripts of the earlier rounds (AI + DNLA), passed to the
   * "final" interview so its questions build on what already happened. */
  priorInterviews?: string;
  /** Fingerprint of the resume this round was conducted with (lib/resume-hash). */
  resumeHash?: string;
  transcript: TranscriptEntry[];
  turnIndex: number;
  isDone: boolean;
  /** Proctoring state — server-authoritative so a page reload cannot reset it. */
  proctorViolations: number;
  blocked: boolean;
  faceVerified: boolean;
  rubricScores: Record<string, number>;
  recruiterNotes: string;
  followUpNeeded: boolean;
  createdAt: number;
  updatedAt: number;
  /** Epoch ms after which the session is considered expired. */
  expiresAt: number;
}

const TTL_MS = 6 * 60 * 60 * 1000; // 6h
const COLLECTION = "interviewSessions";
/** Proctoring: a candidate is blocked once violations REACH this count. Owned
 *  server-side so it stays consistent with the atomic increment path below. */
export const MAX_PROCTOR_VIOLATIONS = 3;
// Use the OS temp dir (writable on serverless like Vercel; the project dir is
// read-only there). This is the DEMO/local fallback only — production should
// configure firebase-admin so sessions persist in Firestore instead.
const SESSION_DIR = path.join(os.tmpdir(), "taledge-sessions");
const SESSION_FILE = path.join(SESSION_DIR, "sessions.json");

const useFirestore = () => isAdminConfigured && !!adminDb;

/**
 * PROD vs DEMO error policy. When admin is configured, Firestore IS the session
 * backend, so a Firestore error must NOT fall through to the per-instance temp
 * file: on Cloud Run that store is ephemeral + per-instance, so a silent
 * fallback would strand a session on one instance and lose it on the next.
 * Rethrow so the caller surfaces a real, retryable error. In local/demo (no
 * admin creds) the file store is the real backend, so just log and continue.
 */
function onFirestoreError(scope: string, e: unknown): void {
  logger.error(`[session-store] ${scope} failed`, { err: String(e) });
  if (isAdminConfigured) throw e instanceof Error ? e : new Error(String(e));
}

/**
 * Firestore rejects the ENTIRE write when any field value is `undefined`
 * (e.g. an optional resumeSummary/dnlaSummary/priorInterviews that wasn't sent),
 * which 500'd every non-final interview start in prod. Drop those keys before
 * writing; the file fallback tolerates them either way.
 */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

/* ----------------------------- file fallback ----------------------------- */
function ensureDir(): void {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
}
function loadAll(): Record<string, SessionState> {
  try {
    if (!fs.existsSync(SESSION_FILE)) return {};
    return JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
  } catch {
    return {};
  }
}
function saveAll(all: Record<string, SessionState>): void {
  ensureDir();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(all, null, 2), "utf-8");
}
function prune(all: Record<string, SessionState>): Record<string, SessionState> {
  const now = Date.now();
  for (const [k, v] of Object.entries(all)) if (v.expiresAt && v.expiresAt < now) delete all[k];
  return all;
}

/* -------------------------------- API ----------------------------------- */
export async function createSession(params: {
  sessionId: string;
  ownerUid: string;
  studentId: string;
  role: string;
  mode: "technical" | "behavioural" | "dnla" | "final";
  track?: "placement" | "exam";
  resumeSummary?: string;
  dnlaSummary?: string;
  priorInterviews?: string;
  /** Fingerprint of the resume this round was conducted with (lib/resume-hash). */
  resumeHash?: string;
}): Promise<SessionState> {
  const now = Date.now();
  const session: SessionState = {
    sessionId: params.sessionId,
    ownerUid: params.ownerUid,
    studentId: params.studentId,
    role: params.role,
    mode: params.mode,
    track: params.track || "placement",
    resumeSummary: params.resumeSummary,
    dnlaSummary: params.dnlaSummary,
    priorInterviews: params.priorInterviews,
    resumeHash: params.resumeHash,
    transcript: [],
    turnIndex: 0,
    isDone: false,
    proctorViolations: 0,
    blocked: false,
    faceVerified: false,
    rubricScores: {},
    recruiterNotes: "",
    followUpNeeded: false,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + TTL_MS,
  };

  if (useFirestore()) {
    try {
      await adminDb!.collection(COLLECTION).doc(params.sessionId).set(stripUndefined(session));
      return session;
    } catch (e) {
      // In prod this rethrows (never diverge to the per-instance file store); in
      // local/demo it degrades to the file store so the interview still works.
      onFirestoreError("createSession", e);
    }
  }
  const all = prune(loadAll());
  all[params.sessionId] = session;
  saveAll(all);
  return session;
}

export async function getSession(sessionId: string): Promise<SessionState | null> {
  if (useFirestore()) {
    try {
      const snap = await adminDb!.collection(COLLECTION).doc(sessionId).get();
      if (!snap.exists) return null;
      const s = snap.data() as SessionState;
      if (s.expiresAt && s.expiresAt < Date.now()) return null;
      return s;
    } catch (e) {
      onFirestoreError("getSession", e);
    }
  }
  const all = prune(loadAll());
  return all[sessionId] ?? null;
}

export async function updateSession(
  sessionId: string,
  updates: Partial<SessionState>
): Promise<SessionState | null> {
  if (useFirestore()) {
    try {
      const ref = adminDb!.collection(COLLECTION).doc(sessionId);
      const snap = await ref.get();
      if (!snap.exists) return null;
      const now = Date.now();
      // Write ONLY the provided fields (plus updatedAt), NOT the whole snapshot.
      // Re-persisting a stale full snapshot lets concurrent disjoint-field
      // writers clobber each other; a scoped merge lets them compose safely.
      await ref.set(stripUndefined({ ...updates, updatedAt: now }), { merge: true });
      return { ...(snap.data() as SessionState), ...updates, updatedAt: now };
    } catch (e) {
      onFirestoreError("updateSession", e);
    }
  }
  const all = prune(loadAll());
  const session = all[sessionId];
  if (!session) return null;
  const updated: SessionState = { ...session, ...updates, updatedAt: Date.now() };
  all[sessionId] = updated;
  saveAll(all);
  return updated;
}

/**
 * ATOMIC proctor-violation increment. The read-compute-write pattern in the
 * proctor route dropped concurrent violations (two near-simultaneous reports both
 * read N and wrote N+1, so a cheater could exceed MAX_PROCTOR_VIOLATIONS). In
 * Firestore mode we run a transaction so the read of the current count and the
 * write of count+1 (and the derived `blocked`) are serialised per session. In
 * demo/file mode there is a single instance, so the non-atomic path is fine.
 * Returns null when the session does not exist (caller surfaces a 404).
 */
export async function incrementProctorViolations(
  sessionId: string
): Promise<{ violations: number; blocked: boolean } | null> {
  if (useFirestore()) {
    try {
      const ref = adminDb!.collection(COLLECTION).doc(sessionId);
      return await adminDb!.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const cur = snap.data() as SessionState;
        const violations = (cur.proctorViolations || 0) + 1;
        const blocked = violations >= MAX_PROCTOR_VIOLATIONS || !!cur.blocked;
        // Scoped merge — never re-persist the whole (possibly stale) snapshot.
        tx.set(ref, { proctorViolations: violations, blocked, updatedAt: Date.now() }, { merge: true });
        return { violations, blocked };
      });
    } catch (e) {
      onFirestoreError("incrementProctorViolations", e);
    }
  }
  const all = prune(loadAll());
  const session = all[sessionId];
  if (!session) return null;
  const violations = (session.proctorViolations || 0) + 1;
  const blocked = violations >= MAX_PROCTOR_VIOLATIONS || !!session.blocked;
  session.proctorViolations = violations;
  session.blocked = blocked;
  session.updatedAt = Date.now();
  all[sessionId] = session;
  saveAll(all);
  return { violations, blocked };
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (useFirestore()) {
    try {
      await adminDb!.collection(COLLECTION).doc(sessionId).delete();
      return;
    } catch (e) {
      // Same PROD-vs-DEMO policy: in prod this rethrows (never silently diverge
      // to the per-instance file store); in local/demo it degrades to the file.
      onFirestoreError("deleteSession", e);
    }
  }
  const all = loadAll();
  delete all[sessionId];
  saveAll(all);
}
