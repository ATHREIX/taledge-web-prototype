/**
 * Central feature/runtime flags. Import from here instead of reading
 * process.env / scattering booleans across the codebase.
 */

export const isProd = process.env.NODE_ENV === "production";

/**
 * When true, every API route and protected page REQUIRES a verified Firebase
 * ID token (firebase-admin must be configured). When false (default, demo/dev),
 * routes still work with a relaxed principal so the seeded demo personas
 * (candidate-001, recruiter-001, …) remain browsable without a real login.
 *
 * Flip on for production:  AUTH_ENFORCED=true  (+ firebase-admin service account)
 */
export const AUTH_ENFORCED = process.env.AUTH_ENFORCED === "true";

/** Hide Phase-2 (AI Coach) surfaces from production navigation. */
export const SHOW_PHASE_2 = process.env.NEXT_PUBLIC_SHOW_PHASE_2 === "true";

/**
 * Demo mode allows server fallbacks (file session store, seeded data) when no
 * backend credentials are present. Implied whenever auth is not enforced.
 */
export const DEMO_MODE = !AUTH_ENFORCED;
