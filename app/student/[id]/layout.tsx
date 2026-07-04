import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { adminAuth, isAdminConfigured } from "@/lib/firebase-admin";
import { AUTH_ENFORCED } from "@/lib/flags";
import { getInvite } from "@/lib/talent-store";
import { inviteWorkspaceId } from "@/lib/server-auth";
import { getCandidate, getUserRole, canAdministerInstitute } from "@/lib/talent-store";

/**
 * Ownership gate for the ENTIRE candidate workspace subtree (/student/[id] and
 * every sub-route: dnla, fit-score, report, comparison, development, interview).
 *
 * These are server components that read a CandidateRecord through the Admin SDK
 * (bypassing Firestore rules) and render name + fit/technical/behavioural scores +
 * DNLA competencies. The Edge middleware only checks that *some* credential exists
 * — it does NOT bind the request to the [id] in the URL — so without this gate any
 * signed-in user could open /student/<anyone-else's-uid> (or the enumerable
 * candidate-inv-<token10> form) and read that candidate's full assessment. This
 * closes that IDOR at the subtree root.
 *
 * Allowed: the candidate viewing their OWN workspace; a recruiter viewing a
 * candidate who published to recruiters (or is their own invitee); an institute
 * admin viewing a candidate in a cohort they administer. Everyone else → 404.
 * Demo / non-enforced mode stays open so seed personas remain browsable.
 */
export default async function StudentWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Demo / misconfigured admin: keep the open, browsable behavior.
  if (!AUTH_ENFORCED || !isAdminConfigured || !adminAuth) return <>{children}</>;

  const jar = await cookies();
  const idToken = jar.get("firebaseIdToken")?.value;
  const inviteTok = jar.get("inviteToken")?.value;

  let callerUid: string | null = null;
  if (idToken) {
    try {
      callerUid = (await adminAuth.verifyIdToken(idToken)).uid;
    } catch {
      /* invalid/expired token */
    }
  }
  // Account-less invited candidate: their workspace id IS candidate-inv-<token10>.
  if (!callerUid && inviteTok) {
    try {
      if (await getInvite(inviteTok)) callerUid = inviteWorkspaceId(inviteTok);
    } catch {
      /* store read failed → treat as unauthenticated */
    }
  }
  if (!callerUid) notFound();

  // Own workspace — the overwhelmingly common path. Short-circuit before any
  // extra reads.
  if (callerUid === id) return <>{children}</>;

  // A different account is viewing this candidate: allow only recruiters (for a
  // published candidate or their own invitee) and institute admins (for a cohort
  // they administer). Anyone else — including another candidate — gets a 404.
  const role = await getUserRole(callerUid);
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
  notFound();
}
