# Deploying Taledge to Vercel

The app is a standard Next.js 15 app and builds clean (`npm run build`). Follow
this exactly so **all functionality runs properly** in production.

## 1. Import the repo
GitHub → Vercel → **Add New Project** → import. Vercel auto-detects Next.js.
Build command `next build` and output are detected automatically. `prebuild`
cleans `.next` first; the build uses webpack (Turbopack is dev-only).

## 2. Environment variables (Project → Settings → Environment Variables)

### Client (public — from Firebase console → Project settings → Web app)
| Key | |
|-----|--|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | required |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | required |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | required |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | required |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | required |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | required |
| `NEXT_PUBLIC_SHOW_PHASE_2` | optional (`false`) |

### Server (secrets)
| Key | |
|-----|--|
| `GEMINI_API_KEY` | required for AI interviews / Fit Score |
| `FIREBASE_SERVICE_ACCOUNT` | stringified service-account JSON — **required in prod** |
| `AUTH_ENFORCED` | `true` in production |
| `GEMINI_TEXT_MODEL` / `GEMINI_LIVE_MODEL` | optional (have defaults) |

## 3. Four things that MUST be done (or features silently break)

1. **Firebase Auth → authorized domains.** Add your `*.vercel.app` domain (and
   any custom domain) in Firebase Console → Authentication → Settings →
   Authorized domains. Without this, **every login fails** in production.

2. **`FIREBASE_SERVICE_ACCOUNT` is required in production.** Interview sessions
   persist to Firestore via firebase-admin. Without it, sessions fall back to a
   temp-dir JSON file that is **per-instance and ephemeral** on serverless
   (an interview can break mid-way if the request hits a different instance),
   and `AUTH_ENFORCED=true` rejects all calls (no admin to verify tokens).

3. **Plan / function duration.** The free **Hobby plan works** — all AI routes
   are now ≤ **60s** (`generate-fit-score`/`voice`/`parse-resume` = 60s), which
   is the Hobby cap. Most Gemini calls finish well under that. Upgrade to **Pro**
   (up to 300s) only if you later raise `maxDuration` for heavier reports.

4. **Deploy Firestore rules + run the seed** (see `docs/FIRESTORE_SETUP.md`):
   `firebase deploy --only firestore:rules` and `npm run seed`.

## 4. Production hardening still open (fine for pilot, do before scale)
- Rate limiting is in-memory (per serverless instance) — move to Redis/Upstash
  for distributed enforcement.
- Session store + rate limiter both assume single-instance for the file/in-mem
  fallback; with `FIREBASE_SERVICE_ACCOUNT` set, sessions are already in
  Firestore and safe across instances.

## Serverless-safety already handled in code
- The local/demo session fallback writes to the OS temp dir (writable on
  Vercel), not the read-only project directory.
- All other API routes are stateless (no filesystem writes).
