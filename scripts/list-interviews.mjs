/**
 * List interview sessions with identifying fields so you can pick one.
 * Usage: node scripts/list-interviews.mjs
 */
import fs from "node:fs";
import dotenv from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

dotenv.config({ path: ".env.local" });
const SA_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccount.json";
if (!fs.existsSync(SA_PATH)) {
  console.error("No service account at " + SA_PATH);
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(SA_PATH, "utf8"))) });
const db = getFirestore();

const snap = await db.collection("interviewSessions").limit(500).get();
const rows = snap.docs.map((d) => {
  const s = d.data();
  const tx = s.transcript || [];
  const answers = tx.filter((t) => t.role === "user" && (t.content || "").trim()).length;
  const ts = s.updatedAt || s.createdAt;
  const when = ts?.toDate ? ts.toDate().toISOString().slice(0, 16).replace("T", " ") : "—";
  return {
    id: d.id,
    email: s.email || s.candidateEmail || "—",
    name: s.name || s.studentName || "—",
    studentId: s.studentId || "—",
    ownerUid: s.ownerUid || "—",
    role: s.role || "—",
    answers,
    when,
  };
});
rows.sort((a, b) => (b.when > a.when ? 1 : -1));
console.log(`Total sessions: ${rows.length}\n`);
for (const r of rows) {
  console.log(
    `${r.id}\n  name=${r.name}  email=${r.email}  studentId=${r.studentId}\n  role=${r.role}  answers=${r.answers}  updated=${r.when}  ownerUid=${r.ownerUid}\n`
  );
}
process.exit(0);
