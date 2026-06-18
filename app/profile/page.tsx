"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import { PageShell, Card, Button, Heading, Label, Badge, Eyebrow } from "@/components/ui";
import { roleDef } from "@/lib/roles";

type Profile = {
  uid: string;
  email: string;
  name?: string;
  role?: string;
  published?: boolean;
  linkId?: string;
  demo?: boolean;
  profile?: {
    title?: string;
    organisation?: string;
    phone?: string;
    location?: string;
    bio?: string;
  };
};

const FIELDS: { key: keyof NonNullable<Profile["profile"]>; label: string; placeholder: string; long?: boolean }[] = [
  { key: "title", label: "Title / headline", placeholder: "e.g. Final-year CSE · aspiring SDE" },
  { key: "organisation", label: "Organisation / college", placeholder: "e.g. IIT Bombay" },
  { key: "phone", label: "Phone", placeholder: "e.g. +91 98765 43210" },
  { key: "location", label: "Location", placeholder: "e.g. Mumbai, IN" },
  { key: "bio", label: "About", placeholder: "A short bio…", long: true },
];

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "loading" | "saving">("loading");
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const authHeader = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }, [user]);

  const applyProfile = (p: Profile) => {
    setProfile(p);
    setName(p.name ?? user?.displayName ?? "");
    setFields({
      title: p.profile?.title ?? "",
      organisation: p.profile?.organisation ?? "",
      phone: p.profile?.phone ?? "",
      location: p.profile?.location ?? "",
      bio: p.profile?.bio ?? "",
    });
  };

  // Load the profile once auth state resolves. Source of truth is the user's
  // Firestore doc (works for EVERY role without a service account); /api/profile
  // is only a fallback. This is why all stakeholders see their real role/name.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setNeedsAuth(true);
      setState("idle");
      return;
    }
    let cancelled = false;
    (async () => {
      setState("loading");
      // Always anchor on the REAL signed-in user (never the demo profile). The
      // Firestore doc, if present, only enriches name/role/profile fields.
      const base: Profile = {
        uid: user.uid,
        email: user.email || "",
        name: user.displayName || "",
      };
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!cancelled && snap.exists()) {
          const d = snap.data() as Partial<Profile>;
          applyProfile({
            ...base,
            ...d,
            uid: user.uid,
            email: d.email || user.email || "",
            name: d.name || user.displayName || "",
          });
        } else if (!cancelled) {
          // Self-heal: older accounts may have no users/{uid} doc. Create it from
          // the signed-in identity (no role — we can't infer it, and won't
          // mislabel a recruiter/institute as a candidate).
          setDoc(
            doc(db, "users", user.uid),
            { uid: user.uid, email: user.email || "", name: user.displayName || "", createdAt: new Date().toISOString() },
            { merge: true }
          ).catch(() => {});
          applyProfile(base);
        }
      } catch {
        if (!cancelled) applyProfile(base);
      } finally {
        if (!cancelled) setState("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  const save = async () => {
    if (!user) return;
    setState("saving");
    setMessage(null);
    const profileFields = {
      title: fields.title?.trim() || "",
      organisation: fields.organisation?.trim() || "",
      phone: fields.phone?.trim() || "",
      location: fields.location?.trim() || "",
      bio: fields.bio?.trim() || "",
    };
    try {
      // Persist directly to the user's Firestore doc — owner-scoped rules allow
      // this for every role, so it works without a service account. Identity
      // fields (role/email/uid) are preserved, never overwritten here.
      await setDoc(
        doc(db, "users", user.uid),
        { name: name.trim(), profile: profileFields, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      // Best-effort server mirror (no-op in demo) — never blocks the save.
      fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ name: name.trim(), profile: profileFields }),
      }).catch(() => {});
      setMessage({ tone: "ok", text: "Profile saved." });
    } catch {
      setMessage({ tone: "err", text: "Could not save your profile." });
    } finally {
      setState("idle");
    }
  };

  if (loading || state === "loading") {
    return (
      <PageShell width="narrow">
        <div className="flex min-h-[40vh] items-center justify-center text-ink-400">
          <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading profile" />
        </div>
      </PageShell>
    );
  }

  if (needsAuth) {
    return (
      <PageShell width="narrow">
        <Card variant="frosted" className="mx-auto max-w-md p-10 text-center">
          <Heading as="h1" className="text-2xl">Sign in to view your profile</Heading>
          <p className="mt-3 text-sm text-ink-500">Your profile is private to your account.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login" className="btn-primary">Sign in</Link>
            <Link href="/register" className="btn-ghost">Create account</Link>
          </div>
        </Card>
      </PageShell>
    );
  }

  const role = roleDef(profile?.role);

  return (
    <PageShell width="narrow">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink-200/60 bg-white/50 px-4 py-2 text-sm font-bold text-ink-600 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Dashboard
      </Link>

      <div className="mb-8">
        <Eyebrow>My profile</Eyebrow>
        <Heading as="h1" className="mt-2 text-3xl">Account & profile</Heading>
        <p className="mt-2 text-sm text-ink-500">Manage how you appear across Taledge.</p>
      </div>

      <Card className="p-6 sm:p-8">
        {/* Identity (read-only) */}
        <div className="flex items-center gap-4 border-b border-ink-100 pb-6">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-lg font-black text-white">
            {(name || profile?.email || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-bold text-ink-900">{name || "Unnamed"}</span>
              <Badge tone="brand">{role.label}</Badge>
              {profile?.demo && <Badge>Demo</Badge>}
            </div>
            <div className="truncate text-sm text-ink-500">{profile?.email}</div>
          </div>
        </div>

        {message && (
          <div
            role="status"
            className={
              "mt-6 rounded-xl border p-3 text-sm " +
              (message.tone === "ok"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-rose-100 bg-rose-50 text-rose-600")
            }
          >
            {message.text}
          </div>
        )}

        {/* Editable */}
        <div className="mt-6 space-y-5">
          <div>
            <Label className="mb-1 block text-ink-700">Full name</Label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="mb-1 block text-ink-700">{f.label}</Label>
              {f.long ? (
                <textarea
                  className="input min-h-[96px] resize-y"
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  maxLength={2000}
                />
              ) : (
                <input
                  className="input"
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  maxLength={120}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button onClick={save} disabled={state === "saving"} aria-busy={state === "saving"}>
            {state === "saving" ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Saving" /> : "Save changes"}
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
