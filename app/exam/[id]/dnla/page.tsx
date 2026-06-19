// Exam track reuses the shared DNLA page. The component derives its track
// (and all in-flow navigation) from the URL, so under /exam it stays in the
// exam namespace and routes on to the exam AI interview.
export { default } from "@/app/student/[id]/dnla/page";
