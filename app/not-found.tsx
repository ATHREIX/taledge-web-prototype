import { PageShell, Display, ButtonLink } from "@/components/ui";

/**
 * 404 boundary (App Router). Server Component - rendered when a route is not
 * matched or `notFound()` is called. Calm, on-brand, with a single way back
 * home.
 */
export default function NotFound() {
  return (
    <PageShell width="narrow">
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="section-title mb-3 text-brand-600">404 - Not found</div>
        <Display>This page doesn&apos;t exist</Display>
        <p className="mt-4 max-w-md text-sm sm:text-base text-ink-500">
          The page you&apos;re looking for may have been moved, renamed, or
          never existed. Let&apos;s get you back on track.
        </p>
        <div className="mt-8">
          <ButtonLink href="/">Go home</ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
