import { useId } from "react";

/**
 * The streak fire: three layered flames (red edge, orange body, yellow core) with soft gradients,
 * each flickering on its own rhythm, plus a warm glow and a few rising sparks.
 * `lit={false}` shows it gray and still (streak not yet logged today).
 */
export default function Fire({ size = 24, lit = true, sparks = false, className = "" }: { size?: number; lit?: boolean; sparks?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  const g = (n: string) => `${id}${n}`;
  return (
    <svg className={`fire${lit ? "" : " out"} ${className}`} width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden="true">
      <defs>
        <radialGradient id={g("glow")} cx="50%" cy="72%" r="50%">
          <stop offset="0" stopColor="#ffb02e" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff6a00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g("outer")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#e2261c" />
          <stop offset="0.55" stopColor="#ff4d1a" />
          <stop offset="1" stopColor="#ff7a1a" />
        </linearGradient>
        <linearGradient id={g("mid")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff7a00" />
          <stop offset="1" stopColor="#ffb21a" />
        </linearGradient>
        <radialGradient id={g("core")} cx="50%" cy="80%" r="65%">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.45" stopColor="#ffe766" />
          <stop offset="1" stopColor="#ffc21a" />
        </radialGradient>
      </defs>
      {lit && <ellipse className="fire-glow" cx="20" cy="32" rx="19" ry="14" fill={`url(#${g("glow")})`} />}
      <g className="fire-outer">
        <path
          d="M20 2c1.5 5.5 6 8.5 9.5 13.5 1.6-2 2-4.4 1.8-6.6C35.6 13.6 38 19.6 38 26c0 10-8 18-18 18S2 36 2 26c0-6.4 3.4-11 6.6-14.4.2 3 1.2 5 2.9 6.4C11.6 11.3 15.4 6.6 20 2z"
          fill={`url(#${g("outer")})`}
        />
      </g>
      <g className="fire-mid">
        <path
          d="M20.5 13c1.3 4 4.6 6.2 6.7 9.6 1.1-1.2 1.5-2.6 1.5-4 2.6 2.6 3.9 5.9 3.9 9.4 0 7.2-5.5 12-12.6 12S7.4 35.2 7.4 28c0-4.3 2.2-7.4 4.4-9.6.3 2 .9 3.4 2.1 4.4.6-4.3 3.3-7.3 6.6-9.8z"
          fill={`url(#${g("mid")})`}
        />
      </g>
      <g className="fire-core">
        <path d="M20 24c1.5 2.7 5.5 4.6 5.5 9.2 0 3.6-2.5 6.3-5.5 6.3s-5.5-2.7-5.5-6.3c0-2.6 1.3-4.3 2.6-5.6.2 1.2.7 2 1.4 2.5.2-2.4.6-4.3 1.5-6.1z" fill={`url(#${g("core")})`} />
      </g>
      {lit && sparks && (
        <g className="fire-sparks" fill="#ffc94a">
          <circle cx="12" cy="14" r="1.2" />
          <circle cx="28" cy="10" r="1" />
          <circle cx="22" cy="6" r="0.9" />
        </g>
      )}
    </svg>
  );
}
