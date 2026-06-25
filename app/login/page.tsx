"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type UserCredential,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { postAuthPath, type Role } from "@/lib/roles";
import {
  EnterpriseAuthShell,
  EntField,
  MailIcon,
  LockIcon,
  PasswordToggle,
  SsoButton,
  GoogleIcon,
  MicrosoftIcon,
  Spinner,
  Arrow,
} from "@/components/landing/enterprise/auth-kit";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sso, setSso] = useState<"google" | "microsoft" | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Shared post-auth routing: resolve role, honor a same-origin ?next=, else hub.
  const routeAfterAuth = async (cred: UserCredential) => {
    let role: Role = "candidate";
    try {
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const r = snap.exists() ? (snap.data().role as Role) : null;
      if (r) role = r;
    } catch {
      /* role lookup is non-fatal */
    }
    const nextParam =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
    const dest =
      nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
        ? nextParam
        : postAuthPath(role, cred.user.uid);
    router.push(dest);
  };

  const friendly = (code: string, fallback: string) =>
    code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
      ? "Incorrect email or password."
      : code === "auth/too-many-requests"
      ? "Too many attempts. Please try again later."
      : code === "auth/operation-not-allowed"
      ? "Single sign-on isn't enabled for this workspace yet - please sign in with your email."
      : code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"
      ? ""
      : fallback;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      // Persistence is best-effort: it touches web storage, which throws in
      // private/incognito or storage-blocked contexts. A failure here must NOT
      // abort sign-in (firebase.ts already defaults to local persistence), so
      // swallow it rather than letting it skip signIn/popup entirely.
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence).catch(
        () => {}
      );
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await routeAfterAuth(cred);
    } catch (err: any) {
      setError(friendly(err?.code || "", err?.message || "Could not sign you in."));
    } finally {
      setLoading(false);
    }
  };

  const handleSso = async (which: "google" | "microsoft") => {
    setError("");
    setInfo("");
    setSso(which);
    // Safety net: signInWithPopup resolves via a cross-window message. If the
    // popup is closed in a way that never delivers that message (COOP/COEP
    // isolation, an abandoned tab), the promise can hang and the button would
    // stay disabled forever. Regaining focus after the popup closes releases the
    // spinner so the user can retry without reloading.
    const release = () => setSso(null);
    window.addEventListener("focus", release, { once: true });
    try {
      // Persistence is best-effort: it touches web storage, which throws in
      // private/incognito or storage-blocked contexts. A failure here must NOT
      // abort sign-in (firebase.ts already defaults to local persistence), so
      // swallow it rather than letting it skip signIn/popup entirely.
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence).catch(
        () => {}
      );
      const provider =
        which === "google" ? new GoogleAuthProvider() : new OAuthProvider("microsoft.com");
      const cred = await signInWithPopup(auth, provider);
      await routeAfterAuth(cred);
    } catch (err: any) {
      const msg = friendly(err?.code || "", err?.message || "Could not complete single sign-on.");
      if (msg) setError(msg);
    } finally {
      window.removeEventListener("focus", release);
      setSso(null);
    }
  };

  const handleForgot = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email above, then select Forgot password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo("Password reset link sent. Check your inbox.");
    } catch (err: any) {
      setError(friendly(err?.code || "", "Could not send a reset link right now."));
    }
  };

  const busy = loading || sso !== null;

  return (
    <EnterpriseAuthShell
      heading="Turn potential into proof."
      sub="The talent-intelligence platform that fuses AI interviews, DNLA psychometrics and human coaching into one defensible score - for the teams that assess, hire and develop talent."
    >
      <div>
        <h1 className="text-[1.9rem] font-extrabold tracking-[-0.02em] text-[#081A3A]">Sign in</h1>
        <p className="mt-2 text-[14.5px] text-slate-500">
          Access your assessments, pipelines and workspace.
        </p>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13.5px] text-rose-700">
            <span aria-hidden className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white">!</span>
            {error}
          </div>
        )}
        {info && (
          <div role="status" className="mt-6 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13.5px] text-emerald-700">
            <span aria-hidden className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">✓</span>
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <EntField
            label="Work email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
            autoComplete="email"
            required
            icon={<MailIcon />}
          />
          <EntField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            icon={<LockIcon />}
            trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          />

          <div className="flex items-center justify-between pt-0.5">
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13.5px] font-medium text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0057FF] accent-[#0057FF] focus:ring-[#0057FF]"
              />
              Remember me
            </label>
            <button type="button" onClick={handleForgot} className="text-[13.5px] font-semibold text-[#0057FF] hover:underline">
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            aria-busy={loading}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0057FF] px-6 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-[#0F4CFF] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Spinner /> : <>Sign in <Arrow className="transition-transform group-hover:translate-x-0.5" /></>}
          </button>
        </form>

        {/* SSO */}
        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[12px] font-medium uppercase tracking-wider text-slate-400">or continue with</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SsoButton onClick={() => handleSso("microsoft")} disabled={busy} icon={sso === "microsoft" ? <Spinner className="text-slate-400" /> : <MicrosoftIcon />}>
            Microsoft
          </SsoButton>
          <SsoButton onClick={() => handleSso("google")} disabled={busy} icon={sso === "google" ? <Spinner className="text-slate-400" /> : <GoogleIcon />}>
            Google
          </SsoButton>
        </div>

        {/* Trust */}
        <div className="mt-7 flex items-center justify-center gap-2 text-[12.5px] text-slate-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0057FF]" aria-hidden>
            <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4Z" /><path d="m9 12 2 2 4-4" />
          </svg>
          Secure enterprise authentication with encrypted access.
        </div>

        <p className="mt-7 text-center text-[14px] text-slate-500">
          New to Taledge?{" "}
          <Link href="/register" className="font-semibold text-[#0057FF] hover:underline">Get started</Link>
        </p>
      </div>
    </EnterpriseAuthShell>
  );
}
