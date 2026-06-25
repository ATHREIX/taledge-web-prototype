import { redirect } from "next/navigation";

export default function CoachIndexPage() {
  // In enforced mode, route through the dashboard so the signed-in user lands on
  // their OWN uid-keyed workspace instead of the seed coach persona.
  if (process.env.NEXT_PUBLIC_AUTH_ENFORCED === "true") {
    redirect("/dashboard");
  }
  redirect("/coach/coach-001");
}
