# Firestore setup & seeding

This project uses Firebase Auth + Cloud Firestore. The data model lives in
[`lib/firestore/schema.ts`](../lib/firestore/schema.ts) — collection names and
zod-validated document shapes. Treat that file as the source of truth.

## 1. Configure a service account

The server (API routes) and the seed script both need the Firebase Admin SDK.
In `.env.local` set **one** of:

```bash
# Option A — inline JSON (recommended for CI / hosting secrets)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"…", …}'

# Option B — path to a key file (local dev)
GOOGLE_APPLICATION_CREDENTIALS=./secrets/serviceAccount.json
```

Get the key from Firebase console → Project settings → Service accounts →
*Generate new private key*. **Never commit it.**

The public web config (client SDK) uses the `NEXT_PUBLIC_FIREBASE_*` vars — see
`.env.example` / `lib/firebase.ts`.

## 2. Seed test data

```bash
npm run seed
```

Idempotent — safe to re-run. It:

1. Creates/updates **4 test users**, one per role, with custom claims so the
   role-based rules apply:

   | Role      | Email                     | Password (default) |
   |-----------|---------------------------|--------------------|
   | candidate | `candidate@taledge.test`  | `Taledge@123`      |
   | recruiter | `recruiter@taledge.test`  | `Taledge@123`      |
   | coach     | `coach@taledge.test`      | `Taledge@123`      |
   | institute | `institute@taledge.test`  | `Taledge@123`      |

   Override the password with `SEED_TEST_PASSWORD` in `.env.local`.

2. Seeds every domain collection from `lib/data.ts` so seeded data matches the
   UI exactly: `candidates`, `examAspirants`, `institutes`, `organisations`,
   `recruiters`, `coaches`, `recruiterPool`, `coachingSessions`.

## 3. Deploy security rules

```bash
firebase deploy --only firestore:rules
```

Rules ([`firestore.rules`](../firestore.rules)) are **default-deny**. Highlights:

- `users/{uid}`, `candidates/{uid}` — owner read/write only.
- Published candidate profiles/reports — readable by `recruiter` / `institute`.
- Catalog collections (`institutes`, `organisations`, …) — signed-in read,
  **writes only via Admin SDK** (server + seed).

## 4. My Profile

`/profile` reads/writes the signed-in user's `users/{uid}` document through
`GET`/`PUT /api/profile`. The verified Firebase uid is the only authorization
subject. Without a service account (demo mode) the page still works — saves are
accepted but not persisted, and clearly labelled as such.
