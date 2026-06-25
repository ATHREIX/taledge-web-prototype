#!/usr/bin/env node
/**
 * Verify a Firebase Admin service-account key works BEFORE you flip
 * AUTH_ENFORCED=true (a bad key would lock the whole app at /login).
 *
 * It initializes firebase-admin with your key and makes one real call to
 * Firebase Auth + Firestore to prove the credential and permissions are good.
 *
 * Usage (either form):
 *   node scripts/verify-firebase-admin.mjs ./serviceAccount.json
 *   FIREBASE_SERVICE_ACCOUNT="$(cat ./serviceAccount.json)" node scripts/verify-firebase-admin.mjs
 */
import fs from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function loadCreds() {
  const arg = process.argv[2];
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (arg) {
    try {
      raw = fs.readFileSync(arg, "utf8");
    } catch {
      console.error(`✗ Could not read key file: ${arg}`);
      process.exit(1);
    }
  }
  if (!raw) {
    console.error("✗ No key provided. Pass a file path or set FIREBASE_SERVICE_ACCOUNT.");
    process.exit(1);
  }
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch {
    console.error("✗ Key is not valid JSON.");
    process.exit(1);
  }
  if (creds.private_key) creds.private_key = String(creds.private_key).replace(/\\n/g, "\n");
  for (const f of ["project_id", "client_email", "private_key"]) {
    if (!creds[f]) {
      console.error(`✗ Key is missing required field: ${f}`);
      process.exit(1);
    }
  }
  return creds;
}

const creds = loadCreds();
console.log(`Project   : ${creds.project_id}`);
console.log(`Client    : ${creds.client_email}`);

let app;
try {
  app = initializeApp({ credential: cert(creds) });
  console.log("✓ Admin SDK initialized");
} catch (e) {
  console.error("✗ initializeApp failed:", e.message);
  process.exit(1);
}

try {
  const users = await getAuth(app).listUsers(1);
  console.log(`✓ Firebase Auth reachable (project has ${users.users.length ? "≥1" : "0"} users)`);
} catch (e) {
  console.error("✗ Firebase Auth call failed:", e.message);
  console.error("  → Check the service account has the 'Firebase Authentication Admin' role.");
  process.exit(1);
}

try {
  await getFirestore(app).listCollections();
  console.log("✓ Firestore reachable");
} catch (e) {
  console.error("✗ Firestore call failed:", e.message);
  console.error("  → Check Firestore is enabled and the service account has datastore access.");
  process.exit(1);
}

console.log("\n✅ Service account is valid. Safe to set AUTH_ENFORCED=true.");
