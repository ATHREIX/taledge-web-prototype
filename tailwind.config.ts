import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e5e7eb",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          950: "#0a0a0a",
        },
        // Unified product brand (indigo). Replaces the old teal palette and
        // every per-role color (violet/fuchsia/purple). Use brand-600 as the
        // primary action color across ALL roles.
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Secondary accent used only for gradient pairings (brand -> accent).
        accent: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
        },
        // Single canvas color for every page. No more #FAFAFA / slate-50 drift.
        canvas: "#F8FAFC",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        marquee: "marquee 30s linear infinite",
        "marquee-slow": "marquee 50s linear infinite",
        "fade-in": "fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-up": "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(to right, rgba(10, 10, 10, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(10, 10, 10, 0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-pattern": "32px 32px",
      },
      boxShadow: {
        'premium': '0 4px 24px -6px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0,0,0,0.2)',
        'premium-hover': '0 12px 32px -8px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0,0,0,0.2)',
        'float': '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
        // Canonical panel/card elevation. Use shadow-panel everywhere instead
        // of one-off shadow-[0_8px_30px_...] values.
        'panel': '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.12)',
        'panel-hover': '0 2px 4px rgba(16,24,40,0.05), 0 16px 40px -16px rgba(16,24,40,0.18)',
      },
      borderRadius: {
        // Canonical radii. Cards = xl2 (1rem), surfaces/panels = xl3 (1.5rem).
        'xl2': '1rem',
        'xl3': '1.5rem',
      }
    },
  },
  plugins: [],
};

export default config;
