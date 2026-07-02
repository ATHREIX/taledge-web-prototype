/** Dump full transcript of one interview session to reports/transcript-<id>.txt */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
dotenv.config({ path: ".env.local" });
initializeApp({ credential: cert(JSON.parse(fs.readFileSync("./serviceAccount.json","utf8"))) });
const db = getFirestore();
const id = process.argv[2];
if(!id){ console.error("usage: node scripts/dump-transcript.mjs <sessionId>"); process.exit(1);}
const d = await db.collection("interviewSessions").doc(id).get();
if(!d.exists){ console.error("not found: "+id); process.exit(1);}
const s = d.data();
const tx = s.transcript || [];
const lines = [];
lines.push(`Interview Transcript`);
lines.push(`Session: ${id}`);
lines.push(`Role: ${s.role||"-"}   Mode: ${s.mode||"-"}   Done: ${s.isDone}`);
lines.push(`Created: ${s.createdAt?new Date(s.createdAt).toISOString():"-"}   Updated: ${s.updatedAt?new Date(s.updatedAt).toISOString():"-"}`);
lines.push("="+"=".repeat(70));
lines.push("");
tx.forEach((t)=>{
  const who = t.role==="assistant" ? "INTERVIEWER" : t.role==="user" ? "CANDIDATE" : t.role.toUpperCase();
  lines.push(`${who}:`);
  lines.push((t.content||"").trim() || "(empty)");
  lines.push("");
});
fs.mkdirSync("reports",{recursive:true});
const out = path.join("reports", `transcript-${id}.txt`);
fs.writeFileSync(out, lines.join("\n"));
console.log("Written: "+out+"  ("+tx.length+" turns)");
console.log("\n----- CONTENT -----\n");
console.log(lines.join("\n"));
process.exit(0);
