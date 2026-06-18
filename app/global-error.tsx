"use client";

import { useEffect } from "react";

/**
 * Global (root) error boundary. Catches errors thrown in the root layout
 * itself, so it must render its own <html> and <body> and CANNOT rely on
 * globals.css / the design-system components having loaded. Styling is
 * therefore inline, using the brand palette by hand (brand-600 #4f46e5,
 * canvas #f8fafc, ink #09090b / #52525b). Kept deliberately minimal.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global_error", { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          color: "#09090b",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            padding: "2rem 1.5rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#4f46e5",
              marginBottom: "0.75rem",
            }}
          >
            Application error
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "2rem",
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            Something went seriously wrong
          </h1>
          <p
            style={{
              marginTop: "1rem",
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: "#52525b",
            }}
          >
            The application failed to load. Please try again. If the problem
            keeps happening, return to the home page in a moment.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.75rem",
                color: "#a1a1aa",
              }}
            >
              Reference:{" "}
              <span style={{ fontFamily: "ui-monospace, monospace" }}>
                {error.digest}
              </span>
            </p>
          )}
          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                appearance: "none",
                cursor: "pointer",
                borderRadius: "0.75rem",
                border: "1px solid transparent",
                backgroundColor: "#4f46e5",
                color: "#ffffff",
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "0.75rem",
                border: "1px solid #e4e4e7",
                backgroundColor: "#ffffff",
                color: "#09090b",
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
