import "server-only";
/**
 * DNLA assessment store — one doc per participant assessment (keyed by TAN).
 *
 * Backend selection mirrors lib/session-store.ts:
 *   - Firebase Admin configured -> Firestore collection `dnlaSessions`
 *     (scales to thousands of concurrent candidates; this is the production path).
 *   - Otherwise (local/demo)     -> JSON file under the OS temp dir (dev only).
 *
 * The TAN is the join key between OUR candidate and DNLA's assessment. The
 * completion webhook references the TAN (and supplies DNLA's numeric result id),
 * so we can correlate a finished questionnaire back to the right candidate.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import type { NormalizedDnla } from "@/lib/dnla-mapping";

export type DnlaSessionStatus = "pending" | "complete" | "error";

export interface DnlaSession {
  /** Public TAN (primary key + join key with DNLA). */
  tan: string;
  /** Authenticated owner — authorization subject for reads. */
  ownerUid: string;
  /** The candidate/workspace id this assessment belongs to (e.g. candidate-001). */
  candidateId: string;
  status: DnlaSessionStatus;
  /** DNLA-hosted questionnaire URL the candidate is sent to. */
  startUrl: string;
  /** DNLA internal numeric session id — learned from the completion webhook. */
  resultId?: string | null;
  /** Normalized, axis-mapped scores once complete (feeds the Fit Score). */
  normalized?: NormalizedDnla | null;
  error?: string | null;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number | null;
  /** Epoch ms after which the record may be pruned (dev file store only). */
  expiresAt: number;
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COLLECTION = "dnlaSessions";
const DIR = path.join(os.tmpdir(), "taledge-dnla");
const FILE = path.join(DIR, "dnla.json");

const useFirestore = () => isAdminConfigured && !!adminDb;

/* ----------------------------- file fallback ----------------------------- */
function loadAll(): Record<string, DnlaSession> {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return {};
  }
}
function saveAll(all: Record<string, DnlaSession>): void {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2), "utf-8");
}

/* -------------------------------- API ----------------------------------- */
export async function createDnlaSession(params: {
  tan: string;
  ownerUid: string;
  candidateId: string;
  startUrl: string;
}): Promise<DnlaSession> {
  const now = Date.now();
  const session: DnlaSession = {
    tan: params.tan,
    ownerUid: params.ownerUid,
    candidateId: params.candidateId,
    status: "pending",
    startUrl: params.startUrl,
    resultId: null,
    normalized: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    expiresAt: now + TTL_MS,
  };
  if (useFirestore()) {
    try {
      await adminDb!.collection(COLLECTION).doc(params.tan).set(session);
      return session;
    } catch (e) {
      logger.error("[dnla-store] Firestore create failed; file fallback", { err: String(e) });
    }
  }
  const all = loadAll();
  all[params.tan] = session;
  saveAll(all);
  return session;
}

export async function getDnlaSessionByTan(tan: string): Promise<DnlaSession | null> {
  if (useFirestore()) {
    try {
      const snap = await adminDb!.collection(COLLECTION).doc(tan).get();
      return snap.exists ? (snap.data() as DnlaSession) : null;
    } catch (e) {
      logger.error("[dnla-store] Firestore get failed; file fallback", { err: String(e) });
    }
  }
  return loadAll()[tan] ?? null;
}

export async function updateDnlaSession(
  tan: string,
  updates: Partial<DnlaSession>
): Promise<DnlaSession | null> {
  if (useFirestore()) {
    try {
      const ref = adminDb!.collection(COLLECTION).doc(tan);
      const snap = await ref.get();
      if (snap.exists) {
        const updated = { ...(snap.data() as DnlaSession), ...updates, updatedAt: Date.now() };
        await ref.set(updated, { merge: true });
        return updated;
      }
      return null;
    } catch (e) {
      logger.error("[dnla-store] Firestore update failed; file fallback", { err: String(e) });
    }
  }
  const all = loadAll();
  const s = all[tan];
  if (!s) return null;
  const updated: DnlaSession = { ...s, ...updates, updatedAt: Date.now() };
  all[tan] = updated;
  saveAll(all);
  return updated;
}

/**
 * Most recent assessment for a candidate (drives the candidate-facing status
 * poll). Owner-scoped so one candidate can never read another's result.
 */
export async function getLatestDnlaForCandidate(
  ownerUid: string,
  candidateId: string
): Promise<DnlaSession | null> {
  if (useFirestore()) {
    try {
      const q = await adminDb!
        .collection(COLLECTION)
        .where("ownerUid", "==", ownerUid)
        .where("candidateId", "==", candidateId)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      return q.empty ? null : (q.docs[0].data() as DnlaSession);
    } catch (e) {
      logger.error("[dnla-store] Firestore query failed; file fallback", { err: String(e) });
    }
  }
  const all = Object.values(loadAll())
    .filter((s) => s.ownerUid === ownerUid && s.candidateId === candidateId)
    .sort((a, b) => b.createdAt - a.createdAt);
  return all[0] ?? null;
}
