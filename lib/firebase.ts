import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let _auth: Auth | undefined = undefined;
let _db: Firestore | undefined = undefined;

if (typeof window !== 'undefined') {
  _auth = getAuth(app);
  // Keep the user signed in across reloads and tab/browser restarts until they
  // explicitly log out (survives the session). Fire-and-forget; the default is
  // already local, but we set it explicitly to guarantee the behavior.
  setPersistence(_auth, browserLocalPersistence).catch(() => {});
  _db = getFirestore(app);
}

// SSR-guarded: undefined during server module-eval, real instances in the
// browser. All consumers are "use client" components that touch auth/db only
// inside event handlers/effects (browser), where they are always defined - so
// we export the definite types to keep call sites type-clean.
const auth = _auth as Auth;
const db = _db as Firestore;

export { app, auth, db };
