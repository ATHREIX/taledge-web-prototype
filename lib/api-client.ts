import { auth } from "@/lib/firebase";

/**
 * Client-safe fetch wrapper.
 *
 * When a Firebase user is signed in, attaches an `Authorization: Bearer <idToken>`
 * header carrying the current user's ID token so server routes (see
 * `lib/server-auth.ts`) can resolve the authenticated principal.
 *
 * When no user is signed in (demo flows), it falls back to a plain `fetch` so
 * unauthenticated/demo journeys keep working unchanged.
 *
 * Resilience: token retrieval is best-effort. If reading the token throws for
 * any reason, we never propagate the error - we fall back to a plain `fetch`.
 *
 * This module is browser-safe and dependency-free: it does NOT import any
 * server-only code, so it can be used from client components.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let token: string | undefined;

  try {
    // `auth` is SSR-guarded in lib/firebase and may be undefined on the server.
    const currentUser = auth?.currentUser;
    if (currentUser) {
      token = await currentUser.getIdToken();
    }
  } catch {
    // Never throw on token retrieval failure - fall back to plain fetch.
    token = undefined;
  }

  if (!token) {
    return fetch(input, init);
  }

  // Merge the Authorization header without clobbering caller-provided headers.
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}

/**
 * Convenience helper: POST a JSON body via `authedFetch`.
 *
 * Sets `Content-Type: application/json` and serializes `body`, while still
 * honoring any caller-supplied headers/options via `init`.
 */
export async function postJson(
  url: RequestInfo | URL,
  body: unknown,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return authedFetch(url, {
    method: "POST",
    ...init,
    headers,
    body: JSON.stringify(body),
  });
}
