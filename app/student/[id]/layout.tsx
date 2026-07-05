import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { adminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { AUTH_ENFORCED } from "@/lib/flags";
import { getInvite, getCandidate, getUserRole, canAdministerInstitute } from "@/lib/talent-store";
import { inviteWorkspaceId } from "@/lib/server-auth";

/** Seed persona ids (candidate-001…) hold FAKE demo data, not real PII, so they're
 *  browsable by any signed-in user (the landing "explore a live workspace" demo).
 *  Real candidates are uids or candidate-inv-<token10> (which contains "inv"). */
const isSeedCandidateId = (id: string) => /^candidate-\d+$/.test(id);

/**
 * Ownership gate for the candidate workspace subtree (/student/[id]/*). Closes the
 * IDOR where any signed-in user could read another candidate's scores/DNLA/PII,
 * WITHOUT bouncing legitimate users:
 *  - A present-but-EXPIRED cookie token (idle tab) → redirect to /login (re-auth),
 *    NOT a 404. notFound() is reserved for a VALID credential that isn't authorized.
 *  - Allowed: the owner; a recruiter for a consented/own-invitee candidate; an
 *    institute admin for a cohort they administer; a coach (internal staff review
 *    mentees); seed demo personas; and demo/non-enforced mode.
 */
export default async function StudentWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!AUTH_ENFORCED || !isAdminConfigured || !adminAuth) return <>{children}</>;
  if (isSeedCandidateId(id)) return <>{children}</>;

  const jar = await cookies();
  const idToken = jar.get("firebaseIdToken")?.value;
  const inviteTok = jar.get("inviteToken")?.value;
  const reauth = (): never => redirect(`/login?next=${encodeURIComponent(`/student/${id}`)}`);

  let callerUid: string | null = null;
  if (idToken) {
    try {
      callerUid = (await adminAuth.verifyIdToken(idToken)).uid;
    } catch {
      // Present but expired/invalid (typically an idle-tab cookie whose token
      // lapsed). Re-authenticate — do NOT 404 the user out of their own workspace.
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

  // Own workspace — the common path.
  if (callerUid === id) return <>{children}</>;

  const role = await getUserRole(callerUid);
  if (role === "coach") return <>{children}</>; // internal staff review mentee workspaces
  if (role === "recruiter" || role === "institute") {
    const cand = await getCandidate(id);
    if (cand) {
      if (role === "recruiter" && (cand.publishedToRecruiters || cand.recruiterId === callerUid)) {
        return <>{children}</>;
      }
      if (role === "institute" && cand.instituteId && (await canAdministerInstitute(cand.instituteId, callerUid, false))) {
        return <>{children}</>;
      }
    }
  }
  notFound(); // a valid credential that is not authorized for this candidate → real IDOR block
}
