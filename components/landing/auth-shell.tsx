import Link from "next/link";
import { Logo } from "@/components/logo";

const POINTS = [
  "AI interviews + DNLA psychometrics",
  "One defensible Fit Score & success probability",
  "Coaching pathways to close every gap",
];

/**
 * Split-screen auth layout. A branded gradient story panel on the left fills
 * the page; the form sits in a centered column on the right. Collapses to a
 * single column (form only, with a logo) on mobile.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left - brand story */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-accent-600 p-12 text-white lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_75%)]" />
        </div>

        <Link href="/" className="relative inline-flex" aria-label="Taledge home">
          <Logo inverted />
        </Link>

        <div className="relative max-w-md">
          <h2 className="h-headline text-4xl leading-[1.1] text-white">
            Turn potential into <span className="text-accent-200">proof</span>.
          </h2>
          <p className="mt-4 text-white/80">
            Talent intelligence that measures, predicts and improves human
            potential - across placement and competitive-exam success.
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm font-medium text-white/90">
                <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">© 2026 Taledge · Talent Intelligence Platform</p>
      </div>

      {/* Right - form */}
      <div className="relative flex items-center justify-center bg-canvas px-6 py-12 sm:px-10">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex lg:hidden" aria-label="Taledge home">
            <Logo />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
