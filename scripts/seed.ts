/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Taledge Firestore seed — idempotent test-data loader.
 * ─────────────────────────────────────────────────────────────────────────────
 *  Run:  npm run seed
 *
 *  Requires a Firebase service account (same one used by the server). Provide
 *  EITHER in .env.local:
 *      FIREBASE_SERVICE_ACCOUNT       = full service-account JSON, stringified
 *      GOOGLE_APPLICATION_CREDENTIALS = path to a service-account JSON file
 *
 *  What it does (all idempotent — safe to re-run any number of times):
 *    1. Creates/updates 4 test auth users, one per role, with custom claims so
 *       the role-based Firestore rules apply.  Logins:
 *         candidate@taledge.test / recruiter@taledge.test /
 *         coach@taledge.test     / institute@taledge.test   (password below)
 *    2. Seeds every domain collection from lib/data.ts so the seeded data
 *       matches exactly what the UI renders.
 *
 *  This script initializes its OWN admin app (it cannot import
 *  lib/firebase-admin.ts, which is marked "server-only" for Next).
 */

import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";

import {
  students,
  examAspirants,
  institutes,
  recruiterPool,
  coachSessions,
  organisations,
} from "../lib/data";
import { COLLECTIONS, ROLE_VALUES, type RoleName } from "../lib/firestore/schema";

// Load .env.local (overrides) then .env, so the script sees the same config the
// app does without needing the vars exported into the shell.
loadEnv({ path: ".env.local" });
loadEnv();

const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD || "Taledge@123";

