"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Role } from '@/lib/roles';
import { writeSessionCookie, clearSessionCookie } from '@/lib/session-cookie';
import { clearWorkspaceData } from '@/lib/workspace-data';

// The gate cookie the Edge middleware reads lives in lib/session-cookie so the
// login/register flows can write it SYNCHRONOUSLY before navigating (avoiding
// the race with this async listener). Here we only keep it fresh on token
// refresh / sign-out.
function setTokenCookie(token: string | null) {
  if (token) writeSessionCookie(token);
  else clearSessionCookie();
}

type AuthContextType = {
  user: User | null;
  loading: boolean;
  /** The signed-in user's stakeholder role (from users/{uid}.role), or null
   * in demo/unknown - drives role-aware navigation. */
  role: Role | null;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, role: null });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  // Have we ever seen a real signed-in user? Guards the cookie-clear so a
  // transient/initial null doesn't sign the user out (see the listener below).
  const hadUserRef = useRef(false);

  // Hydrate role from cache on mount so the role-aware nav renders instantly on
  // repeat visits, instead of flashing a neutral nav while Firestore is read.
  useEffect(() => {
    try {
      const cached = localStorage.getItem('taledge:role');
      if (cached) setRole(cached as Role);
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    // onIdTokenChanged fires on sign-in, sign-out, AND hourly token refresh, so
    // the cookie stays fresh and the middleware gate keeps passing.
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        hadUserRef.current = true;
        try {
          setTokenCookie(await user.getIdToken());
        } catch {
          /* cookie mirror is best-effort */
        }
        // The cached role is only valid for the SAME uid. If a different user
        // just signed in (Firebase fires onIdTokenChanged directly with the new
        // user, with no intervening null event), drop the previous user's role
        // up front so a stale value can't drive the wrong workspace nav while/if
        // the new user's doc lacks a role or the read fails transiently.
        try {
          const cachedUid = localStorage.getItem('taledge:roleUid');
          if (cachedUid && cachedUid !== user.uid) {
            // A DIFFERENT account just signed in on this browser (no intervening
            // null event). Purge the previous user's workspace data so their
            // résumé/interviews/reports don't show as this user's own.
            setRole(null);
            clearWorkspaceData();
          }
          localStorage.setItem('taledge:roleUid', user.uid);
        } catch { /* no-op */ }
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          const r = snap.exists() ? (snap.data().role as Role | undefined) : undefined;
          if (r) {
            setRole(r);
            try { localStorage.setItem('taledge:role', r); } catch { /* no-op */ }
          }
          // If the doc has no role, keep this uid's cached value rather than blanking it.
        } catch {
          /* keep cached role on a transient read failure (same uid) */
        }
      } else if (hadUserRef.current) {
        // A REAL sign-out (we previously had a user). Only NOW clear the cookie +
        // purge workspace data. CRITICAL: a transient/initial null — which fires
        // before a persisted session restores, or on a brief auth flicker — must
        // NOT clear the cookie, or the next navigation is bounced to /login and
        // reads as "it randomly signed me out". Explicit logout (nav.tsx) also
        // clears the cookie directly, so this only handles genuine session loss.
        hadUserRef.current = false;
        setRole(null);
        setTokenCookie(null);
        clearWorkspaceData();
      }
    });

    return () => unsubscribe();
  }, []);

  // Keep the gate cookie alive across idle/backgrounded tabs. The cookie tracks
  // the 1h token; Firebase auto-refreshes the token only on ACTIVE tabs, so a tab
  // left idle/backgrounded past ~1h lets the cookie lapse — and the next
  // navigation is bounced to /login ("it signed me out after a while"). On the
  // tab becoming visible / regaining focus, re-mint the cookie from a fresh token
  // BEFORE the user navigates.
  useEffect(() => {
    if (!auth) return;
    const refresh = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const u = auth?.currentUser;
      if (!u) return;
      try {
        writeSessionCookie(await u.getIdToken());
      } catch {
        /* best-effort */
      }
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, role }}>
      {children}
    </AuthContext.Provider>
  );
}
