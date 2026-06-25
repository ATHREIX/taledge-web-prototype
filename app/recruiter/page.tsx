import { redirect } from "next/navigation";

// Parity with the coach/institute index pages: the /recruiter index resolves to
// the canonical recruiter workspace instead of rendering a second, divergent
// mock dashboard. One recruiter surface, consistent with the other roles.
export default function RecruiterIndexPage() {
  // In enforced mode, route through the dashboard so the signed-in user lands on
  // their OWN uid-keyed workspace instead of the seed recruiter persona.
  if (process.env.NEXT_PUBLIC_AUTH_ENFORCED === "true") {
    redirect("/dashboard");
  }
  redirect("/recruiter/recruiter-001");
}