// ── Admin init ────────────────────────────────────────────────────────────────
function initAdmin(): App {
  if (getApps().length) return getApps()[0]!;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const creds = JSON.parse(raw);
    if (creds.private_key) creds.private_key = String(creds.private_key).replace(/\\n/g, "\n");
    return initializeApp({ credential: cert(creds) });
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    // Validate the file is readable + parseable before handing it to ADC.
    JSON.parse(readFileSync(path, "utf8"));
    return initializeApp({ credential: applicationDefault() });
  }

  // Convenience fallback: the project-root serviceAccount.json (gitignored).
  // Lets `pnpm seed` run even while GOOGLE_APPLICATION_CREDENTIALS stays
  // commented for demo mode — without committing or exporting anything.
  try {
    const creds = JSON.parse(readFileSync("./serviceAccount.json", "utf8"));
    if (creds.private_key) creds.private_key = String(creds.private_key).replace(/\\n/g, "\n");
    console.log("[seed] Using ./serviceAccount.json (no env credential set).");
    return initializeApp({ credential: cert(creds) });
  } catch {
    /* fall through to the error below */
  }

  console.error(
    "\n[seed] No Firebase credentials found.\n" +
      "       Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS in .env.local,\n" +
      "       or place serviceAccount.json in the project root. See docs/FIRESTORE_SETUP.md.\n"
  );
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Write an array of {id,...} docs into a collection in chunks (batch ≤ 500). */
async function seedCollection<T extends Record<string, unknown>>(
  db: Firestore,
  collection: string,
  items: T[],
  idOf: (item: T, index: number) => string
): Promise<number> {
  const CHUNK = 400;
  for (let start = 0; start < items.length; start += CHUNK) {
    const batch = db.batch();
    items.slice(start, start + CHUNK).forEach((item, i) => {
      const id = idOf(item, start + i);
      const ref = db.collection(collection).doc(id);
      batch.set(
        ref,
        { ...item, id, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    });
    await batch.commit();
  }
  return items.length;
}

const TEST_USERS: { role: RoleName; email: string; name: string; linkId: string }[] = [
  { role: "candidate", email: "candidate@taledge.test", name: "Test Candidate", linkId: "candidate-001" },
  { role: "recruiter", email: "recruiter@taledge.test", name: "Test Recruiter", linkId: "recruiter-001" },
  { role: "coach", email: "coach@taledge.test", name: "Test Coach", linkId: "coach-001" },
  { role: "institute", email: "institute@taledge.test", name: "Test Institute", linkId: "institute-placement" },
];

// ── Candidate → CandidateRecord shape ──────────────────────────────────────────
// MUST mirror lib/talent-store.ts `seedCandidate()` / `instituteOf()` so the
// Firestore docs carry the fields the app's queries depend on:
//   - instituteId          → listCandidatesByInstitute (institute cohorts)
//   - publishedToRecruiters → listRecruiterVisibleCandidates (recruiter pool)
//   - cohort / verified     → cohort labels + badges
// Without this the raw `students` shape would leave cohorts and the pool EMPTY
// in Firestore mode.
function instituteOf(college?: string): string {
  if (!college) return "";
  return /institute of technology/i.test(college) ? "institute-tech" : "institute-placement";
}
function toCandidateRecord(s: any) {
  const isSeed = !!s.college && !!s.branch;
  return {
    ...s,
    experience: "fresher",
    instituteId: s.college ? instituteOf(s.college) : "",
    cohort: s.branch && s.year ? `${s.branch} ${s.year}` : "",
    verified: isSeed,
    publishedToRecruiters: isSeed,
    sourcedFrom: "seed",
  };
}

// Recruiter / coach org documents (no array for these in lib/data.ts yet).
const recruiters = [
  { id: "recruiter-001", name: "Nimbus Talent Partners", sector: "Cloud / SaaS", seats: 8, activeRoles: 6 },
];
const coaches = [
  { id: "coach-001", name: "Taledge Coaching Studio", focus: "Behavioural & interview readiness", activeClients: 12 },
];

async function main() {
  const app = initAdmin();
  const db = getFirestore(app);
  const auth = getAuth(app);

  // ── Test users FIRST, so institute docs can carry the real admin uid ──────────
  console.log("[seed] Creating/updating test users…");
  const uidByRole: Partial<Record<RoleName, string>> = {};
  for (const u of TEST_USERS) {
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(u.email);
      uid = existing.uid;
      await auth.updateUser(uid, { displayName: u.name, password: TEST_PASSWORD });
    } catch {
      const created = await auth.createUser({ email: u.email, password: TEST_PASSWORD, displayName: u.name });
      uid = created.uid;
    }
    uidByRole[u.role] = uid;
    // Custom claims drive the role-based Firestore rules (token[role] == true).
    await auth.setCustomUserClaims(uid, { role: u.role, [u.role]: true });
    await db.collection(COLLECTIONS.users).doc(uid).set(
      {
        uid,
        email: u.email,
        name: u.name,
        role: u.role,
        linkId: u.linkId,
        published: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`        ✓ ${u.role.padEnd(10)} ${u.email}  (uid ${uid})`);
  }

  // Institute admins: the institute test user, plus any operator-supplied uid
  // (SEED_INSTITUTE_ADMIN_UID). Without adminUids, isInstituteAdmin fails closed
  // in enforced mode → no one can administer an institute.
  const instituteAdminUids = [uidByRole.institute, process.env.SEED_INSTITUTE_ADMIN_UID]
    .filter((v): v is string => !!v);
  if (instituteAdminUids.length === 0) {
    console.warn("[seed] ⚠ No institute admin uid resolved — institutes will have empty adminUids.");
  }

  console.log("[seed] Seeding domain collections…");
  const counts: Record<string, number> = {};
  // Candidates MUST be written in the talent-store CandidateRecord shape (see
  // toCandidateRecord) or cohorts/recruiter-pool read empty in Firestore mode.
  counts[COLLECTIONS.candidates] = await seedCollection(db, COLLECTIONS.candidates, (students as any[]).map(toCandidateRecord), (s) => s.id);
  counts[COLLECTIONS.examAspirants] = await seedCollection(db, COLLECTIONS.examAspirants, examAspirants as any[], (e) => e.id);
  // Institutes carry adminUids so the institute login can administer in enforced mode.
  counts[COLLECTIONS.institutes] = await seedCollection(
    db,
    COLLECTIONS.institutes,
    (institutes as any[]).map((i) => ({ ...i, adminUids: instituteAdminUids })),
    (i) => i.id
  );
  counts[COLLECTIONS.organisations] = await seedCollection(db, COLLECTIONS.organisations, organisations as any[], (o) => o.id);
  counts[COLLECTIONS.recruiters] = await seedCollection(db, COLLECTIONS.recruiters, recruiters as any[], (r) => r.id);
  counts[COLLECTIONS.coaches] = await seedCollection(db, COLLECTIONS.coaches, coaches as any[], (c) => c.id);
  // recruiterPool rows aren't uniquely keyed (a candidate appears for multiple
  // roles) → derive a stable index-based id.
  counts[COLLECTIONS.recruiterPool] = await seedCollection(
    db,
    COLLECTIONS.recruiterPool,
    recruiterPool as any[],
    (row, i) => `pool-${String(i + 1).padStart(3, "0")}-${row.studentId}`
  );
  // Coaching sessions: bind ownerUid to the seeded coach uid so owner-scoped
  // reads resolve under enforced auth (fall back to studentId for the pilot).
  counts[COLLECTIONS.coachingSessions] = await seedCollection(
    db,
    COLLECTIONS.coachingSessions,
    coachSessions.map((s) => ({ ...s, ownerUid: uidByRole.coach ?? s.studentId })) as any[],
    (s) => s.id
  );

  console.log("\n[seed] Done. Collection document counts:");
  for (const [k, v] of Object.entries(counts)) console.log(`        ${k.padEnd(18)} ${v}`);
  console.log(`\n[seed] Test logins (password: ${TEST_PASSWORD}):`);
  for (const u of TEST_USERS) console.log(`        ${u.email}`);
  console.log("");
  // Avoid hanging on the open gRPC connection.
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});

// Keep the ROLE_VALUES import meaningful for future validation hooks.
void ROLE_VALUES;
