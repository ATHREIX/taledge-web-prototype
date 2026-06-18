import { NextRequest, NextResponse } from "next/server";
import { getPrincipal, unauthorized } from "@/lib/server-auth";
import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS, userProfileEditableSchema } from "@/lib/firestore/schema";
import { logger } from "@/lib/logger";
import { isProd } from "@/lib/flags";

export const runtime = "nodejs";

// A safe default profile so the page always has something to render, even in
// demo mode (no admin configured) or before the user has saved anything.
function demoProfile(uid: string, email?: string) {
  return {
    uid,
    email: email || "demo@taledge.test",
    name: "Demo User",
    role: "candidate" as const,
    published: false,
    profile: {},
    demo: true,
  };
}

// ── GET /api/profile ──────────────────────────────────────────────────────────
// Returns the signed-in user's profile. The verified uid is the ONLY subject —
// never a query/body parameter.
export async function GET(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();

  // Demo mode or admin not configured: hand back a stable placeholder profile.
  if (principal.demo || !adminDb) {
    return NextResponse.json({ ok: true, profile: demoProfile(principal.uid, principal.email) });
  }

  try {
    const snap = await adminDb.collection(COLLECTIONS.users).doc(principal.uid).get();
    const data = snap.exists ? snap.data() : null;
    const profile = data ?? {
      uid: principal.uid,
      email: principal.email ?? "",
      name: "",
      role: "candidate",
      published: false,
      profile: {},
    };
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    logger.error("profile read failed", { uid: principal.uid, err: String(err) });
    return NextResponse.json({ ok: false, error: isProd ? "Read failed" : String(err) }, { status: 500 });
  }
}

// ── PUT /api/profile ──────────────────────────────────────────────────────────
// Updates ONLY the editable fields (name + profile sub-object). uid/email/role
// are immutable here by design — they change through auth/admin flows only.
export async function PUT(req: NextRequest) {
  const principal = await getPrincipal(req);
  if (!principal) return unauthorized();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = userProfileEditableSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid profile fields", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Demo mode / no admin: accept and echo (nothing persisted) so the UI works
  // locally without a service account.
  if (principal.demo || !adminDb) {
    return NextResponse.json({ ok: true, profile: { ...demoProfile(principal.uid, principal.email), ...parsed.data }, persisted: false });
  }

  try {
    const ref = adminDb.collection(COLLECTIONS.users).doc(principal.uid);
    await ref.set({ ...parsed.data, uid: principal.uid, updatedAt: new Date().toISOString() }, { merge: true });
    const snap = await ref.get();
    logger.info("profile updated", { uid: principal.uid });
    return NextResponse.json({ ok: true, profile: snap.data(), persisted: true });
  } catch (err) {
    logger.error("profile update failed", { uid: principal.uid, err: String(err) });
    return NextResponse.json({ ok: false, error: isProd ? "Update failed" : String(err) }, { status: 500 });
  }
}
