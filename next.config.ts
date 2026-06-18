import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/**
 * Content-Security-Policy.
 *
 * - connect-src allows the app's own origin, the Gemini / Firebase / Google
 *   backends (https + wss for streaming sockets), and cdn.jsdelivr.net for the
 *   TensorFlow.js proctoring WASM/backend assets.
 * - script-src needs unsafe-inline + unsafe-eval/wasm-unsafe-eval and
 *   cdn.jsdelivr.net + blob: because the Monaco editor and TFJS compile and load
 *   code (incl. workers via blob: URLs) and wasm.
 * - worker-src 'self' blob: lets Monaco language services and TFJS web workers
 *   spin up (CSP3 would otherwise fall back to script-src and block blob:).
 * - frame-ancestors 'none' blocks clickjacking (mirrors X-Frame-Options: DENY).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://*.googleapis.com wss://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.google.com https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
]
  .join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  // Keep these server-only packages OUT of the webpack bundle (require them as
  // normal node modules at runtime). unpdf/pdfkit use `import.meta` and native-
  // style resolution that webpack mangles — bundling them crashed the
  // /api/parse-resume function on Vercel (HTML 500 instead of JSON).
  serverExternalPackages: ["unpdf", "pdfkit", "firebase-admin"],
  // NOTE: experimental.optimizePackageImports (framer-motion/lucide-react) was
  // removed — its dev-HMR rewriting intermittently produced corrupt module
  // chunks ("Cannot read properties of undefined (reading 'call')") at the
  // layout boundary. Stability > a marginal dev bundle win.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
