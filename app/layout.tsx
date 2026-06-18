import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { AuthProvider } from "@/components/AuthProvider";
import { MotionProvider } from "@/components/motion-provider";

// Primary UI/body + headline typeface - premium geometric sans.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Optional editorial display serif.
const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
      <body className={`${sans.variable} ${serif.variable} ${mono.variable} antialiased bg-canvas text-ink-900 min-h-screen flex flex-col`}>
        <AuthProvider>
          <MotionProvider>
            <Nav />
            <main className="flex-1">
              {children}
            </main>
          </MotionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
