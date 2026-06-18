"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  PageShell,
  Card,
  ButtonLink,
  Badge,
  Eyebrow,
  Stat,
} from "@/components/ui";
import { containerVariants, itemVariants } from "@/lib/motion";
import { MarketingNav } from "@/components/landing/marketing-nav";
import { PersonaTabs } from "@/components/landing/persona-tabs";
import { Pipeline } from "@/components/landing/pipeline";
import { Features } from "@/components/landing/features";
import { Services } from "@/components/landing/services";
import { Faq } from "@/components/landing/faq";
import { MarketingFooter } from "@/components/landing/footer";
import { AnimeHeadline } from "@/components/landing/anime-headline";
import IntroGate from "@/components/landing/intro-gate";

// WebGL hero backdrop - client-only, skipped for reduced-motion, never blocks paint.
const Hero3D = dynamic(() => import("@/components/landing/hero-3d"), { ssr: false });

export default function Home() {
  return (
    <IntroGate>
      <MarketingNav />

      <PageShell width="wide" className="pb-10">
        {/* ───────────────────────── HERO ───────────────────────── */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative mx-auto max-w-3xl text-center"
        >
          {/* 3D particle ring framing the headline (text stays clear via mask) */}
          <div className="pointer-events-none absolute left-1/2 top-[44%] -z-0 h-[640px] w-[120vw] max-w-[1080px] -translate-x-1/2 -translate-y-1/2 opacity-80 [mask-image:radial-gradient(ellipse_at_center,transparent_28%,black_48%,transparent_78%)]">
            <Hero3D />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <motion.div variants={itemVariants}>
              <Badge tone="brand" className="px-3 py-1">Phase 1 · Live · Dual-track</Badge>
            </motion.div>

            <motion.div variants={itemVariants} className="mt-6">
              <AnimeHeadline
                lines={[
                  [{ text: "Turn" }, { text: "potential" }],
                  [{ text: "into" }, { text: "proof.", gradient: true }],
                ]}
              />
            </motion.div>

            <motion.p variants={itemVariants} className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-ink-500">
              Taledge measures, predicts and improves human potential - fusing AI
              interviews, DNLA psychometrics and human coaching into one defensible
              score across placement and competitive-exam success.
            </motion.p>

            <motion.div variants={itemVariants} className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <ButtonLink href="/register" size="lg" className="group rounded-full px-7 text-base">
                Get started free
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-1">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </ButtonLink>
              <ButtonLink href="/student/candidate-001" variant="ghost" size="lg" className="rounded-full">
                Explore a live workspace
              </ButtonLink>
            </motion.div>

            <motion.div variants={itemVariants} className="mt-8 grid max-w-lg grid-cols-3 gap-4">
              <Stat label="Tracks" value="2" sub="Placement · Exam" />
              <Stat label="Stakeholders" value="4" sub="Candidate→Institute" tone="brand" />
              <Stat label="DNLA axes" value="4" sub="Competency groups" />
            </motion.div>
          </div>
        </motion.section>

        {/* ───────────────────────── FEATURES ───────────────────────── */}
        <div className="mt-20">
          <Features />
        </div>

        {/* ───────────────────────── HOW IT WORKS ───────────────────────── */}
        <div id="how" className="scroll-mt-24">
          <Pipeline />
        </div>

        {/* ─────────────────────── WHO IT'S FOR ─────────────────────── */}
        <section className="mt-20">
          <div className="mb-8 text-center">
            <Eyebrow>One platform, every seat</Eyebrow>
            <h2 className="mt-3 h-headline text-3xl sm:text-4xl text-ink-900">
              See the outcome <span className="text-gradient-brand">you</span> care about
            </h2>
          </div>
          <PersonaTabs />
        </section>

        {/* ───────────────────────── SERVICES ───────────────────────── */}
        <div className="mt-20">
          <Services />
        </div>

        {/* ───────────────────────── FAQ ───────────────────────── */}
        <div className="mt-20">
          <Faq />
        </div>

        {/* ─────────────────────── FINAL CTA ─────────────────────── */}
        <section className="mt-20">
          <Card variant="frosted" className="relative overflow-hidden rounded-xl3 p-10 sm:p-16 text-center">
            <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-400/20 blur-[110px]" />
            <div className="relative">
              <Badge tone="brand" className="mb-5">Start in under a minute</Badge>
              <h2 className="mx-auto max-w-2xl h-headline text-3xl sm:text-5xl text-ink-900">
                Turn potential into a number you can <span className="text-gradient-brand">defend</span>.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-ink-500">
                Create your account, pick your role, and land straight in your workspace.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-4">
                <ButtonLink href="/register" size="lg" className="group rounded-full px-8 text-base">
                  Create your account
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-1">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </ButtonLink>
                <ButtonLink href="/login" variant="ghost" size="lg" className="rounded-full">
                  Sign in
                </ButtonLink>
              </div>
            </div>
          </Card>
        </section>
      </PageShell>

      <MarketingFooter />
    </IntroGate>
  );
}
