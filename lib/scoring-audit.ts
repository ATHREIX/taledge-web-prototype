import { adminDb, isAdminConfigured } from "./firebase-admin";
import { logger } from "./logger";

/**
 * Scoring audit ledger — one document per Fit Score generation.
 *
 * Purpose: make every score CROSS-CHECKABLE after the fact. The live interview
 * session (and its per-answer ratings) expires after 6h and the client's
 * localStorage is device-bound, so without this ledger there is no durable
 * record of HOW a score was reached — only the final report. This collection
 * stores the full evidence chain: transcript snapshot, the per-question ×
 * component matrix the scorer emitted, the raw LLM headline numbers, the
 * server-computed (anti-hallucination) headline numbers, and their drift.
 *
 * Drift (|llmFit - computedFit|) is the primary scoring-quality metric: a
 * rising trend means the model's holistic judgement is diverging from its own
 * evidence-grounded sub-scores, i.e. the rubric prompt needs retuning.
 */

const COLLECTION = "scoringAudits";

/** Bump when the fit-score prompt/rubric changes materially, so audits are
 *  comparable only within the same prompt generation. */
export const SCORING_PROMPT_VERSION = 4;

type Msg = { role: "assistant" | "user"; content: string };

export type PerQuestionCell = {
  q: number;
  /** Short restatement of the interviewer's question. */
  question: string;
  /** The candidate's answer (capped). */
  answer: string;
  /** Per-answer score 0-100 (post-hoc, from the scoring pass). */
  answerScore: number;
  /** Component-row contributions for THIS answer, keyed by the exact rubric
   *  row label. Only rows this answer produced evidence for. */
  cells: Record<string, number>;
  /** One-line evidence/rationale for the cells. */
  evidence: string;
};

export type ScoringAudit = {
  studentId: string;
  uid: string;
  candidateName: string;
  targetRole: string;
  track: "placement" | "exam";
  model: string;
  promptVersion: number;
  ts: number;
  /** Transcript snapshots (content capped) — durable copy, since sessions expire. */
  transcripts: {
    technical: Msg[];
    behavioural: Msg[];
    final: Msg[];
  };
  /** Per-question × component evidence matrix emitted by the scorer. */
  perQuestionMatrix: PerQuestionCell[];
  /** EXACTLY what resume data the scorer was given (the dispute-settler when a
   *  candidate claims "my resume said something else"). Empty strings/arrays
   *  when nothing was provided. */
  resumeInputs: {
    summary: string;
    skills: string[];
    projects: { title: string; stack: string[]; impact: string }[];
    /** The JD text the resume was scored against (role-specific or generic fallback). */
    jdText: string;
  };
  /** Quoted evidence grounding each resume row score (rule 7quater). */
  resumeRowEvidence: { row: string; evidence: string }[];
  /** True when NO resume payload existed → resume component dropped from fit. */
  resumePending: boolean;
  /** Fingerprint of the resume scored now vs the ones each round was conducted
   *  with (lib/resume-hash) — the resume-swap forensic trail. */
  resumeHashAtScoring: string;
  interviewResumeHashes: Record<string, string>;
  resumeChangedMidFlow: boolean;
  /** The 20 rubric row scores (flattened "Group · Row" -> 0-100). */
  rowScores: Record<string, number>;
  /** Raw LLM headline numbers (before the anti-hallucination recomputation). */
  llmHeadline: { technical: number; behavioural: number; fit: number; success: number };
  /** Server-recomputed headline numbers (what the report shows). */
  computedHeadline: { technical: number; behavioural: number; fit: number; success: number };
  /** |llm fit - computed fit| — scoring-quality drift metric. */
  drift: number;
  crossFlags: { label: string; verdict: string; tone: string }[];
  /** Success-probability penalty actually applied from flags. */
  penaltyApplied: number;
};

const capMsgs = (msgs: Msg[], perMsg = 1200, maxMsgs = 120): Msg[] =>
  msgs.slice(0, maxMsgs).map((m) => ({ role: m.role, content: m.content.slice(0, perMsg) }));

/** Best-effort write — an audit failure must NEVER fail the scoring response. */
export async function saveScoringAudit(audit: ScoringAudit): Promise<string | null> {
  if (!isAdminConfigured || !adminDb) return null; // demo/local: no durable audit
  try {
    const doc = {
      ...audit,
      transcripts: {
        technical: capMsgs(audit.transcripts.technical),
        behavioural: capMsgs(audit.transcripts.behavioural),
        final: capMsgs(audit.transcripts.final),
      },
      perQuestionMatrix: audit.perQuestionMatrix.slice(0, 60).map((p) => ({
        ...p,
        question: String(p.question || "").slice(0, 300),
        answer: String(p.answer || "").slice(0, 1200),
        evidence: String(p.evidence || "").slice(0, 400),
      })),
    };
    const ref = await adminDb.collection(COLLECTION).add(doc);
    return ref.id;
  } catch (e) {
    logger.error("scoring-audit: save failed (non-fatal)", { studentId: audit.studentId, err: String(e) });
    return null;
  }
}

/** Latest audits for a student (newest first). */
export async function listScoringAudits(studentId: string, limit = 10): Promise<(ScoringAudit & { id: string })[]> {
  if (!isAdminConfigured || !adminDb) return [];
  try {
    const snap = await adminDb
      .collection(COLLECTION)
      .where("studentId", "==", studentId)
      .orderBy("ts", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ScoringAudit) }));
  } catch (e) {
    // Composite-index misses etc. degrade to an unordered fetch.
    try {
      const snap = await adminDb!.collection(COLLECTION).where("studentId", "==", studentId).limit(limit).get();
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as ScoringAudit) }))
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    } catch (e2) {
      logger.warn("scoring-audit: list failed", { studentId, err: String(e2) });
      return [];
    }
  }
}
