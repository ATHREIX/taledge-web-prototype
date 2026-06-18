import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { adminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { AUTH_ENFORCED } from "@/lib/flags";

export type Principal = {
  /** Stable user id. In enforced mode this is the verified Firebase uid. */
  uid: string;
  /** True when running without verified auth (demo/dev). */
  demo: boolean;
  email?: string;
};

function bearer(req: NextRequest | Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
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
      // Invalid/expired token.
      if (AUTH_ENFORCED) return null;
    }
  }

  if (AUTH_ENFORCED) {
    // Production requires a verified token; nothing else is accepted.
    return null;
  }

  // Demo mode: stable, clearly-marked non-authoritative principal.
  return { uid: "demo-user", demo: true };
}

/** Standard 401 response. */
export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

/** Standard 403 response for ownership failures. */
export function forbidden(message = "Not authorized for this resource") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}
