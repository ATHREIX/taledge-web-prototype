import type { Metadata } from "next";
import HeroClient from "./hero-client";

export const metadata: Metadata = {
  title: "Taledge — Hero animation",
  description: "12-second Taledge brand hero animation.",
};

export default function HeroPage() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#050506" }}>
      <HeroClient />
    </div>
  );
}
