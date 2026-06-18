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
  mode: "technical" | "behavioural";
  resumeSummary?: string;
  /** Compact DNLA report (competency scores vs benchmark) used to tailor questions. */
  dnlaSummary?: string;
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
// Use the OS temp dir (writable on serverless like Vercel; the project dir is
// read-only there). This is the DEMO/local fallback only — production should
// configure firebase-admin so sessions persist in Firestore instead.
const SESSION_DIR = path.join(os.tmpdir(), "taledge-sessions");
const SESSION_FILE = path.join(SESSION_DIR, "sessions.json");

const useFirestore = () => isAdminConfigured && !!adminDb;

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
  mode: "technical" | "behavioural";
  resumeSummary?: string;
  dnlaSummary?: string;
}): Promise<SessionState> {
  const now = Date.now();
  const session: SessionState = {
    sessionId: params.sessionId,
    ownerUid: params.ownerUid,
    studentId: params.studentId,
    role: params.role,
    mode: params.mode,
    resumeSummary: params.resumeSummary,
    dnlaSummary: params.dnlaSummary,
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
    await adminDb!.collection(COLLECTION).doc(params.sessionId).set(session);
  } else {
    const all = prune(loadAll());
    all[params.sessionId] = session;
    saveAll(all);
  }
  return session;
}

export async function getSession(sessionId: string): Promise<SessionState | null> {
  if (useFirestore()) {
    const snap = await adminDb!.collection(COLLECTION).doc(sessionId).get();
    if (!snap.exists) return null;
    const s = snap.data() as SessionState;
    if (s.expiresAt && s.expiresAt < Date.now()) return null;
    return s;
  }
  const all = prune(loadAll());
  return all[sessionId] ?? null;
}

export async function updateSession(
  sessionId: string,
  updates: Partial<SessionState>
): Promise<SessionState | null> {
  if (useFirestore()) {
    const ref = adminDb!.collection(COLLECTION).doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const updated = { ...(snap.data() as SessionState), ...updates, updatedAt: Date.now() };
    await ref.set(updated, { merge: true });
    return updated;
  }
  const all = prune(loadAll());
  const session = all[sessionId];
  if (!session) return null;
  const updated: SessionState = { ...session, ...updates, updatedAt: Date.now() };
  all[sessionId] = updated;
  saveAll(all);
  return updated;
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (useFirestore()) {
    await adminDb!.collection(COLLECTION).doc(sessionId).delete();
    return;
  }
  const all = loadAll();
  delete all[sessionId];
  saveAll(all);
}
