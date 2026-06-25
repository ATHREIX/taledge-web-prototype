import type { Metadata } from "next";
import { Sora, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { AuthProvider } from "@/components/AuthProvider";
import { MotionProvider } from "@/components/motion-provider";
import { ToastProvider, CommandPalette } from "@/components/ui";

// SINGLE product typeface - Sora. One premium geometric variable sans powers
// EVERY surface (body, UI, and display headings) for a cohesive, world-class
// edtech feel. Exposed as `--font-sans`; tailwind's `font-sans` AND
// `font-display` tokens both resolve here, so there is one typeface everywhere.
const sans = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Code-only monospace (interview code editor, snippets). Functional, not a
// competing brand font.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Enterprise marketing typeface - Inter. Scoped to the redesigned landing
// surface via `--font-inter` so the rest of the app keeps its Sora identity.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taledge · Talent Intelligence & Success Platform",
  description:
    "Measuring, predicting, and improving human potential across careers and competitive pursuits.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} ${inter.variable} antialiased bg-canvas text-ink-900 min-h-screen flex flex-col`}>
        <AuthProvider>
          <ToastProvider>
            <MotionProvider>
              <Nav />
              <main className="flex-1">
                {children}
              </main>
              <CommandPalette />
            </MotionProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
