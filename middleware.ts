import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Edge middleware. Runs on every matched request BEFORE the route handler.
 *
 * IMPORTANT (Edge runtime): do NOT import server-only modules here
 * (no firebase-admin, no @/lib/server-auth, etc.). Firebase JWT signatures are
 * verified with WebCrypto/JWKS through the Edge-compatible `jose` package.
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
//  - /api/invite: resolves an invite token to its job/cohort context; the route
//    validates the token itself (invite/[token]/route.ts) — the token IS the credential.
//  - /api/dnla/webhook: a server-to-server provider callback that carries no user
//    credential; the route's own signature/secret check is the gate.
//  - /api/shared: a recruiter opening an institute's scoped share link — the
//    unguessable, expiring token IS the credential (the route validates it and
//    only returns consented candidates), so it must work without a Taledge login.
const API_AUTH_EXEMPT = [
  "/api/invite",
  "/api/dnla/webhook",
  "/api/shared",
  // Trivial liveness probe (no work, no paid service). The pre-flight system
  // check calls it to time the network — often BEFORE the session cookie is set —
  // and uptime monitors need it reachable without a login.
  "/api/health",
];

// Public browser pages that self-gate in their own client code and must NOT be
// pre-empted by the coarse middleware redirect (they render a register-first gate
// and only fetch data once a user is present).
const PUBLIC_PAGE_PREFIXES = ["/recruiter/shared/"];

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

/** The invite token an account-less candidate carries instead of a Firebase login. */
function inviteCredential(req: NextRequest): string | null {
  const h = req.headers.get("x-invite-token") || req.headers.get("X-Invite-Token");
  const cookie = req.cookies.get("inviteToken")?.value;
  const t = (h || cookie || "").trim();
  return t && t.length <= 128 ? t : null;
}

function bearerToken(req: NextRequest): string | null {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  const match = authHeader ? /^Bearer\s+(.+)$/i.exec(authHeader.trim()) : null;
  return match?.[1]?.trim() || null;
}

async function validFirebaseToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) return false;
  try {
    const { payload, protectedHeader } = await jwtVerify(token, FIREBASE_JWKS, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    });
    const now = Math.floor(Date.now() / 1000);
    return (
      protectedHeader.alg === "RS256" &&
      typeof protectedHeader.kid === "string" &&
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      payload.sub.length <= 128 &&
      typeof payload.auth_time === "number" &&
      payload.auth_time <= now
    );
  } catch {
    return false;
  }
}

/**
 * Validate the coarse page credential before any server component is allowed to
 * render. API routes still perform Firebase Admin / invite-store verification in
 * getPrincipal; this Edge check prevents an arbitrary non-empty cookie from
 * opening SSR pages while keeping invite-only candidates on their own workspace.
 */
async function hasValidCredential(req: NextRequest, pathname: string): Promise<boolean> {
  const firebaseToken = bearerToken(req) || req.cookies.get("firebaseIdToken")?.value || null;
  if (await validFirebaseToken(firebaseToken)) return true;

  const invite = inviteCredential(req);
  if (!invite) return false;
  // API handlers verify the invite against Firestore before returning data.
  if (pathname.startsWith("/api/")) return true;
  const workspace = `candidate-inv-${invite.slice(0, 10)}`;
  return (
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname === `/student/${workspace}` ||
    pathname.startsWith(`/student/${workspace}/`) ||
    pathname === `/exam/${workspace}` ||
    pathname.startsWith(`/exam/${workspace}/`)
  );
}

function clearInvalidCredentialCookies(req: NextRequest, res: NextResponse): NextResponse {
  if (req.cookies.has("firebaseIdToken")) res.cookies.delete("firebaseIdToken");
  if (req.cookies.has("inviteToken")) res.cookies.delete("inviteToken");
  return res;
}

function unauthenticatedApi(req: NextRequest): NextResponse {
  return clearInvalidCredentialCookies(
    req,
    NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 })
  );
}

function loginRedirect(req: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
  return clearInvalidCredentialCookies(req, NextResponse.redirect(loginUrl));
}

export async function middleware(req: NextRequest) {
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
    if (!(await hasValidCredential(req, pathname))) return unauthenticatedApi(req);
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
  if (isProtectedPage && !(await hasValidCredential(req, pathname))) {
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
    return loginRedirect(req, pathname);
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
