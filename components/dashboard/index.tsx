"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft } from "lucide-react";
import { ButtonLink, Card, Heading, PageShell, Tooltip, CountUp } from "@/components/ui";
import { containerVariants, itemVariants } from "@/lib/motion";
import { toneClasses, type Tone } from "@/lib/dashboard-theme";
import { cn } from "@/lib/utils";

/**
 * Shared dashboard kit - one consistent shell, header, KPI strip, section, and
 * empty/loading states across ALL four stakeholder dashboards (candidate,
 * recruiter, coach, institute) so they feel like one product. Content stays
 * role-specific; structure + motion + look are unified.
 */

export function DashboardShell({
  children,
  backHref = "/dashboard",
  backLabel = "Back to Dashboard",
}: {
  children: ReactNode;
  backHref?: string | null;
  backLabel?: string;
}) {
  return (
    <PageShell>
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        {backHref && (
          <motion.div variants={itemVariants} className="mb-6">
            <ButtonLink href={backHref} variant="ghost" size="sm" className="rounded-full" aria-label={backLabel}>
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </ButtonLink>
          </motion.div>
        )}
        {children}
      </motion.div>
    </PageShell>
  );
}

export function DashboardHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <motion.div variants={itemVariants} className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-ink-200/70 pb-5">
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">{eyebrow}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </motion.div>
  );
}

export interface Kpi {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
  trend?: string;
}

export function KPIGrid({ items, columns = 4 }: { items: Kpi[]; columns?: 3 | 4 }) {
  const cols = columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <motion.div variants={itemVariants} className={cn("mb-10 grid grid-cols-1 gap-4", cols)}>
      {items.map((k, i) => (
        <KPICard key={i} {...k} />
      ))}
    </motion.div>
  );
}

export function KPICard({ label, value, hint, tone = "neutral", icon, trend }: Kpi) {
  const t = toneClasses[tone];
  return (
    <Card variant="default" className="h-full rounded-xl2 p-5 transition-colors hover:border-brand-200">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400">{label}</span>
          {hint && (
            <Tooltip label={hint}>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="grid h-3.5 w-3.5 place-items-center rounded-full bg-ink-100 text-[8px] font-bold leading-none text-ink-500 transition-colors hover:bg-ink-200 hover:text-ink-700"
              >
                i
              </button>
            </Tooltip>
          )}
        </span>
        {icon && (
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg", t.bg, t.text)} aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={cn("text-3xl font-extrabold leading-none tracking-tight sm:text-4xl", valueToneClass(tone))}><KpiValue value={value} /></span>
        {trend && <span className={cn("mb-1 text-xs font-bold", t.text)}>{trend}</span>}
      </div>
    </Card>
  );
}

/** Animate plain numeric KPI values (incl. "85%"); render anything else as-is. */
function KpiValue({ value }: { value: ReactNode }) {
  if (typeof value === "number") return <CountUp value={value} />;
  if (typeof value === "string") {
    const m = value.match(/^(\d+)(\D*)$/);
    if (m) return <CountUp value={parseInt(m[1], 10)} suffix={m[2]} />;
  }
  return <>{value}</>;
}

function valueToneClass(tone: Tone): string {
  switch (tone) {
    case "brand":
      return "text-brand-700";
    case "success":
      return "text-emerald-600";
    case "warn":
      return "text-amber-600";
    case "danger":
      return "text-rose-600";
    default:
      return "text-ink-900";
  }
}

export function Section({
  title,
  description,
  actions,
  icon,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section variants={itemVariants} className={cn("mt-10", className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading as="h2" className="flex items-center gap-2 text-xl sm:text-2xl">
            {icon && <span className="text-brand-500" aria-hidden>{icon}</span>}
            {title}
          </Heading>
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </motion.section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card variant="default" className="rounded-xl2 p-8 text-center sm:p-12">
      {icon && <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl2 bg-ink-50 text-ink-400" aria-hidden>{icon}</div>}
      <Heading as="h3" className="text-lg">{title}</Heading>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}

export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-ink-400" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin" aria-label={label} />
    </div>
  );
}
