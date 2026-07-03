import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge middleware. Runs on every matched request BEFORE the route handler.
 *
 * IMPORTANT (Edge runtime): do NOT import server-only modules here
 * (no firebase-admin, no @/lib/server-auth, etc.). We read process.env
 * directly so this stays a small, dependency-free Edge bundle.
 *
 * Demo mode (default): AUTH_ENFORCED !== "true" -> fully open. We simply
 * call NextResponse.next() so seeded personas remain browsable WITHOUT login.
 *
 * Enforced mode: AUTH_ENFORCED === "true" -> require an Authorization
 * bearer header or a session cookie. Protected browser pages redirect to
 * /login; protected API routes return 401. Per-request identity/ownership
 * is still verified inside route handlers via getPrincipal — this is only
 * a coarse first gate.
 */

// Browser path prefixes that require auth in enforced mode.
const PROTECTED_PAGE_PREFIXES = [
  "/student",
  "/recruiter",
  "/coach",
  "/institute",
  "/exam",
  "/onboarding",
  "/dashboard",
  "/profile",
  // Legacy standalone interview/report pages (the canonical flow is the gated
  // /student/[id]/interview/[mode] route, already covered by /student).
  "/interview",
];

// API endpoints that must stay reachable without auth even in enforced mode.
//  - /api/gemini/live-token: ephemeral token that bootstraps the realtime session.
//  - /api/invite: resolves an invite token to its job/cohort context; the route
//    validates the token itself (invite/[token]/route.ts) — the token IS the credential.
//  - /api/dnla/webhook: a server-to-server provider callback that carries no user
//    credential; the route's own signature/secret check is the gate.
const API_AUTH_EXEMPT = [
  "/api/gemini/live-token",
  "/api/invite",
  "/api/dnla/webhook",
];

// Public browser pages that self-gate in their own client code and must NOT be
// pre-empted by the coarse middleware redirect (they render a register-first gate
// and only fetch data once a user is present).
const PUBLIC_PAGE_PREFIXES = ["/recruiter/shared/"];

// Cookie names that may carry a server-readable session credential.
// (Demo build is client-side Firebase only; these are checked defensively so
// a future cookie-based session flow works without touching middleware.)
//  - firebaseIdToken: the mirrored Firebase ID token (AuthProvider / lib/session-cookie).
//  - inviteToken: an account-less invited candidate's credential, persisted by the
//    onboarding page so their downstream /student/candidate-inv-* + /exam navigations
//    pass this coarse gate. getPrincipal still validates it per API request.
const SESSION_COOKIE_NAMES = [
  "session",
  "__session",
  "auth-token",
  "firebaseIdToken",
  "inviteToken",
];

/** The invite token an account-less candidate carries instead of a Firebase login. */
function inviteCredential(req: NextRequest): boolean {
  const h = req.headers.get("x-invite-token") || req.headers.get("X-Invite-Token");
  const t = h?.trim();
  return !!(t && t.length > 0 && t.length <= 128);
}

function hasCredential(req: NextRequest): boolean {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader && authHeader.trim().length > 0) return true;

  // An invited (account-less) candidate authenticates with the invite token the
  // recruiter/university issued — api-client.ts attaches it as X-Invite-Token.
  if (inviteCredential(req)) return true;

  for (const name of SESSION_COOKIE_NAMES) {
    const c = req.cookies.get(name);
    if (c && c.value) return true;
  }
  return false;
}

export function middleware(req: NextRequest) {
  // Default demo mode: completely open, zero blocking.
  if (process.env.AUTH_ENFORCED !== "true") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // API routes: 401 (not a redirect) when no credential, except exempt ones.
  if (pathname.startsWith("/api/")) {
    if (API_AUTH_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.next();
    }
    if (!hasCredential(req)) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Public, self-gating pages render their own register-first gate — never
  // pre-empt them with the coarse redirect.
  if (PUBLIC_PAGE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protected browser pages: redirect to /login when no credential.
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isProtectedPage && !hasCredential(req)) {
    // An off-campus invite link (/onboarding?invite=<token>) carries the
    // candidate's credential in the query on its FIRST hard load — before the
    // onboarding page has persisted the inviteToken cookie. Let that first load
    // through so the account-less candidate can start; the /api/invite route and
    // getPrincipal still validate the token. Downstream /student + /exam
    // navigations are covered by the inviteToken cookie via hasCredential.
    if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
      const inv = req.nextUrl.searchParams.get("invite");
      if (inv && inv.length <= 128) return protectedResponse(req);
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Protected pages are per-user and may render PII — never let a browser (or
  // bfcache) serve them after logout. Defense-in-depth alongside client re-auth.
  if (isProtectedPage) return protectedResponse(req);

  return NextResponse.next();
}

/**
 * next() with no-store on full-document navigations so an authenticated page
 * can't be restored from bfcache/history after logout. Skipped for RSC/prefetch
 * requests so Next's client router cache (navigation perf) is preserved — only
 * the document response is what bfcache would keep.
 */
function protectedResponse(req: NextRequest): NextResponse {
  const res = NextResponse.next();
  const isRsc =
    req.headers.get("rsc") === "1" || req.headers.get("next-router-prefetch") === "1";
  if (!isRsc) res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|woff|woff2|ttf|otf|eot|json|txt)$).*)",
  ],
};
