import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { adminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { AUTH_ENFORCED } from "@/lib/flags";
import { getInvite, getExamAspirant, getUserRole, canAdministerInstitute } from "@/lib/talent-store";
import { inviteWorkspaceId } from "@/lib/server-auth";

/** Seed aspirant ids (aspirant-001…) are fake demo data. Real aspirants are uids
 *  or candidate-inv-<token10>. */
const isSeedAspirantId = (id: string) => /^aspirant-\d+$/.test(id);

/**
 * Ownership gate for the exam-aspirant workspace subtree. Same shape as the
 * student gate: a present-but-expired cookie token → re-auth (not 404); the owner,
 * an institute admin of the aspirant's cohort, or a coach may view; seed personas
 * and demo mode are open.
 */
export default async function ExamWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!AUTH_ENFORCED || !isAdminConfigured || !adminAuth) return <>{children}</>;
  if (isSeedAspirantId(id)) return <>{children}</>;

  const jar = await cookies();
  const idToken = jar.get("firebaseIdToken")?.value;
  const inviteTok = jar.get("inviteToken")?.value;
  const reauth = (): never => redirect(`/login?next=${encodeURIComponent(`/exam/${id}`)}`);

  let callerUid: string | null = null;
  if (idToken) {
    try {
      callerUid = (await adminAuth.verifyIdToken(idToken)).uid;
    } catch {
      reauth();
    }
  }
  if (!callerUid && inviteTok) {
    try {
      if (await getInvite(inviteTok)) callerUid = inviteWorkspaceId(inviteTok);
    } catch {
      /* store read failed */
    }
  }
  if (!callerUid) return reauth();

  if (callerUid === id) return <>{children}</>;

  const role = await getUserRole(callerUid);
  if (role === "coach") return <>{children}</>;
  if (role === "institute") {
    const asp = await getExamAspirant(id);
    if (asp?.instituteId && (await canAdministerInstitute(asp.instituteId, callerUid, false))) {
      return <>{children}</>;
    }
  }
  notFound();
}
