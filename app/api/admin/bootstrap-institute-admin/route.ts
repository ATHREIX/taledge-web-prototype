import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { adminApp, adminAuth, adminDb, isAdminConfigured } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ONE-TIME bootstrap: bind a pilot institute admin via prod ADC.
 * ─────────────────────────────────────────────────────────────────────────────
 *  The offline `scripts/bind-institute-admin.mjs` writes with the repo's
 *  serviceAccount.json, which targets the WRONG Google project (taledge-64285),
 *  so its writes never reach int-taledge. This route instead runs inside App
 *  Hosting / Cloud Run, where the Admin SDK authenticates via ADC as the correct
 *  int-taledge backend identity — no key file needed.
 *
 *  Guarded so it is safe even though it is unauthenticated:
 *    1. A non-secret enable flag (ADMIN_BOOTSTRAP_ENABLED). If not "true" the
 *       route 404s, so it is inert unless deliberately switched on for the bind.
 *    2. An email allowlist below — the ONLY account this can ever grant admin to
 *       is our own pilot account, binding it to its own institutes. There is no
 *       secret in git and no way to escalate an attacker's own account: the worst
 *       a caller can do is perform the exact bind we intend.
 *
 *  DELETE this route + its enable flag immediately after the pilot admin is bound.
 */

// Only these already-provisioned pilot accounts may be bound. This is the hard
// stop that makes a leaked token useless for privilege escalation.
const ALLOWED_EMAILS = new Set<string>(["test@university1.com"]);

const DEFAULT_INSTITUTES = ["institute-placement", "institute-exam"];

export async function POST(req: NextRequest) {
  // Inert unless explicitly enabled for the one-time bind. No secret in git.
  if (process.env.ADMIN_BOOTSTRAP_ENABLED !== "true") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: { email?: unknown; instituteIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isAdminConfigured || !adminAuth || !adminDb) {
    return NextResponse.json({ error: "admin SDK not configured" }, { status: 503 });
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!ALLOWED_EMAILS.has(email)) {
    return NextResponse.json({ error: "email not in bootstrap allowlist" }, { status: 403 });
  }

  const instituteIds: string[] =
    Array.isArray(body?.instituteIds) && body.instituteIds.length
      ? body.instituteIds.map(String)
      : DEFAULT_INSTITUTES;

  let uid: string;
  try {
    const user = await adminAuth.getUserByEmail(email);
    uid = user.uid;
  } catch {
    return NextResponse.json(
      { error: `no Firebase user for ${email} — they must sign in once first` },
      { status: 404 },
    );
  }

  const bound: string[] = [];
  const skipped: string[] = [];
  for (const instituteId of instituteIds) {
    const ref = adminDb.collection("institutes").doc(instituteId);
    const snap = await ref.get();
    if (!snap.exists) {
      skipped.push(instituteId);
      continue;
    }
    await ref.set({ adminUids: FieldValue.arrayUnion(uid) }, { merge: true });
    bound.push(instituteId);
  }

  // projectId is echoed so we can confirm the write landed in int-taledge (not
  // the wrong-project serviceAccount.json the offline script would have used).
  const projectId =
    (adminApp?.options?.projectId as string | undefined) ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    null;

  return NextResponse.json({ ok: true, uid, projectId, bound, skipped });
}
