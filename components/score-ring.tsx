export function ScoreRing({
  value,
  size = 120,
  stroke = 10,
  label,
  sub,
  tone = "dark",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sub?: string;
  tone?: "dark" | "success" | "warn" | "danger" | "muted";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  const stroked: Record<string, string> = {
    dark: "#0a0a0a",
    success: "#10b981",
    warn: "#f59e0b",
    danger: "#e11d48",
    muted: "#a1a1aa",
  };

  const ariaLabel =
    value === -1
      ? `${label ? `${label}: ` : ""}score pending`
      : `${label ? `${label}: ` : ""}${Math.round(value)} percent${sub ? `, ${sub}` : ""}`;

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={ariaLabel}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#e5e7eb"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroked[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-xl font-medium leading-none text-ink-900">
          {value === -1 ? (
            "Pending"
          ) : (
            <>
              {Math.round(value)}
              <span className="ml-0.5 text-xs text-ink-500">%</span>
            </>
          )}
        </div>
        {label && (
          <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-500">
            {label}
          </div>
        )}
        {sub && <div className="mt-0.5 text-[10px] text-ink-500">{sub}</div>}
      </div>
    </div>
  );
}

export function Bar({
  value,
  max = 100,
  tone = "dark",
  showVal = false,
}: {
  value: number;
  max?: number;
  tone?: "dark" | "success" | "warn" | "danger" | "muted";
  showVal?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors: Record<string, string> = {
    dark: "bg-ink-900",
    success: "bg-emerald-500",
    warn: "bg-amber-500",
    danger: "bg-rose-500",
    muted: "bg-ink-400",
  };
  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={`${value.toFixed(1)} of ${max}`}
    >
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${colors[tone]} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showVal && (
        <span className="w-10 text-right text-xs tabular-nums text-ink-600">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export function Sparkline({
  data,
  tone = "dark",
  height = 40,
}: {
  data: number[];
  tone?: "dark" | "success" | "warn" | "danger";
  height?: number;
}) {
  const w = 200;
  const stroke: Record<string, string> = {
    dark: "#0a0a0a",
    success: "#10b981",
    warn: "#f59e0b",
    danger: "#e11d48",
  };

  // Guard against missing/empty data so the chart never renders NaN paths.
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="No trend data available"
      >
        <line
          x1="0"
          x2={w}
          y1={height / 2}
          y2={height / 2}
          stroke="#e5e7eb"
          strokeWidth="1.6"
          strokeDasharray="3 4"
        />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const span = data.length - 1 || 1;
  const points = data
    .map((v, i) => {
      const x = (i / span) * w;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const id = `sg-${tone}-${Math.random().toString(36).slice(2, 7)}`;
  const last = data[data.length - 1];
  const first = data[0];
  const trend = last > first ? "trending up" : last < first ? "trending down" : "flat";
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend ${trend}, latest value ${last}`}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke[tone]} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke[tone]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={stroke[tone]}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      <polygon
        points={`0,${height} ${points} ${w},${height}`}
        fill={`url(#${id})`}
      />
    </svg>
  );
}
