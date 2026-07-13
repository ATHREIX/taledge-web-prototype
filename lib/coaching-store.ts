import "server-only";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { COLLECTIONS } from "@/lib/firestore/schema";

/**
 * Durable, owner-scoped coaching-session store. Mirrors the talent-store
 * hybrid: Firestore (collection `coachingSessions`, one doc per session, each
 * carrying `ownerUid`) when firebase-admin is configured, else a JSON file in
 * the OS temp dir. Replaces the previous in-memory Map that lost every session
 * on cold start / redeploy and never shared across serverless instances.
 *
 * Each principal only ever reads/writes rows where `ownerUid === their uid`, so
 * a caller can never see another user's sessions.
 */
export type CoachingSession = {
  id: string;
  ownerUid: string;
  studentId: string;
  coachId: string;
  track: "placement" | "exam";
  topic: string;
  status: "scheduled";
  scheduledFor: string | null;
  privacy: string;
  createdAt: number;
};

const COL = COLLECTIONS.coachingSessions;
const useFirestore = () => isAdminConfigured && !!adminDb;

const DIR = path.join(os.tmpdir(), "taledge-talent");
const FILE = path.join(DIR, "coaching-sessions.json");

type FileShape = { sessions: Record<string, CoachingSession> };
function loadFile(): FileShape {
  try {
    return fs.existsSync(FILE)
      ? (JSON.parse(fs.readFileSync(FILE, "utf8")) as FileShape)
      : { sessions: {} };
  } catch {
    return { sessions: {} };
  }
}
function saveFile(d: FileShape) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } catch (e) {
    logger.error("[coaching-store] saveFile failed", { err: String(e) });
  }
}

/** A coach/owner's sessions, newest first. */
export async function listCoachingSessions(ownerUid: string): Promise<CoachingSession[]> {
  if (useFirestore()) {
    try {
      const snap = await adminDb!.collection(COL).where("ownerUid", "==", ownerUid).get();
      return snap.docs
        .map((d) => d.data() as CoachingSession)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    } catch (e) {
      logger.error("[coaching-store] list failed; file fallback", { err: String(e) });
    }
  }
  return Object.values(loadFile().sessions)
    .filter((s) => s.ownerUid === ownerUid)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** Persist one session (owner-scoped via its `ownerUid`). */
export async function addCoachingSession(session: CoachingSession): Promise<void> {
  if (useFirestore()) {
    try {
      await adminDb!.collection(COL).doc(session.id).set(session);
      return;
    } catch (e) {
      logger.error("[coaching-store] add failed; file fallback", { err: String(e) });
    }
  }
  const f = loadFile();
  f.sessions[session.id] = session;
  saveFile(f);
}
