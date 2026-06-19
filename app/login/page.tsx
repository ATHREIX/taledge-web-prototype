"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { Button, Heading, Label, Badge } from "@/components/ui";
import { AuthShell } from "@/components/landing/auth-shell";
import { postAuthPath, type Role } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Resolve the user's role to route them to the right workspace.
      let role: Role = "candidate";
      try {
        const snap = await getDoc(doc(db, "users", cred.user.uid));
        const r = snap.exists() ? (snap.data().role as Role) : null;
        if (r) role = r;
      } catch {
        /* role lookup is non-fatal; default to candidate funnel */
      }
      // Honor a deep-link `?next=` set by middleware (so a protected URL the
      // user requested is restored after login). Only same-origin relative
      // paths are allowed — never an absolute/protocol-relative open redirect.
      const nextParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      const dest =
        nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
          ? nextParam
          : postAuthPath(role, cred.user.uid);
      router.push(dest);
    } catch (err: any) {
      const code = err?.code || "";
      setError(
        code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
          ? "Incorrect email or password."
          : code === "auth/too-many-requests"
          ? "Too many attempts. Please try again later."
          : err?.message || "Could not sign you in."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div>
          <Badge tone="brand" className="mb-4">Welcome back</Badge>
          <Heading as="h1" className="text-2xl sm:text-3xl">Sign in to Taledge</Heading>
          <p className="mt-2 text-sm text-ink-500">Access your assessments and workspace.</p>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="login-email"><Label className="mb-1 block text-ink-700">Email</Label></label>
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="you@example.com" className="input" />
            </div>
            <div>
              <label htmlFor="login-password"><Label className="mb-1 block text-ink-700">Password</Label></label>
              <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="••••••••" className="input" />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading} aria-busy={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" role="img" aria-label="Signing in" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            New to Taledge?{" "}
            <Link href="/register" className="font-bold text-brand-700 hover:underline">Create an account</Link>
          </p>
      </div>
    </AuthShell>
  );
}
