import "server-only";
import {
  getApps,
  initializeApp,
  cert,
  applicationDefault,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-side Firebase Admin. Used by API routes / server data access to
 * verify ID tokens and read/write Firestore with privileged access.
 *
 * Configuration (any one):
 *   - FIREBASE_SERVICE_ACCOUNT  = full service-account JSON (stringified)
 *   - GOOGLE_APPLICATION_CREDENTIALS = path to service-account file (ADC)
 *   - Running on App Hosting / Cloud Run (K_SERVICE set) = ADC from the
 *     attached backend service account, no key file needed.
 *
 * If none apply we DO NOT initialize - `adminAuth`/`adminDb` are null and
 * callers degrade gracefully (demo mode). This keeps local dev runnable without
 * a service account while making production security a config flip.
 */

function init(): App | null {
  if (getApps().length) return getApps()[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    if (raw) {
      const creds = JSON.parse(raw);
      // Normalize escaped newlines in the private key when passed via env.
      if (creds.private_key) creds.private_key = String(creds.private_key).replace(/\\n/g, "\n");
      return initializeApp({ credential: cert(creds) });
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return initializeApp({ credential: applicationDefault() });
    }
    // Google-managed runtimes (App Hosting / Cloud Run) expose ADC via the
    // attached service account — no key file required (and org policy may block
    // downloading one). K_SERVICE is injected by Cloud Run; use it as the signal.
    if (process.env.K_SERVICE) {
      return initializeApp({ credential: applicationDefault() });
    }
  } catch (e) {
    console.error("[firebase-admin] failed to initialize:", (e as Error).message);
  }
  return null;
}

const app = init();

export const adminApp: App | null = app;
export const adminAuth: Auth | null = app ? getAuth(app) : null;
export const adminDb: Firestore | null = app ? getFirestore(app) : null;
export const isAdminConfigured = !!app;
