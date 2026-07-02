/**
 * Next.js boot-time instrumentation. `register()` runs ONCE when the server
 * process starts (Node.js runtime), before any request is served.
 *
 * SAFETY GATE: refuse to boot if auth is enforced but no Firebase Admin
 * credentials are configured. Without this, an enforced build with no admin
 * would 401 every request (a silent outage), and the "obvious" fix — turning
 * AUTH_ENFORCED back off — would silently REOPEN the whole app (demo principal =
 * full access + the Gemini key becomes browser-readable). Failing fast at boot
 * forces the operator to fix the credentials, not the enforcement flag.
 */
export async function register() {
  // Only meaningful in the Node.js server runtime (admin SDK is Node-only).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const enforced = process.env.AUTH_ENFORCED === "true";
  const hasAdminCreds = !!(
    process.env.FIREBASE_SERVICE_ACCOUNT?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    // App Hosting / Cloud Run: the attached service account provides Application
    // Default Credentials (no key file). K_SERVICE is injected by the runtime and
    // is exactly the signal firebase-admin.ts uses to initialize via ADC.
    process.env.K_SERVICE?.trim()
  );

  if (enforced && !hasAdminCreds) {
    throw new Error(
      "[boot] AUTH_ENFORCED=true but no Firebase Admin credentials are configured " +
        "(set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS, or run on " +
        "App Hosting/Cloud Run where K_SERVICE provides ADC). " +
        "Refusing to start: enforced auth without admin would reject every request, and " +
        "disabling enforcement to 'fix' it would silently reopen the app. " +
        "Configure the service account, or set AUTH_ENFORCED=false for demo mode."
    );
  }
}
