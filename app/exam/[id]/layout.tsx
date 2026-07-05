import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { adminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { AUTH_ENFORCED } from "@/lib/flags";
import { getInvite } from "@/lib/talent-store";
import { inviteWorkspaceId } from "@/lib/server-auth";

/**
 * Ownership gate for the exam-aspirant workspace subtree (/exam/[id] and its
 * sub-routes). Same IDOR class as /student/[id]: these server components render an
 * aspirant's readiness scores + wellbeing, and middleware only checks that *some*
 * credential exists. Allow the aspirant viewing their OWN workspace (a logged-in
 * uid, or an account-less invited aspirant whose id is candidate-inv-<token10>);
 * everyone else 404s. Demo / non-enforced stays open so seed aspirants are
 * browsable. (Institutes see their exam cohort in AGGREGATE on the institute
 * dashboard, not via individual /exam/[id] pages.)
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

  const jar = await cookies();
  const idToken = jar.get("firebaseIdToken")?.value;
  const inviteTok = jar.get("inviteToken")?.value;

  let callerUid: string | null = null;
  if (idToken) {
    try {
      callerUid = (await adminAuth.verifyIdToken(idToken)).uid;
    } catch {
      /* invalid/expired */
    }
  }
  if (!callerUid && inviteTok) {
    try {
      if (await getInvite(inviteTok)) callerUid = inviteWorkspaceId(inviteTok);
    } catch {
      /* store read failed */
    }
  }
  if (callerUid !== id) notFound();
  return <>{children}</>;
}
