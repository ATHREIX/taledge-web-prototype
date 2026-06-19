import { redirect } from "next/navigation";

// Parity with the coach/institute index pages: the /recruiter index resolves to
// the canonical recruiter workspace instead of rendering a second, divergent
// mock dashboard. One recruiter surface, consistent with the other roles.
export default function RecruiterIndexPage() {
  redirect("/recruiter/recruiter-001");
}
