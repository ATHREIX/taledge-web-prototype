export function Logo({
  className = "",
  inverted = false,
}: {
  className?: string;
  /** Use on dark backgrounds - renders the wordmark in white. */
  inverted?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="tg1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4d7eff" />
            <stop offset="100%" stopColor="#1b3fbf" />
          </linearGradient>
          <linearGradient id="tg2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffb14d" />
            <stop offset="100%" stopColor="#f57f00" />
          </linearGradient>
          <linearGradient id="tg3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#84efc1" />
            <stop offset="100%" stopColor="#21a17c" />
          </linearGradient>
        </defs>
        <path d="M8 30 L14 12 L20 30 Z" fill="url(#tg1)" />
        <path d="M16 30 L22 8 L28 30 Z" fill="url(#tg2)" opacity="0.95" />
        <path d="M22 30 L28 16 L34 30 Z" fill="url(#tg3)" opacity="0.9" />
      </svg>
      <span className={`text-xl font-semibold tracking-tight ${inverted ? "text-white" : "text-ink-900"}`}>
        tal<span className="text-[#f57f00]">edge</span>
      </span>
    </div>
  );
}
