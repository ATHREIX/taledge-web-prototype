"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Eyebrow } from "@/components/ui";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Scrollytelling of the candidate -> Fit Score pipeline. The brand rail draws
 * itself as you scroll (scrubbed), and each act + node reveals on entry.
 * Driven by GSAP ScrollTrigger; reduced-motion users get everything static.
 */
const ACTS = [
  {
    n: "01",
    title: "AI technical interview",
    body: "Upload a résumé or job description, then a proctored voice AI runs an adaptive technical interview grounded in the candidate's skills, projects and target role - transcribed and rubric-scored live.",
    chips: ["Résumé / JD", "Adaptive", "Proctored"],
  },
  {
    n: "02",
    title: "DNLA psychometrics",
    body: "The candidate completes the DNLA questionnaire (administered by our licensed partner in Germany), mapping behavioural competencies across achievement, interpersonal, execution and resilience.",
    chips: ["Motivation", "Resilience", "Execution"],
  },
  {
    n: "03",
    title: "AI behavioural interview",
    body: "A second AI round, tailored to the DNLA report, probes the candidate's development areas with situational and adversarial follow-ups - again transcribed and scored.",
    chips: ["Behavioural", "DNLA-targeted", "Scored"],
  },
  {
    n: "04",
    title: "The Fit Score, crystallised",
    body: "Interview evidence, DNLA and résumé signals fuse into one defensible Fit Score and success probability - then fan out to recruiters on consent.",
    chips: ["Fit Score", "Success %", "Published"],
  },
];

export function Pipeline() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Animate only when the user hasn't asked for reduced motion. Otherwise
      // elements keep their natural (fully visible) state - no stuck opacity.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Rail draws top→bottom, scrubbed to the section's scroll progress.
        gsap.fromTo(
          "[data-rail]",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-rail-track]",
              start: "top 72%",
              end: "bottom 82%",
              scrub: 0.6,
            },
          }
        );

        // Each act card slides + fades in as it enters the viewport.
        gsap.utils.toArray<HTMLElement>("[data-act]").forEach((el) => {
          gsap.from(el, {
            opacity: 0,
            y: 44,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 82%",
              toggleActions: "play none none reverse",
            },
          });
        });

        // Numbered nodes pop with a slight overshoot when their row arrives.
        gsap.utils.toArray<HTMLElement>("[data-node]").forEach((el) => {
          gsap.from(el, {
            scale: 0.4,
            opacity: 0,
            duration: 0.55,
            ease: "back.out(1.7)",
            scrollTrigger: {
              trigger: el,
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          });
        });
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <section ref={root} className="relative mx-auto max-w-4xl">
      <div className="text-center">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 h-headline text-3xl sm:text-4xl text-ink-900">
          One pipeline, from résumé to <span className="text-gradient-brand">recruiter</span>
        </h2>
      </div>

      <div data-rail-track className="relative mt-16">
        {/* glowing rail - origin top so it draws downward on scroll */}
        <div
          aria-hidden
          data-rail
          style={{ transformOrigin: "top" }}
          className="absolute left-[27px] top-2 bottom-2 w-px bg-gradient-to-b from-brand-500 via-accent-500 to-transparent sm:left-1/2"
        />

        <div className="space-y-12">
          {ACTS.map((act, i) => (
            <div
              key={act.n}
              data-act
              className={
                "relative grid grid-cols-[56px_1fr] items-start gap-5 sm:grid-cols-2 sm:gap-10 " +
                (i % 2 ? "sm:[&>*:first-child]:order-2" : "")
              }
            >
              <div className={"flex sm:justify-center " + (i % 2 ? "sm:justify-start" : "sm:justify-end")}>
                <div
                  data-node
                  className="relative z-10 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-accent-500 text-lg font-black text-white shadow-panel"
                >
                  {act.n}
                </div>
              </div>
              <div className="panel p-6 sm:p-7">
                <h3 className="text-lg font-bold text-ink-900">{act.title}</h3>
                <p className="mt-2 text-sm text-ink-500">{act.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {act.chips.map((c) => (
                    <span key={c} className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
