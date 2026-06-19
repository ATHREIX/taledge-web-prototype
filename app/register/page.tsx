"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { Button, Heading, Label, Badge } from "@/components/ui";
import { AuthShell } from "@/components/landing/auth-shell";
import { cn } from "@/lib/utils";
import { ROLES, postAuthPath, type Role } from "@/lib/roles";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("candidate");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please enter your full name.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      // Best-effort profile writes - never block routing on them.
      try {
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, "users", uid), {
          uid,
          email,
          name,
          role,
          published: false,
          createdAt: new Date().toISOString(),
        });
        if (role === "candidate") {
          await setDoc(doc(db, "candidates", uid), { fullName: name, email, role, createdAt: new Date().toISOString() });
          localStorage.setItem(
            "taledge:workspace-profile",
            JSON.stringify({ fullName: name, email, targetRole: "Software Engineer" })
          );
        }
      } catch {
        /* profile persistence is non-fatal in demo */
      }
      // Honor a same-origin deep-link `?next=`; otherwise a brand-new candidate
      // starts the assessment funnel (onboarding), while other roles go to the hub.
      const nextParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      const dest =
        nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
          ? nextParam
          : role === "candidate"
          ? "/onboarding"
          : postAuthPath(role, uid);
      router.push(dest);
    } catch (err: any) {
      const code = err?.code || "";
      setError(
        code === "auth/email-already-in-use"
          ? "That email is already registered. Try signing in."
          : code === "auth/invalid-email"
          ? "Please enter a valid email address."
          : err?.message || "Could not create your account."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div>
          <Badge tone="brand" className="mb-4">Create account</Badge>
          <Heading as="h1" className="text-2xl sm:text-3xl">Join Taledge</Heading>
          <p className="mt-2 text-sm text-ink-500">Pick how you'll use Taledge, then create your account.</p>

          {/* Role picker */}
          <fieldset className="mt-6">
            <legend className="label mb-2 block">I am a…</legend>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Account type">
              {ROLES.map((r) => {
                const active = role === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRole(r.key)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl2 border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                      active
                        ? "border-brand-500 bg-brand-50 shadow-panel"
                        : "border-ink-200/70 bg-white/70 hover:border-brand-300 hover:bg-white"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold",
                        active ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"
                      )}
                    >
                      {r.initial}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink-900">{r.label}</span>
                      <span className="block text-[11px] leading-snug text-ink-500">{r.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <div role="alert" className="mt-5 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="reg-name"><Label className="mb-1 block text-ink-700">Full name</Label></label>
              <input id="reg-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="Priya Sharma" className="input" />
            </div>
            <div>
              <label htmlFor="reg-email"><Label className="mb-1 block text-ink-700">Work email</Label></label>
              <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="you@example.com" className="input" />
            </div>
            <div>
              <label htmlFor="reg-password"><Label className="mb-1 block text-ink-700">Password</Label></label>
              <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="At least 6 characters" className="input" />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading} aria-busy={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" role="img" aria-label="Creating account" /> : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-brand-700 hover:underline">Sign in</Link>
          </p>
      </div>
    </AuthShell>
  );
}
