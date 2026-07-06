import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { adminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { AUTH_ENFORCED } from "@/lib/flags";
import { getInvite, getUserRole } from "@/lib/talent-store";

export type Principal = {
  /** Stable user id. In enforced mode this is the verified Firebase uid. */
  uid: string;
  /** True when running without verified auth (demo/dev). */
  demo: boolean;
  email?: string;
  /** True when authenticated via an invite token (an account-less candidate the
   *  recruiter/university invited). Their uid is their candidate-inv-* workspace. */
  invite?: boolean;
};

/**
 * The PUBLIC base URL for building candidate-facing links (invite / share links).
 * On Cloud Run / App Hosting, `req.nextUrl.origin` and `req.url` carry the INTERNAL
 * origin (http://0.0.0.0:8080), which produced dead invite links. Resolve in order:
 *   1. NEXT_PUBLIC_APP_URL / APP_URL (explicit, set in apphosting.yaml) — most reliable.
 *   2. x-forwarded-host (+ proto) — the public host the proxy forwards, ignoring the
 *      internal 0.0.0.0 / localhost host.
 *   3. the request origin — correct in local dev.
 * Returns with no trailing slash.
 */
export function getPublicBaseUrl(req: NextRequest | Request): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  const h = req.headers;
  const fwdHost = h.get("x-forwarded-host") || h.get("host") || "";
  const fwdProto = h.get("x-forwarded-proto") || "https";
  if (fwdHost && !/^(0\.0\.0\.0|localhost|127\.|\[?::)/i.test(fwdHost)) {
    return `${fwdProto}://${fwdHost}`.replace(/\/+$/, "");
  }
  try {
    return new URL((req as Request).url).origin;
  } catch {
    return "";
  }
}

function bearer(req: NextRequest | Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

/** The invite token a candidate carries instead of a Firebase login. */
function inviteHeader(req: NextRequest | Request): string | null {
  const h = req.headers.get("x-invite-token") || req.headers.get("X-Invite-Token");
  const t = h?.trim();
  return t && t.length <= 128 ? t : null;
}

/** The candidate-inv-* workspace id an invite token maps to (must match the id
 *  onboarding derives, app/onboarding/page.tsx, so writes target the right row). */
export function inviteWorkspaceId(token: string): string {
  return `candidate-inv-${token.slice(0, 10)}`;
}

/**
 * Resolve the calling principal.
 *
 *  - AUTH_ENFORCED + admin configured: requires a valid Firebase ID token,
 *    returns the verified uid, or null (caller responds 401).
 *  - Demo/dev (default): never blocks. Uses the token's uid if a verifiable
 *    token is present, otherwise a stable "demo-user" principal, so seeded
 *    personas stay browsable without a login.
 *
 * SECURITY: never derive the principal from a body/query `studentId` etc.
 * Always use the returned `uid` as the authorization subject.
 */
export async function getPrincipal(req: NextRequest | Request): Promise<Principal | null> {
  const token = bearer(req);

  if (isAdminConfigured && adminAuth && token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return { uid: decoded.uid, demo: false, email: decoded.email };
    } catch {
      // Invalid/expired token - fall through to invite-token / demo handling.
    }
  }

  // Invite-token credential. A candidate invited via a recruiter/university link
  // has NO Firebase account by design - the invite token IS their credential. We
  // resolve it to a principal scoped to their own candidate-inv-* workspace so
  // the interview + scoring routes work for them in enforced/production mode
  // (otherwise every one of those routes 401s and their assessment is lost).
  const inv = inviteHeader(req);
  if (inv) {
    try {
      const invite = await getInvite(inv);
      if (invite) {
        return { uid: inviteWorkspaceId(inv), demo: false, invite: true };
      }
    } catch {
      // Store read failed - fall through (no silent elevation).
    }
  }

  if (AUTH_ENFORCED) {
    // Production requires a verified token or a valid invite; nothing else.
    return null;
  }

  // Demo mode: stable, clearly-marked non-authoritative principal.
  return { uid: "demo-user", demo: true };
}

/**
 * Does this principal hold the given stakeholder role (users/{uid}.role)?
 * Demo mode returns true (the open demo has no real accounts). An account-less
 * invite-token principal is NEVER a recruiter/institute/coach — it's a candidate
 * credential — so it returns false. Used to gate role-specific APIs
 * (e.g. /api/recruiter/* must be a recruiter, not any authenticated user).
 */
export async function principalHasRole(principal: Principal, role: string): Promise<boolean> {
  if (principal.demo) return true;
  if (principal.invite) return false;
  return (await getUserRole(principal.uid)) === role;
}

/** Standard 401 response. */
export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

/** Standard 403 response for ownership failures. */
export function forbidden(message = "Not authorized for this resource") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}
