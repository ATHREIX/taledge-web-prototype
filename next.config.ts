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
  // tfhub.dev / kaggle host the BlazeFace proctoring model (redirects to
  // storage.googleapis.com). google-analytics + analytics.google.com are
  // Firebase Analytics measurement endpoints.
  "connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://*.googleapis.com wss://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.google.com https://cdn.jsdelivr.net https://login.microsoftonline.com https://tfhub.dev https://www.kaggle.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "img-src 'self' data: blob: https:",
  // apis.google.com hosts the Firebase auth popup/iframe client (Google + Microsoft SSO).
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://apis.google.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // Firebase signInWithPopup renders the auth handler from the project's
  // authDomain (*.firebaseapp.com) and the providers' own sign-in screens.
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://login.microsoftonline.com",
  // cdn.jsdelivr.net: the Monaco editor loads its editor.main.css stylesheet from
  // jsdelivr; without it here the code editor renders unstyled (broken layout).
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
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
