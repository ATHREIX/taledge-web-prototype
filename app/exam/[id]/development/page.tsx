// Exam track reuses the shared Development Pathway page. The Fit Score report's
// "Development Pathway" / "Continue to Development Pathway" CTAs build their href
// from the URL namespace (flowBase = "/exam"), so this route must exist or the
// exam funnel dead-ends on a 404. Mirrors every other exam sub-route re-export.
export { default } from "@/app/student/[id]/development/page";
