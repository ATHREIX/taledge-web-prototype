// Exam track reuses the shared per-interview report page. It derives its track
// (exam vs placement) from the URL, so under /exam it stays in the exam
// namespace for all in-page navigation.
export { default } from "@/app/student/[id]/report/[kind]/page";
