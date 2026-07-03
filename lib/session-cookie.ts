"use client";

/**
 * Mirror the Firebase ID token into a cookie the Edge middleware can read.
 *
 * Firebase client auth persists in IndexedDB (no cookie), so the enforced-mode
 * middleware gate (AUTH_ENFORCED=true) can't see it and would bounce every
 * protected navigation to /login. This cookie is the COARSE page gate only —
 * every API route still verifies the token per-request via getPrincipal.
 *
 * CRITICAL ORDERING: the post-auth navigation (router.push after sign-in) MUST
 * NOT race the async onIdTokenChanged listener that also refreshes this cookie.
 * Call `syncSessionCookie(user)` and AWAIT it *before* navigating, so the very
 * first protected request already carries the credential (otherwise the RSC
 * fetch for the destination hits middleware with no cookie → redirect to
 * /login → the "sign-in bounces back to sign-in" loop).
 */

export const SESSION_COOKIE = "firebaseIdToken";

function secureAttr(): string {
  return typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
}

export function writeSessionCookie(token: string): void {
  if (typeof document === "undefined") return;
  // max-age tracks the Firebase ID token lifetime (1h). onIdTokenChanged rewrites
  // it on every proactive refresh while a tab is open, so it stays fresh.
  document.cookie = `${SESSION_COOKIE}=${token}; path=/; max-age=3600; SameSite=Lax${secureAttr()}`;
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax${secureAttr()}`;
}

/** Minimal shape we need from a Firebase user — avoids importing the SDK type here. */
type TokenBearer = { getIdToken: (forceRefresh?: boolean) => Promise<string> };

/**
 * Await a fresh ID token and write the gate cookie BEFORE any post-auth
 * navigation. Best-effort: a token-read failure never throws (sign-in already
 * succeeded), it just leaves the async listener to backfill the cookie.
 */
export async function syncSessionCookie(user: TokenBearer | null): Promise<void> {
  if (!user) {
    clearSessionCookie();
    return;
  }
  try {
    writeSessionCookie(await user.getIdToken());
  } catch {
    /* best-effort — onIdTokenChanged will backfill */
  }
}
