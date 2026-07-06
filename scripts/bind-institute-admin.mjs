/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Bind a real institute (university) admin to a pilot institute.
 * ─────────────────────────────────────────────────────────────────────────────
 *  Since the client-writable-role pilot fallback was removed (see
 *  canAdministerInstitute), an account can only administer an institute — read its
 *  cohort, mint recruiter share-links, send invites — if its uid is in that
 *  institute's `adminUids`. Run this once per real admin to grant them access.
 *
 *  Usage:
 *    node scripts/bind-institute-admin.mjs <email> [instituteId ...]
 *
 *  Examples:
 *    # bind the client's university admin to BOTH pilot institutes (default):
 *    node scripts/bind-institute-admin.mjs admin@university.edu
 *    # bind only the exam institute:
 *    node scripts/bind-institute-admin.mjs admin@university.edu institute-exam
 *
 *  Requires the same Firebase service account the seed uses — provide EITHER:
 *    FIREBASE_SERVICE_ACCOUNT       (stringified JSON, in .env.local), OR
 *    GOOGLE_APPLICATION_CREDENTIALS (path to the JSON), OR
 *    ./serviceAccount.json          (project-root, gitignored).
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });
loadEnv();

function initAdmin() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const creds = JSON.parse(raw);
    if (creds.private_key) creds.private_key = String(creds.private_key).replace(/\\n/g, "\n");
    return initializeApp({ credential: cert(creds) });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
    return initializeApp({ credential: applicationDefault() });
  }
  try {
    const creds = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));
    if (creds.private_key) creds.private_key = String(creds.private_key).replace(/\\n/g, "\n");
    console.log("[bind] Using ./serviceAccount.json.");
    return initializeApp({ credential: cert(creds) });
  } catch {
    console.error(
      "\n[bind] No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT or " +
        "GOOGLE_APPLICATION_CREDENTIALS in .env.local, or drop ./serviceAccount.json.\n"
    );
    process.exit(1);
  }
}

async function main() {
  const [email, ...instArgs] = process.argv.slice(2);
  if (!email || !email.includes("@")) {
    console.error("Usage: node scripts/bind-institute-admin.mjs <email> [instituteId ...]");
    process.exit(1);
  }
  const institutes = instArgs.length ? instArgs : ["institute-placement", "institute-exam"];

  initAdmin();
  const auth = getAuth();
  const db = getFirestore();

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(`[bind] No Firebase user with email ${email}. They must sign in / register once first.`);
    process.exit(1);
  }
  const uid = user.uid;

  for (const instituteId of institutes) {
    const ref = db.collection("institutes").doc(instituteId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn(`[bind] institutes/${instituteId} does not exist — run \`npm run seed\` first. Skipping.`);
      continue;
    }
    await ref.set({ adminUids: FieldValue.arrayUnion(uid) }, { merge: true });
    console.log(`[bind] ✓ ${email} (uid ${uid}) is now an admin of ${instituteId}.`);
  }
  console.log("[bind] Done. This admin can now log in and administer the institute(s) above.");
  process.exit(0);
}

main().catch((e) => {
  console.error("[bind] Failed:", e?.message || e);
  process.exit(1);
});
