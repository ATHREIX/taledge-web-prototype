// Shared config for the k6 load-test suite.
// Everything env-driven so the same script runs against local / preview / prod
// and in CI without edits.

export const BASE = __ENV.BASE || "https://taledge-be--int-taledge.us-central1.hosted.app";

// Is the target running with AUTH_ENFORCED=true? Prod is; a local `pnpm start`
// defaults to demo mode (open, no gate). Auto-off for localhost so a local run
// doesn't falsely fail the auth-enforcement assertions. Override with ENFORCED=1/0.
export const ENFORCED =
  __ENV.ENFORCED !== undefined
    ? __ENV.ENFORCED === "1" || __ENV.ENFORCED === "true"
    : !/localhost|127\.0\.0\.1/.test(BASE);

// The DNLA development video the <video> player actually streams. Range-fetched,
// never pulled in full (the files are 200-300 MB).
export const VIDEO =
  __ENV.VIDEO || "https://www.dnla.de/DLoad/Motivation.mp4";

// Include the video-origin (dnla.de) probe? Off by default in CI so we don't
// hammer a third party. Enable with VIDEO_PROBE=1 for a full playback check.
export const VIDEO_PROBE = __ENV.VIDEO_PROBE === "1";

// Public browser pages — expect a rendered document (200) or a self-gate redirect.
export const PUBLIC_PAGES = ["/", "/login", "/register", "/hero"];

// Protected pages — enforced mode must gate these (login redirect) or render (if a
// session were present). A raw 200 with PII to an anonymous VU would be a failure,
// but we can't assert that without a session, so we assert "gated or ok".
export const PROTECTED_PAGES = [
  "/dashboard",
  "/profile",
  "/recruiter",
  "/institute",
  "/coach",
];

// A protected API that MUST reject an anonymous caller in enforced mode.
export const GUARDED_API = "/api/institute/share-link";

// Statuses that are *expected* for this suite and therefore must NOT inflate
// http_req_failed:
//   206 -> video range request
//   301/302/303/307/308 -> protected-page login redirect
//   304 -> conditional cache hit
//   401/403 -> auth enforcement rejecting an anonymous caller (this is success)
//   404/405 -> guarded route intentionally not exposing a GET
// A 5xx or an unexpected 4xx (e.g. 400/429) still counts as a real failure.
export const EXPECTED_STATUSES = [
  200, 201, 204, 206, 301, 302, 303, 304, 307, 308, 401, 403, 404, 405,
];
