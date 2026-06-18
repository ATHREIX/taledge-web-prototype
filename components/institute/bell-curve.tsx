"use client";

/**
 * BellCurve - a normal-distribution SVG with three shaded bands (20/60/20)
 * tinted brand / amber / rose, labelled with band name, count and percentage.
 * Purely presentational; the cohort split is computed by the caller.
 */

export type CurveBand = {
  key: "best" | "average" | "below";
  label: string;
  count: number;
  pct: number; // 0-100
};

const W = 720;
const H = 280;
const PAD_X = 24;
const BASE_Y = 232;
const TOP_Y = 36;

// Standard-normal-ish curve sampled across the width. Deterministic.
function bellPath() {
  const innerW = W - PAD_X * 2;
  const amp = BASE_Y - TOP_Y;
  const pts: string[] = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0..1
    const x = PAD_X + t * innerW;
    // map t to z in [-3, 3]
    const z = (t - 0.5) * 6;
    const y = BASE_Y - amp * Math.exp(-(z * z) / 2);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

const CURVE = bellPath();
const AREA = `${CURVE} L${(W - PAD_X).toFixed(2)},${BASE_Y} L${PAD_X.toFixed(2)},${BASE_Y} Z`;

// Band split points: bottom 20% | middle 60% | top 20% (by fit, ascending on x).
// We render left = below-par (low fit), right = best (high fit).
const X0 = PAD_X;
const X1 = PAD_X + (W - PAD_X * 2) * 0.2;
const X2 = PAD_X + (W - PAD_X * 2) * 0.8;
const X3 = W - PAD_X;

const BAND_TINTS = {
  below: { fill: "rgba(225,29,72,0.14)", text: "text-rose-700", stroke: "#e11d48" },
  average: { fill: "rgba(245,158,11,0.14)", text: "text-amber-700", stroke: "#f59e0b" },
  best: { fill: "rgba(79,70,229,0.16)", text: "text-brand-700", stroke: "#4f46e5" },
};

export function BellCurve({
  best,
  average,
  below,
}: {
  best: CurveBand;
  average: CurveBand;
  below: CurveBand;
}) {
  const aria =
    `Cohort bell curve. Below par ${below.count} students (${below.pct}%), ` +
    `Average ${average.count} students (${average.pct}%), ` +
    `Best profiles ${best.count} students (${best.pct}%).`;

  const bands: { band: CurveBand; x: number; w: number; tint: typeof BAND_TINTS.best }[] = [
    { band: below, x: X0, w: X1 - X0, tint: BAND_TINTS.below },
    { band: average, x: X1, w: X2 - X1, tint: BAND_TINTS.average },
    { band: best, x: X2, w: X3 - X2, tint: BAND_TINTS.best },
  ];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={aria}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {bands.map(({ band, x, w, tint }) => (
            <clipPath key={band.key} id={`clip-${band.key}`}>
              <rect x={x} y={TOP_Y - 8} width={w} height={BASE_Y - TOP_Y + 8} />
            </clipPath>
          ))}
        </defs>

        {/* Shaded vertical bands clipped to the curve area */}
        {bands.map(({ band, tint }) => (
          <path
            key={`area-${band.key}`}
            d={AREA}
            fill={tint.fill}
            clipPath={`url(#clip-${band.key})`}
          />
        ))}

        {/* Band divider lines */}
        {[X1, X2].map((x) => (
          <line
            key={`div-${x}`}
            x1={x}
            x2={x}
            y1={TOP_Y - 4}
            y2={BASE_Y}
            stroke="#cbd5e1"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}

        {/* The curve outline */}
        <path d={CURVE} fill="none" stroke="#312e81" strokeWidth="2.2" strokeLinejoin="round" />

        {/* Baseline */}
        <line x1={PAD_X} x2={W - PAD_X} y1={BASE_Y} y2={BASE_Y} stroke="#94a3b8" strokeWidth="1.4" />

        {/* Band labels under the curve */}
        {bands.map(({ band, x, w, tint }) => {
          const cx = x + w / 2;
          return (
            <g key={`lbl-${band.key}`}>
              <text
                x={cx}
                y={BASE_Y + 22}
                textAnchor="middle"
                className="fill-ink-700"
                fontSize="13"
                fontWeight="600"
              >
                {band.label}
              </text>
              <text
                x={cx}
                y={BASE_Y + 40}
                textAnchor="middle"
                fill={tint.stroke}
                fontSize="13"
                fontWeight="700"
              >
                {band.count} · {band.pct}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
