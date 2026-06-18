# Security

This document summarizes Taledge's production security posture. It is accurate
to `lib/server-auth.ts`, `lib/firebase-admin.ts`, `lib/flags.ts`,
`lib/rate-limit.ts`, `next.config.ts`, and `firestore.rules`.

## Demo vs. production (`AUTH_ENFORCED`)

A single flag controls the security mode (`lib/flags.ts`):

- **Demo / dev (default, `AUTH_ENFORCED=false`)** — API routes never block. They
  resolve a stable, clearly non-authoritative `demo-user` principal so the
  seeded personas stay browsable without a real login. `DEMO_MODE` is derived as
  `!AUTH_ENFORCED`, enabling server fallbacks (file session store, seeded data)
  when no backend credentials are present.
- **Production (`AUTH_ENFORCED=true`)** — every API route and protected page
  REQUIRES a verified Firebase ID token. firebase-admin MUST be configured or
  authenticated requests cannot succeed.

Flip to production with: `AUTH_ENFORCED=true` plus a firebase-admin service
account (see below).

## Authentication & authorization (`getPrincipal`)

All routes derive identity through `getPrincipal(req)` in `lib/server-auth.ts`
— never from a body/query `studentId`/`recruiterId`:

- It reads a `Bearer <token>` from the `Authorization` header.
- When firebase-admin is configured and a token is present, the token is
  verified via `adminAuth.verifyIdToken(token)` and the **verified `uid`** is
  returned as the authorization subject.
- When `AUTH_ENFORCED=true`, a missing or invalid/expired token yields `null`,
  and the caller responds `401` via `unauthorized()`.
- When `AUTH_ENFORCED=false`, an unverifiable request falls back to the
  `demo-user` principal (`demo: true`) instead of blocking.

Ownership is enforced per resource: sessions/reports are owner-scoped
(`ownerUid`). A handler loads the resource, returns `404` if absent, and
`403` via `forbidden()` if `ownerUid !== principal.uid`. **Never trust
client-supplied ids as identity.**

## firebase-admin configuration

`lib/firebase-admin.ts` initializes the Admin SDK from **either**:

- `FIREBASE_SERVICE_ACCOUNT` — the full service-account JSON, stringified
  (escaped `\n` in the private key are normalized automatically), or
- `GOOGLE_APPLICATION_CREDENTIALS` — a path to a service-account file (ADC).

If neither is set, admin is **not** initialized (`adminAuth`/`adminDb` are
`null`, `isAdminConfigured` is `false`) and the app degrades gracefully to demo
mode. This makes production security a config flip, not a code change.

## GEMINI_API_KEY rotation (required)

`GEMINI_API_KEY` is a **server-only** secret. It was previously **leaked
client-side**, so the existing key MUST be **rotated** before any production
deployment. Treat the leaked value as compromised. The key must never be sent to
the browser (no `NEXT_PUBLIC_` prefix); all Gemini calls go through the server
helpers in `lib/gemini.ts`.

## Rate limiting

Every Gemini-backed route enforces a per-principal limit via
`enforceRateLimit(req, { uid, limit, windowMs, scope })` (`lib/rate-limit.ts`),
returning `429` with a `Retry-After` header when exceeded. The limiter is an
in-memory token bucket keyed by `uid` + IP — correct for single-node/dev and a
meaningful per-instance first line of defense against billing-abuse loops on the
paid Gemini routes. For strict global limits in production, back it with a
shared store (e.g. Upstash/Redis) behind the same call signature.

## Security headers

`next.config.ts` applies hardened headers to all routes:

- **Content-Security-Policy** — `default-src 'self'`; `object-src 'none'`;
  `connect-src` restricted to self + the Gemini/Firebase/Google backends
  (https + wss); `frame-ancestors 'none'`. `script-src` allows
  `'unsafe-inline'`/`'unsafe-eval'` + `cdn.jsdelivr.net` because the Monaco
  editor compiles workers via eval/wasm and loads from that CDN.
- **X-Frame-Options: DENY** (mirrors `frame-ancestors 'none'`) — anti-clickjacking.
- **X-Content-Type-Options: nosniff**.
- **Referrer-Policy: strict-origin-when-cross-origin**.
- **Strict-Transport-Security** — `max-age=63072000; includeSubDomains; preload`.
- **Permissions-Policy** — `camera=(self), microphone=(self), geolocation=()`.

## Firestore rules requirement

`firestore.rules` is **default-deny** and owner-scoped, and MUST be deployed for
production:

```
firebase deploy --only firestore:rules
```

Each collection grants the minimum required access scoped to the authenticated
user: candidates read/write only their own document (recruiters/institutes read
only published profiles); interview sessions, reports, and coaching sessions are
owner-only via `ownerUid == request.auth.uid` (recruiters read only published
reports). Role-based reads use custom claims set via the Admin SDK. The Admin
SDK bypasses these rules, so server-side authorization in the API routes
(`getPrincipal` + ownership checks) remains the primary gate. Everything not
explicitly matched is denied.

## Reporting

Report security issues privately to the maintainers rather than opening a public
issue. Do not include live secrets in reports.
