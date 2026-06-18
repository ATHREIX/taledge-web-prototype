"use client";

import { useEffect } from "react";
import { PageShell, Display, Button, ButtonLink } from "@/components/ui";

/**
 * Route-level error boundary (App Router). Rendered when a route segment
 * throws on the client or server. Must be a Client Component and accept
 * `error` + `reset`. We never surface the raw error message/stack to the
 * user - only a calm, generic recovery screen. The digest is logged to the
 * console so it can be correlated with server logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client boundary: the server-only logger can't run here. Emit the
    // digest (an opaque server-generated id) for correlation, not the stack.
    console.error("route_error", { digest: error.digest });
  }, [error]);

  return (
    <PageShell width="narrow">
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="section-title mb-3 text-brand-600">Something went wrong</div>
        <Display>We hit an unexpected error</Display>
        <p className="mt-4 max-w-md text-sm sm:text-base text-ink-500">
          Sorry about that. The page failed to load. You can try again, or head
          back home and pick up where you left off.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-ink-400">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <ButtonLink href="/" variant="ghost">
            Go home
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
