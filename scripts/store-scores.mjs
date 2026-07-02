/**
 * Store computed interview scores back to Firestore.
 * Reads reports/<Name>-report-data.json (produced by interview-report.mjs) and
 * writes:
 *   1. interviewSessions/<id>.aiEvaluation  (scores attached to the session)
 *   2. candidates/<ownerUid>.fit + fitReportJson  (app shape; stays PRIVATE —
 *      publishedToRecruiters is NOT set, so recruiters don't see it)
 *
 * Usage: node scripts/store-scores.mjs <sessionId> <Name>
 *   defaults: 8f68dd7f-... / Sumit
 */
import fs from "node:fs";
import dotenv from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
dotenv.config({ path: ".env.local" });
initializeApp({ credential: cert(JSON.parse(fs.readFileSync("./serviceAccount.json", "utf8"))) });
const db = getFirestore();

const id = process.argv[2] || "8f68dd7f-fe44-4e72-8428-52c5fc9e4b20";
const name = process.argv[3] || "Sumit";
const data = JSON.parse(fs.readFileSync(`reports/${name}-report-data.json`, "utf8"));

const sessRef = db.collection("interviewSessions").doc(id);
const sess = (await sessRef.get()).data();
if (!sess) { console.error("session not found: " + id); process.exit(1); }
const uid = sess.ownerUid;

const evaluation = {
  fit: data.fit,
  successProbability: data.success,
  technicalScore: data.techScore,
  behaviouralScore: data.behavScore,   // -1 = stage pending
  status: data.status,
  verdict: data.verdict,
  narrative: data.narrative,
  strengths: data.strengths || [],
  weaknesses: data.weaknesses || [],
  // Firestore forbids nested arrays (breakdown rows are [label, score] tuples),
  // so the full breakdown is stored as a JSON string — same pattern the app uses
  // for fitReportJson.
  reportJson: JSON.stringify({
    technical_breakdown: data.technical_breakdown || [],
    resume_breakdown: data.resume_breakdown || [],
    behavioural_breakdown: data.behavioural_breakdown || [],
    cross_flags: data.cross_flags || [],
  }),
  scoredFrom: "priorInterviews",
  scoredBy: "scripts/interview-report.mjs",
  generatedAt: Date.now(),
};

// 1. Attach to the session (new field, does not touch transcript/rubricScores).
await sessRef.set({ aiEvaluation: evaluation, updatedAt: Date.now() }, { merge: true });
console.log(`✓ interviewSessions/${id}.aiEvaluation written (fit=${data.fit})`);

// 2. Candidate record (app shape). Private: publishedToRecruiters NOT set.
const candRef = db.collection("candidates").doc(uid);
const fitObj = {
  ...(data.techScore >= 0 ? { technical: data.techScore } : {}),
  ...(data.behavScore >= 0 ? { behavioural: data.behavScore } : {}),
  fit: data.fit,
  successProbability: data.success,
};
await candRef.set({
  name: name,
  targetRole: sess.role || "",
  fit: fitObj,
  status: data.status,
  verified: true,
  resumeSummary: sess.resumeSummary || "",
  fitReportJson: JSON.stringify({
    technical_score: data.techScore,
    behavioural_score: data.behavScore,
    fit_score: data.fit,
    success_probability: data.success,
    verdict: data.verdict,
    narrative: data.narrative,
    technical_breakdown: data.technical_breakdown,
    resume_breakdown: data.resume_breakdown,
    behavioural_breakdown: data.behavioural_breakdown,
    cross_flags: data.cross_flags,
  }),
  fitReportTs: Date.now(),
  updatedAt: Date.now(),
}, { merge: true });
// Clear a stale fit.behavioural subfield when the behavioural stage is pending
// (merge writes never remove keys, so an earlier bad value would linger).
if (data.behavScore < 0) {
  await candRef.update({ "fit.behavioural": FieldValue.delete() });
}
console.log(`✓ candidates/${uid} written (private — not published to recruiters)`);

// verify
const v = (await candRef.get()).data();
console.log("\nStored fit:", JSON.stringify(v.fit), "| status:", v.status, "| published:", !!v.publishedToRecruiters);
process.exit(0);
