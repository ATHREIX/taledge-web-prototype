"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Role } from '@/lib/roles';

// Mirror the Firebase ID token into a cookie the Edge middleware can read.
// Firebase client auth lives in IndexedDB (no cookie), so without this the
// server-side route guard (AUTH_ENFORCED=true) bounces every navigation to
// /login. The token is still verified per-request via getPrincipal in API
// routes - this cookie is only the coarse page gate.
const TOKEN_COOKIE = 'firebaseIdToken';
function setTokenCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  if (token) {
    document.cookie = `${TOKEN_COOKIE}=${token}; path=/; max-age=3600; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`;
  }
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
      try {
        setTokenCookie(user ? await user.getIdToken() : null);
      } catch {
        /* cookie mirror is best-effort */
      }
      // Resolve the stakeholder role once per sign-in (best-effort), and cache
      // it so the role-aware nav is instant next time.
      if (!user) {
        setRole(null);
        try {
          localStorage.removeItem('taledge:role');
          localStorage.removeItem('taledge:roleUid');
        } catch { /* no-op */ }
      } else {
        // The cached role is only valid for the SAME uid. If a different user
        // just signed in (Firebase fires onIdTokenChanged directly with the new
        // user, with no intervening null event), drop the previous user's role
        // up front so a stale value can't drive the wrong workspace nav while/if
        // the new user's doc lacks a role or the read fails transiently.
        try {
          const cachedUid = localStorage.getItem('taledge:roleUid');
          if (cachedUid && cachedUid !== user.uid) {
            setRole(null);
            localStorage.removeItem('taledge:role');
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
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, role }}>
      {children}
    </AuthContext.Provider>
  );
}
