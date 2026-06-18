import Link from "next/link";
import { Logo } from "@/components/logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how" },
      { label: "Services", href: "#services" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Workspaces",
    links: [
      { label: "Candidate", href: "/student/candidate-001" },
      { label: "Recruiter", href: "/recruiter/recruiter-001" },
      { label: "Coach", href: "/coach/coach-001" },
      { label: "Institute", href: "/institute/institute-placement" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/register" },
      { label: "Start onboarding", href: "/onboarding" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mt-28 border-t border-ink-200/60">
      <div className="mx-auto grid max-w-[90rem] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" aria-label="Taledge home">
            <Logo />
          </Link>
          <p className="mt-4 max-w-xs text-sm text-ink-500">
            Measuring, predicting and improving human potential across careers and competitive pursuits.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="section-title mb-4">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm font-medium text-ink-600 transition-colors hover:text-brand-700">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-200/60">
        <div className="mx-auto flex max-w-[90rem] flex-col items-center justify-between gap-3 px-5 py-6 text-xs text-ink-400 sm:flex-row sm:px-8">
          <span>© 2026 Taledge · Talent Intelligence &amp; Success Platform</span>
          <span className="flex gap-5">
            <Link href="/login" className="hover:text-ink-700">Privacy</Link>
            <Link href="/login" className="hover:text-ink-700">Terms</Link>
            <Link href="/register" className="hover:text-ink-700">Get started</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
