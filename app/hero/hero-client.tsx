"use client";

import dynamic from "next/dynamic";

// Client-only: the animation uses requestAnimationFrame, ResizeObserver and
// localStorage (read in a state initializer), so SSR would mismatch on hydrate.
const TaledgeHero = dynamic(() => import("@/components/landing/taledge-hero"), {
  ssr: false,
  loading: () => <div style={{ position: "absolute", inset: 0, background: "#050506" }} />,
});

export default function HeroClient() {
  return <TaledgeHero />;
}
