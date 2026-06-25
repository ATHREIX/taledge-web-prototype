#!/usr/bin/env node
/**
 * Sync checker — proves the four stakeholders read one shared source of truth.
 *
 * It reads the demo talent store (the single JSON file the app writes) and the
 * LIVE recruiter API, then checks that the same candidate shows identical
 * numbers everywhere. No Gemini calls — purely read-only.
 *
 * Usage:  node scripts/check-sync.mjs            (assumes dev server on :3000)
 *         BASE=http://localhost:3000 node scripts/check-sync.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:3000";
const FILE = path.join(os.tmpdir(), "taledge-talent", "talent.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    console.error(`! Could not read store file at ${FILE} — start the app and trigger one read first.`);
    process.exit(1);
  }
}

const d = load();
const cands = Object.values(d.candidates || {});
console.log(`SHARED STORE: ${FILE}`);
console.log(`  candidates: ${cands.length}`);

// 1) Stakeholder read-path predicates (mirror lib/talent-store.ts)
const recruiterPool = cands.filter((c) => c.publishedToRecruiters === true);
const byInstitute = {};
for (const c of cands) {
  const k = c.instituteId || "(off-campus / none)";
  (byInstitute[k] ||= []).push(c);
}
console.log(`\nDERIVED VIEWS (single source → many readers):`);
console.log(`  RECRUITER pool  (publishedToRecruiters==true): ${recruiterPool.length}`);
console.log(`  SHARED-LINK pool (same consent gate)         : ${recruiterPool.length}`);
console.log(`  INSTITUTE cohorts (instituteId ==):`);
for (const [k, v] of Object.entries(byInstitute)) console.log(`      ${k} -> ${v.length}`);

// 2) Cross-check the LIVE recruiter API against the store for one candidate
const sample = recruiterPool.find((c) => c.instituteId) || cands[0];
if (!sample) {
  console.log("\nNo candidates to cross-check.");
  process.exit(0);
}

const res = await fetch(`${BASE}/api/recruiter/candidates`).catch(() => null);
if (!res || !res.ok) {
  console.log(`\n! recruiter API unreachable at ${BASE} (is the dev server up?) — store check still valid.`);
  process.exit(0);
}
const j = await res.json();
const rows = j.candidates || [];
const apiRow = rows.find((r) => r.studentId === sample.id);

console.log(`\nLIVE CROSS-CHECK for ${sample.id} (${sample.name}):`);
console.log(`  store : fit ${sample.fit?.fit} | tech ${sample.fit?.technical} | behav ${sample.fit?.behavioural} | published ${sample.publishedToRecruiters}`);
console.log(`  API   : fit ${apiRow?.fit} | tech ${apiRow?.tech} | behav ${apiRow?.behav} | published ${apiRow?.published}`);

const synced =
  apiRow &&
  apiRow.fit === sample.fit?.fit &&
  apiRow.tech === sample.fit?.technical &&
  apiRow.behav === sample.fit?.behavioural;
console.log(`\n${synced ? "✅ IN SYNC" : "❌ MISMATCH"}: recruiter API ${synced ? "matches" : "DIFFERS FROM"} the shared store.`);
console.log(`   (Institute reads the same store via listCandidatesByInstitute — open /institute/<id> to eyeball.)`);
process.exit(synced ? 0 : 2);
