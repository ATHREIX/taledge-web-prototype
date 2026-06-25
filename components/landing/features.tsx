"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Eyebrow } from "@/components/ui";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Feature = { title: string; body: string; path: string };

const FEATURES: Feature[] = [
  {
    title: "AI voice interviews",
    body: "Proctored technical and behavioural interviews run by a live voice agent, transcribed and scored against a rubric.",
    path: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3",
  },
  {
    title: "DNLA psychometrics",
    body: "Competency intelligence across achievement, interpersonal, execution and resilience - benchmarked to top performers.",
    path: "M3 3v18h18M7 14l4-4 3 3 5-6",
  },
  {
    title: "The Fit Score",
    body: "One defensible number fusing skills, interview evidence and psychometrics into a success probability.",
    path: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 5v5l3 3",
  },
  {
    title: "Coaching pathways",
    body: "Every gap becomes a tracked development plan with risk-ranked coaching sessions and measurable progress.",
    path: "M12 20h9M3 20h2M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  },
  {
    title: "Recruiter visibility",
    body: "Verified, role-matched candidates published with consent - shortlist on evidence, not keywords.",
    path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M23 21v-2a4 4 0 0 0-3-3.87",
  },
  {
    title: "Institute analytics",
    body: "Cohort readiness heatmaps, at-risk early-warning lists, and intervention impact tracking across batches.",
    path: "M3 3v18h18M8 17V9M13 17V5M18 17v-6",
  },
];

export function Features() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // ── Desktop: pin the section and scrub the cards horizontally ─────────
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const pin = root.current!.querySelector<HTMLElement>("[data-pin]")!;
        const track = root.current!.querySelector<HTMLElement>("[data-track]")!;
        const distance = () => Math.max(0, track.scrollWidth - pin.clientWidth);

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: pin,
            start: "top top",
            end: () => "+=" + distance(),
            pin: true,
            scrub: 1,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        tl.to(track, { x: () => -distance(), ease: "none" }, 0).fromTo(
          "[data-progress]",
          { scaleX: 0 },
          { scaleX: 1, ease: "none" },
          0
        );

        // Parallax the icon inside each card as it travels across the viewport.
        gsap.utils.toArray<HTMLElement>("[data-card-icon]").forEach((icon) => {
          gsap.fromTo(
            icon,
            { yPercent: -12 },
            {
              yPercent: 12,
              ease: "none",
              scrollTrigger: { trigger: pin, start: "top top", end: () => "+=" + distance(), scrub: true },
            }
          );
        });
      });

      // ── Mobile: simple staggered reveal as cards scroll into view ─────────
      mm.add("(max-width: 1023px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-card]").forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 28,
            duration: 0.5,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none reverse" },
          });
        });
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} id="features" className="scroll-mt-24">
      <div className="text-center">
        <Eyebrow>Capabilities</Eyebrow>
        <h2 className="mt-3 h-headline text-3xl sm:text-4xl text-ink-900">
          Everything to measure & grow <span className="text-gradient-brand">human potential</span>
        </h2>
        <p className="mt-3 hidden text-sm font-semibold uppercase tracking-[0.15em] text-ink-400 lg:block">
          Scroll to explore →
        </p>
      </div>

      {/* Pinned horizontal viewport on desktop; normal vertical flow on mobile. */}
      <div
        data-pin
        className="relative mt-10 lg:mt-14 lg:flex lg:h-[78vh] lg:items-center lg:overflow-hidden"
      >
        <div
          data-track
          className="flex flex-col gap-5 lg:w-max lg:flex-row lg:gap-7 lg:px-2"
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              data-card
              className="group w-full rounded-xl2 border border-ink-200/70 bg-white/80 p-7 shadow-panel backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-panel-hover hover:border-brand-200 lg:w-[360px] lg:flex-shrink-0"
            >
              <span
                data-card-icon
                className="mb-5 grid h-12 w-12 place-items-center rounded-xl2 border border-brand-100 bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={f.path} />
                </svg>
              </span>
              <h3 className="text-xl font-bold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{f.body}</p>
            </div>
          ))}
        </div>

        {/* Scrub progress bar - desktop only */}
        <div aria-hidden className="absolute bottom-6 left-1/2 hidden h-1 w-48 -translate-x-1/2 overflow-hidden rounded-full bg-ink-200/60 lg:block">
          <div data-progress className="h-full w-full origin-left rounded-full bg-gradient-to-r from-brand-600 to-accent-500" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </section>
  );
}
