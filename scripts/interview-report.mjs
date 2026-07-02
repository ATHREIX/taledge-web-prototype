/**
 * Full client interview report PDF.
 * Pulls a session, scores it with the REAL product rubric (generate-fit-score
 * RUBRIC + weights), recomputes the headline fit_score deterministically in code
 * (same as the app), and renders a PDF: methodology -> scores -> breakdown ->
 * per-question -> transcript appendix.
 *
 * Usage: node scripts/interview-report.mjs [sessionId]
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import PDFDocument from "pdfkit";
dotenv.config({ path: ".env.local" });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const id = process.argv[2] || "8f68dd7f-fe44-4e72-8428-52c5fc9e4b20";
initializeApp({ credential: cert(JSON.parse(fs.readFileSync("./serviceAccount.json", "utf8"))) });
const db = getFirestore();

// ── The real product rubric (mirrors app/api/generate-fit-score/route.ts) ──
const RUBRIC = {
  technical: {
    "Domain Knowledge Depth": ["Core expertise for the target role", "Depth vs surface understanding"],
    "Problem Solving & Judgement": ["Structured reasoning", "Trade-off & risk awareness", "Handling of edge cases / complications"],
    "Applied Competence": ["Hands-on skill in the role's core work", "Quality and pragmatism of approach"],
    "Adversarial Resilience": ["Defending decisions under cross-examination", "Adapting vs. rigidly defending"],
    "Delivery Signals": ["Hesitation / latency", "Hint dependency penalty", "Confidence consistency"],
  },
  resume: {
    "Skill Mapping Matrix": ["JD overlap percentage", "Core vs Tangential skill dilution"],
    "Project Reality Index": ["Complexity vs Claim alignment", "Impact quantification index"],
    "Academic Trajectory": ["Tier multiplier", "Pedigree consistency"],
    "Information Density": ["Fluff-to-substance ratio", "Clarity metric"],
  },
  behavioural: {
    "Advanced Psychometrics (DNLA)": ["Emotional regulation under adversarial questioning", "Cognitive dissonance detection", "Dark Triad suppression"],
    "Conflict Resolution Depth": ["Blame distribution index", "De-escalation strategy map", "Post-mortem accountability"],
    "Linguistic Biomarkers": ["Defensive mechanism triggers", "Pronoun usage (I vs We indexing)", "Calibrated verbosity"],
    "Strategic Empathy": ["Perspective taking metrics", "Stakeholder map understanding"],
    "Growth & Neuroplasticity": ["Feedback assimilation rate", "Fixed vs Growth mindset indicators"],
  },
};
const FIT_WEIGHTS = { technical: 0.4, resume: 0.2, behavioural: 0.4 };

const rubricList = (r) => Object.entries(r).map(([g, items]) => `  - ${g}: [${items.map((i) => `"${i}"`).join(", ")}]`).join("\n");
const clamp = (n) => { if (n === -1 || n === "-1") return -1; const v = Number(n); if (!isFinite(v)) return -1; if (v === -1) return -1; return Math.max(0, Math.min(100, Math.round(v))); };
const avgRows = (bd) => { const v = bd.flatMap((g) => g.rows.map((r) => Number(r[1]))).filter((x) => Number.isFinite(x) && x >= 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

// ── Load + parse transcript ──
const s = (await db.collection("interviewSessions").doc(id).get()).data();
const name = (s.priorInterviews || "").match(/(?:Hey|Hello|Hi)\s+([A-Z][a-zA-Z]+)/)?.[1] || "Candidate";
const p = s.priorInterviews || "";
const turns = [];
for (const ln of p.split("\n")) { const m = ln.match(/^(Interviewer|Candidate):\s*(.*)$/); if (m) turns.push({ role: m[1], text: m[2].trim() }); }
const pairs = [];
for (let i = 0; i < turns.length; i++) if (turns[i].role === "Interviewer") { const a = turns.slice(i + 1).find((t) => t.role === "Candidate"); if (a && a.text) pairs.push({ q: turns[i].text, a: a.text }); }
console.log(`${name} · ${s.role}: ${pairs.length} Q&A pairs`);

// ── Gemini with retry ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  let r;
  for (let attempt = 1; attempt <= 6; attempt++) {
    r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }) });
    if (r.ok) break;
    if ((r.status === 503 || r.status === 429) && attempt < 6) { const w = attempt * 5000; console.log(`Gemini ${r.status}, retry ${attempt}/5 in ${w / 1000}s...`); await sleep(w); continue; }
    console.error("Gemini", r.status, (await r.text()).slice(0, 300)); process.exit(1);
  }
  const d = await r.json(); let t = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(t); } catch { const a = t.indexOf("{"), b = t.lastIndexOf("}"); return JSON.parse(t.slice(a, b + 1)); }
}

const qaText = pairs.map((p, i) => `Q${i + 1}: ${p.q}\nA${i + 1}: ${p.a}`).join("\n\n");
const prompt = `You are a senior talent intelligence analyst computing a candidate's Fit Score per the Taledge rubric.
Candidate: ${name}. Target role: ${s.role}. Resume: ${s.resumeSummary || "(not provided)"}.

Only a TECHNICAL interview transcript is available (no separate behavioural/DNLA stage was completed). Score Component 01 from the transcript and Component 02 from the resume summary. Set every behavioural sub-score to -1 (pending).

Rules: every sub-score 0-100, grounded in specific evidence — quote the candidate's words in rationales. One-line/wrong answers score low. No generosity without evidence.

Component 01 Technical:
${rubricList(RUBRIC.technical)}
Component 02 Resume:
${rubricList(RUBRIC.resume)}
Component 04 Behavioural (set rows to -1, pending):
${rubricList(RUBRIC.behavioural)}

Return ONLY JSON:
{
 "technical_breakdown":[{"group":"<group>","rows":[["<label>",<0-100>]]}],
 "resume_breakdown":[{"group":"<group>","rows":[["<label>",<0-100>]]}],
 "behavioural_breakdown":[{"group":"<group>","rows":[["<label>",-1]]}],
 "perQuestion":[{"i":1,"score":<0-100>,"rationale":"quote + why"}],
 "cross_flags":[{"label":"...","verdict":"...","tone":"ok|warn|danger"}],
 "verdict":"<short phrase>",
 "narrative":"<3 sentences, concrete evidence>",
 "strengths":["..."],"weaknesses":["..."]
}
TRANSCRIPT:
${qaText}`;

// Reuse a cached Gemini result if present (Gemini is heavily rate-limited);
// pass --fresh to force a new call.
const cachePath = path.join("reports", `${name}-report-data.json`);
let g;
if (!process.argv.includes("--fresh") && fs.existsSync(cachePath)) {
  console.log("Using cached Gemini result: " + cachePath);
  g = JSON.parse(fs.readFileSync(cachePath, "utf8"));
} else {
  g = await gemini(prompt);
}
const norm = (bd) => (Array.isArray(bd) ? bd.map((x) => ({ group: String(x.group || ""), rows: (x.rows || []).map((r) => [String(r[0] || ""), clamp(r[1])]) })) : []);
const tech = norm(g.technical_breakdown), resume = norm(g.resume_breakdown), behav = norm(g.behavioural_breakdown);

// ── Deterministic headline (same math as the app) ──
const techAvg = avgRows(tech), resumeAvg = avgRows(resume), behavAvg = avgRows(behav);
const comps = [];
if (techAvg != null) comps.push([techAvg, FIT_WEIGHTS.technical]);
if (resumeAvg != null) comps.push([resumeAvg, FIT_WEIGHTS.resume]);
if (behavAvg != null) comps.push([behavAvg, FIT_WEIGHTS.behavioural]);
const wsum = comps.reduce((a, [, w]) => a + w, 0);
const fit = wsum ? clamp(comps.reduce((a, [v, w]) => a + v * w, 0) / wsum) : 0;
const danger = (g.cross_flags || []).filter((f) => f.tone === "danger").length;
const warn = (g.cross_flags || []).filter((f) => f.tone === "warn").length;
const success = clamp(fit - danger * 8 - warn * 3);
const techScore = techAvg == null ? -1 : clamp(techAvg);
const behavScore = behavAvg == null ? -1 : clamp(behavAvg);
const status = fit >= 78 ? "Interview-ready" : fit >= 50 ? "In progress" : "Not started";

console.log(`fit=${fit} success=${success} tech=${techScore} behav=${behavScore} status=${status}`);

// ── Render PDF ──
const BRAND = "#4f46e5", INK = "#18181b", MUTE = "#71717a", LINE = "#e5e7eb";
const outPath = path.join("reports", `${name}-interview-report.pdf`);
fs.mkdirSync("reports", { recursive: true });
const doc = new PDFDocument({ size: "A4", margin: 50 });
doc.pipe(fs.createWriteStream(outPath));
const W = 495;
const hr = () => { doc.strokeColor(LINE).lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke(); doc.moveDown(0.6); };
const h1 = (t) => { if (doc.y > 720) doc.addPage(); doc.fillColor(BRAND).fontSize(15).text(t); doc.moveDown(0.3); };
const h2 = (t) => { if (doc.y > 730) doc.addPage(); doc.fillColor(INK).fontSize(11.5).text(t); doc.moveDown(0.15); };
const body = (t, c = INK, sz = 10) => { doc.fillColor(c).fontSize(sz).text(t, { width: W }); doc.moveDown(0.3); };
const scoreColor = (n) => (n >= 70 ? "#047857" : n >= 45 ? "#b45309" : "#be123c");

// Cover
doc.fillColor(BRAND).fontSize(24).text("TalEdge");
doc.fillColor(INK).fontSize(17).text("Interview Evaluation Report");
doc.moveDown(0.4);
doc.fillColor(MUTE).fontSize(10).text(`Candidate: ${name}`);
doc.text(`Target role: ${s.role}   ·   Mode: ${s.mode || "-"}   ·   Stage scored: Technical`);
doc.text(`Session: ${id}`);
doc.text(`Interview date: ${s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : "-"}   ·   Report generated: ${new Date().toISOString().slice(0, 10)}`);
doc.moveDown(0.6); hr();

// Headline
h1("Headline Scores");
doc.fillColor(INK).fontSize(13).text(`Fit Score: `, { continued: true }).fillColor(scoreColor(fit)).text(`${fit} / 100`, { continued: true }).fillColor(MUTE).fontSize(11).text(`   (${status})`);
doc.moveDown(0.15);
doc.fillColor(INK).fontSize(11).text(`Success probability: ${success}/100      Technical: ${techScore < 0 ? "pending" : techScore + "/100"}      Behavioural: ${behavScore < 0 ? "pending (stage not completed)" : behavScore + "/100"}`);
doc.moveDown(0.2);
body(`Verdict: ${g.verdict || "-"}`, INK, 11);
body(g.narrative || "", INK, 10);
doc.moveDown(0.2); hr();

// Methodology
h1("How the AI Scores This Session");
body("Scoring is a two-step pipeline. (1) An LLM (Gemini) reads the transcript and rates each rubric sub-dimension 0-100, grounded in quoted evidence. (2) The headline numbers are NOT taken from the LLM — server code recomputes them deterministically from the sub-scores, so the final figure is an auditable function of the breakdown, not a single number the model could hallucinate.", MUTE, 9.5);
h2("Composite formula (computed in code)");
doc.font("Courier").fillColor(INK).fontSize(9).text(
  `technical_score   = mean(Component 01 rows)\n` +
  `resume_score      = mean(Component 02 rows)\n` +
  `behavioural_score = mean(Component 04 rows)   [pending -> -1, dropped]\n\n` +
  `fit_score = (tech*0.4 + resume*0.2 + behav*0.4)\n` +
  `            renormalized over COMPLETED stages only\n` +
  `success_probability = fit_score - danger_flags*8 - warn_flags*3`, { width: W });
doc.font("Helvetica");
doc.moveDown(0.3);
body(`This session: only Technical + Resume completed, so weights renormalize to technical ${(0.4 / 0.6).toFixed(2)} + resume ${(0.2 / 0.6).toFixed(2)} (behavioural dropped). Sub-score means -> tech ${techAvg != null ? techAvg.toFixed(1) : "-"}, resume ${resumeAvg != null ? resumeAvg.toFixed(1) : "-"} -> fit ${fit}.`, INK, 9.5);
doc.moveDown(0.2); hr();

// Breakdown tables
const renderBreak = (title, weight, bd, pending) => {
  h1(`${title}  (weight ${weight})`);
  if (pending) { body("Stage not completed in this session — excluded from the Fit Score.", MUTE, 9.5); return; }
  bd.forEach((grp) => {
    h2(grp.group);
    grp.rows.forEach(([label, v]) => {
      if (doc.y > 770) doc.addPage();
      doc.fillColor(MUTE).fontSize(9).text(label, 60, doc.y, { width: 360, continued: true });
      doc.fillColor(scoreColor(v)).text(`   ${v}/100`, { align: "left" });
    });
    doc.moveDown(0.3);
  });
};
renderBreak("Component 01 · Technical", "0.40", tech, false);
renderBreak("Component 02 · Resume & Profile", "0.20", resume, false);
renderBreak("Component 04 · Behavioural / DNLA", "0.40", behav, true);

// Cross flags
if ((g.cross_flags || []).length) {
  h1("Cross-Component Checks");
  g.cross_flags.forEach((f) => {
    const c = f.tone === "danger" ? "#be123c" : f.tone === "warn" ? "#b45309" : "#047857";
    doc.fillColor(c).fontSize(10).text(`[${(f.tone || "ok").toUpperCase()}] `, { continued: true }).fillColor(INK).text(`${f.label}: ${f.verdict}`, { width: W });
    doc.moveDown(0.2);
  });
  doc.moveDown(0.2);
}

// Strengths / weaknesses
doc.addPage();
h1("Strengths");
(g.strengths || []).forEach((x) => body("+  " + x, "#047857", 10));
doc.moveDown(0.2);
h1("Weaknesses");
(g.weaknesses || []).forEach((x) => body("-  " + x, "#be123c", 10));
doc.moveDown(0.2); hr();

// Per-question
h1("Per-Question Evaluation");
(g.perQuestion || []).forEach((q, i) => {
  if (doc.y > 720) doc.addPage();
  const pr = pairs[(q.i || i + 1) - 1] || pairs[i] || {};
  doc.fillColor(BRAND).fontSize(10.5).text(`Q${q.i || i + 1}.`, { continued: true }).fillColor(INK).text("  " + (pr.q || ""), { width: W });
  doc.moveDown(0.15);
  doc.fillColor(MUTE).fontSize(8.5).text("ANSWER");
  doc.fillColor(INK).fontSize(9.5).text((pr.a || "").slice(0, 700), { width: W });
  doc.moveDown(0.15);
  doc.fillColor(scoreColor(clamp(q.score))).fontSize(10).text(`Score: ${clamp(q.score)}/100`);
  doc.fillColor(MUTE).fontSize(9).text(q.rationale || "", { width: W });
  doc.moveDown(0.4);
});

// Transcript appendix
doc.addPage();
h1("Appendix · Full Transcript");
turns.forEach((t) => {
  if (doc.y > 770) doc.addPage();
  const who = t.role === "Interviewer" ? "INTERVIEWER" : "CANDIDATE";
  doc.fillColor(t.role === "Interviewer" ? BRAND : "#047857").fontSize(9).text(who + ": ", { continued: true }).fillColor(INK).text(t.text, { width: W });
  doc.moveDown(0.25);
});

doc.end();
await new Promise((r) => setTimeout(r, 500));
fs.writeFileSync(path.join("reports", `${name}-report-data.json`), JSON.stringify({ ...g, fit, success, techScore, behavScore, status }, null, 2));
console.log("PDF written: " + outPath);
process.exit(0);
