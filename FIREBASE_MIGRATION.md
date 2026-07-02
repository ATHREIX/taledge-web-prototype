# Vercel → Firebase App Hosting migration

Moving this Next.js SSR app off Vercel onto **Firebase App Hosting** (Cloud Run
backed — the only Firebase product that runs SSR + `/api/*` routes; classic
Firebase Hosting is static-only), under a **new Firebase project owned by
umerkhan@athreix.com**.

Repo config already added:
- `apphosting.yaml` — build/runtime config + env + secret declarations
- `.firebaserc` — project alias (has a placeholder to replace)

---

## 0. One-time: switch the Firebase CLI account

```bash
npm i -g firebase-tools          # CLI not installed yet on this machine
firebase logout                  # drop umerkhan0207@gmail.com
firebase login                   # sign in as umerkhan@athreix.com
firebase login:list              # confirm the active account
```

## 1. Create the new project (owned by athreix account)

```bash
firebase projects:create taledge-prod --display-name "TalEdge"
# then in console: enable Blaze billing on this project (App Hosting requires it)
```

Enable the services the app uses, in the Firebase console for the new project:
- **Authentication** → enable Google + Microsoft (the SSO providers in use)
- **Firestore** → create the database (native mode)
- **Storage** → create the default bucket
- **Vertex/Generative Language** → the Gemini API key you'll use (`GEMINI_API_KEY`)

Register a **Web App** in Project Settings → copy the 6 `NEXT_PUBLIC_FIREBASE_*`
values into `apphosting.yaml` (replace the `REPLACE_WITH_*` placeholders).

Put the new project id in `.firebaserc` (replace `REPLACE_WITH_NEW_PROJECT_ID`),
then:

```bash
firebase use --add            # pick the new project, alias it "default"
```

## 2. Deploy Firestore + Storage rules/indexes to the new project

`firebase.json` already points at `firestore.rules`, `firestore.indexes.json`,
`storage.rules`.

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 3. Migrate data (only what you need)

New project = empty. Auth users and Firestore docs do NOT come over automatically.

- **Firestore data** (old project → new):
  ```bash
  # from the OLD project (log in as gmail, or grant athreix account Viewer on it)
  gcloud firestore export gs://OLD_BUCKET/ff-export --project OLD_PROJECT_ID
  gcloud firestore import gs://OLD_BUCKET/ff-export --project NEW_PROJECT_ID
  ```
  (Buckets must be same region, or copy between them with `gsutil rsync`.)
- **Auth users:**
  ```bash
  firebase auth:export users.json --project OLD_PROJECT_ID
  firebase auth:import users.json --project NEW_PROJECT_ID --hash-algo=...
  ```
  Google/Microsoft SSO users re-link on next sign-in; password users need the
  original hash params. If it's a pilot with few real users, skip and let them
  re-auth.
- **Storage objects:** `gsutil -m rsync -r gs://OLD_BUCKET gs://NEW_BUCKET`

## 4. Secrets (Cloud Secret Manager)

Required for production:

```bash
firebase apphosting:secrets:set GEMINI_API_KEY
firebase apphosting:secrets:set FIREBASE_SERVICE_ACCOUNT   # paste the NEW project's
                                                           # service-account JSON (one line)
```

`FIREBASE_SERVICE_ACCOUNT` is mandatory — without it, `lib/session-store.ts`
falls back to a tmp file that does NOT survive across Cloud Run instances, so
interview sessions break under load. Generate it in the new project:
Console → Project Settings → Service accounts → Generate new private key.

Optional (uncomment the matching block in `apphosting.yaml` after setting):
`DNLA_API_KEY` (ROTATE FIRST — old value leaked in `.env.local.example`),
`DNLA_WEBHOOK_SECRET`, `RESEND_API_KEY`, `PAIZA_API_KEY`, `GOOGLE_TTS_API_KEY`.

## 5. Create the App Hosting backend (GitHub connected)

```bash
firebase apphosting:backends:create --project NEW_PROJECT_ID
```
Prompts: connect the GitHub repo + branch (e.g. `main`), region, and the live
branch. After this, every push to the live branch auto-builds and deploys.
First rollout can also be triggered manually:

```bash
firebase apphosting:rollouts:create BACKEND_ID
```

## 6. Auth allowlist + DNS

- Firebase console → Authentication → Settings → **Authorized domains**: add the
  App Hosting domain (`*.web.app` / your custom domain). SSO popups fail
  otherwise (see the `frame-src *.firebaseapp.com` note in `next.config.ts`).
- Point your custom domain at the App Hosting backend (console → App Hosting →
  Add custom domain). Update the DNLA webhook URL to the new domain:
  `https://<new-domain>/api/dnla/webhook?secret=<DNLA_WEBHOOK_SECRET>`.

## 7. Cut over, then decommission Vercel

- Verify the App Hosting URL end-to-end (login, interview start, voice turn,
  fit-score, recruiter portal).
- Move DNS to the new domain.
- Once stable, remove the Vercel project / deployment.

---

### Notes / gotchas
- The `// Vercel`-flavored comments in code (60s cap, 4.5 MB body limit) are just
  comments — no Vercel runtime dependency, nothing to change for App Hosting.
- Cloud Run request timeout defaults to 300s (> the app's 60s work), so no
  `maxDuration` change needed.
- CSP in `next.config.ts` already allows Firebase auth/analytics/googleapis — no
  change needed for App Hosting.
