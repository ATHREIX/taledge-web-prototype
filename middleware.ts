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
];

// API endpoints that must stay reachable without auth even in enforced mode
// (e.g. the ephemeral live token used to bootstrap the realtime session).
const API_AUTH_EXEMPT = ["/api/gemini/live-token"];

// Cookie names that may carry a server-readable session credential.
// (Demo build is client-side Firebase only; these are checked defensively so
// a future cookie-based session flow works without touching middleware.)
const SESSION_COOKIE_NAMES = [
  "session",
  "__session",
  "auth-token",
  "firebaseIdToken",
];

function hasCredential(req: NextRequest): boolean {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader && authHeader.trim().length > 0) return true;

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

  // Protected browser pages: redirect to /login when no credential.
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isProtectedPage && !hasCredential(req)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|woff|woff2|ttf|otf|eot|json|txt)$).*)",
  ],
};
