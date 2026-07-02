/** Score the priorInterviews Q&A of a session via Gemini (mirrors app rubric). */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
dotenv.config({ path: ".env.local" });
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
initializeApp({ credential: cert(JSON.parse(fs.readFileSync("./serviceAccount.json", "utf8"))) });
const db = getFirestore();
const id = process.argv[2] || "8f68dd7f-fe44-4e72-8428-52c5fc9e4b20";
const s = (await db.collection("interviewSessions").doc(id).get()).data();
const name = (s.priorInterviews || "").match(/Hello\s+([A-Z][A-Za-z ]+?),/)?.[1] || "Candidate";
const p = s.priorInterviews || "";

// parse Interviewer/Candidate turns -> Q/A pairs
const turns = [];
for (const ln of p.split("\n")) {
  const m = ln.match(/^(Interviewer|Candidate):\s*(.*)$/);
  if (m) turns.push({ role: m[1], text: m[2].trim() });
}
const pairs = [];
for (let i = 0; i < turns.length; i++) {
  if (turns[i].role === "Interviewer") {
    const ans = turns.slice(i + 1).find((t) => t.role === "Candidate");
    if (ans && ans.text) pairs.push({ q: turns[i].text, a: ans.text });
  }
}
console.log(`${name} · ${s.role}: ${turns.length} turns, ${pairs.length} Q&A pairs`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  let r;
  for (let attempt = 1; attempt <= 6; attempt++) {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (r.ok) break;
    if ((r.status === 503 || r.status === 429) && attempt < 6) {
      const w = attempt * 5000;
      console.log(`Gemini ${r.status}, retry ${attempt}/5 in ${w / 1000}s...`);
      await sleep(w);
      continue;
    }
    console.error("Gemini", r.status, (await r.text()).slice(0, 300));
    process.exit(1);
  }
  const d = await r.json();
  let t = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(t); } catch { const a = t.indexOf("{"), b = t.lastIndexOf("}"); return JSON.parse(t.slice(a, b + 1)); }
}

const list = pairs.map((p, i) => `[[Q${i + 1}]] ${p.q}\n[[A${i + 1}]] ${p.a}`).join("\n\n");
const prompt = `You are a strict senior interview evaluator scoring candidate "${name}" for role: "${s.role}".
Resume: ${s.resumeSummary || "-"}
Score the technical interview below. Be brutally honest, evidence-based; quote the answer in each rationale. Vague/wrong/one-line answers score low.
Return ONLY JSON:
{
 "perQuestion":[{"i":1,"correctness":0-25,"depth":0-25,"clarity":0-25,"relevance":0-25,"total":0-100,"rationale":"..."}],
 "dimensions":{"domainKnowledge":0-100,"problemSolving":0-100,"communication":0-100,"depthOfUnderstanding":0-100},
 "overallScore":0-100,
 "verdict":"strong hire | hire | lean hire | borderline | no hire",
 "strengths":["..."],"weaknesses":["..."],
 "summary":"2-3 sentence assessment"
}
Q&A:
${list}`;

const res = await gemini(prompt);
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(path.join("reports", `${name.replace(/\s+/g, "-")}-scoring.json`), JSON.stringify(res, null, 2));
console.log(`\n===== AI SCORING: ${name} — ${s.role} =====\n`);
console.log(`OVERALL: ${res.overallScore}/100    VERDICT: ${(res.verdict || "-").toUpperCase()}`);
console.log("\nDimensions:");
for (const [k, v] of Object.entries(res.dimensions || {})) console.log(`  ${k.padEnd(22)} ${v}/100`);
console.log("\nStrengths:"); (res.strengths || []).forEach((x) => console.log("  + " + x));
console.log("\nWeaknesses:"); (res.weaknesses || []).forEach((x) => console.log("  - " + x));
console.log("\nSummary: " + res.summary);
console.log("\nPer-question:");
(res.perQuestion || []).forEach((q) => console.log(`  Q${q.i}: ${q.total}/100  (Corr ${q.correctness} Depth ${q.depth} Clar ${q.clarity} Rel ${q.relevance})\n      ${q.rationale}`));
console.log(`\nSaved: reports/${name.replace(/\s+/g, "-")}-scoring.json`);
process.exit(0);
