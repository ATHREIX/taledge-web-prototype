"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Mirror the Firebase ID token into a cookie the Edge middleware can read.
// Firebase client auth lives in IndexedDB (no cookie), so without this the
// server-side route guard (AUTH_ENFORCED=true) bounces every navigation to
// /login. The token is still verified per-request via getPrincipal in API
// routes — this cookie is only the coarse page gate.
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
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
