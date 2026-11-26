/**
 * Scenes drawn in a circle behind Alki (the "Scene" slot in Alki's closet).
 * They use Alki's 120×140 viewBox: the circle is centered at (60, 76) with radius 57.
 * `pre` makes gradient ids unique when several Alkis are on screen.
 */

const CX = 60;
const CY = 76;
const R = 57;

export const SCENES = ["classic", "grove", "beach", "rain", "fiesta", "city", "night", "pasko"] as const;

/** A small four-point sparkle. */
const sparkle = (x: number, y: number, s: number) => `M${x} ${y - s}l${s * 0.28} ${s * 0.72} ${s * 0.72} ${s * 0.28}-${s * 0.72} ${s * 0.28}-${s * 0.28} ${s * 0.72}-${s * 0.28}-${s * 0.72}-${s * 0.72}-${s * 0.28} ${s * 0.72}-${s * 0.28}z`;

/** Points along a quadratic curve, for hanging flags or lights on a string. */
function along(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const u = 1 - t;
    return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1] as const;
  });
}

function Art({ id, g }: { id: string; g: (n: string) => string }) {
  const url = (n: string) => `url(#${g(n)})`;
  switch (id) {
    case "classic":
      // The app icon's glowing green circle.
      return (
        <>
          <defs>
            <radialGradient id={g("bg")} cx="50%" cy="42%" r="62%">
              <stop offset="0" stopColor="#7beb8c" />
              <stop offset=".55" stopColor="#34b55a" />
              <stop offset="1" stopColor="#178a3c" />
            </radialGradient>
          </defs>
          <rect x="0" y="16" width="120" height="120" fill={url("bg")} />
          <path d={sparkle(20, 50, 6)} fill="#fff" opacity=".8" />
          <path d={sparkle(102, 98, 5)} fill="#fff" opacity=".7" />
          <path d={sparkle(16, 98, 3.5)} fill="#fff" opacity=".6" />
        </>
      );
    case "grove":
      return (
        <>
          <defs>
            <linearGradient id={g("bg")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ecfccb" />
              <stop offset=".6" stopColor="#a7f3a0" />
              <stop offset="1" stopColor="#5fcf6f" />
            </linearGradient>
          </defs>
          <rect x="0" y="16" width="120" height="120" fill={url("bg")} />
          {/* far stalks */}
          {[14, 34, 86, 104].map((x) => (
            <g key={x} opacity=".45">
              <rect x={x} y="10" width="7" height="130" rx="3" fill="#65a30d" />
              <path d={`M${x} 44h7M${x} 78h7M${x} 112h7`} stroke="#3f6212" strokeWidth="1.5" />
            </g>
          ))}
          {/* near stalks with leaves */}
          {[4, 103].map((x) => (
            <g key={x}>
              <rect x={x} y="10" width="11" height="130" rx="5" fill="#4d8a1f" />
              <rect x={x + 2} y="10" width="3" height="130" fill="#a3e635" opacity=".45" />
              <path d={`M${x} 56h11M${x} 96h11`} stroke="#2f5d12" strokeWidth="2" />
            </g>
          ))}
          <path d="M15 56c8-6 16-6 22-3-7 5-15 6-22 3zM15 96c7-7 15-8 21-5-6 6-14 7-21 5z" fill="#3f8f2a" />
          <path d="M103 50c-8-6-16-6-22-3 7 5 15 6 22 3zM103 92c-7-6-15-7-21-4 6 5 14 6 21 4z" fill="#3f8f2a" />
          <ellipse cx="60" cy="134" rx="62" ry="12" fill="#3f7d1e" opacity=".55" />
        </>
      );
    case "beach":
      return (
        <>
          <defs>
            <linearGradient id={g("bg")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fb923c" />
              <stop offset=".45" stopColor="#fbb6ce" />
              <stop offset=".62" stopColor="#fde4ec" />
            </linearGradient>
          </defs>
          <rect x="0" y="16" width="120" height="120" fill={url("bg")} />
          <circle cx="26" cy="86" r="15" fill="#fde68a" />
          <circle cx="26" cy="86" r="20" fill="#fde68a" opacity=".35" />
          <path d="M80 40c3-1 6 1 8 0M90 34c2-1 4 0 6-1" stroke="#7c2d12" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity=".6" />
          <rect x="0" y="94" width="120" height="22" fill="#38bdf8" />
          <path d="M6 100h18M40 104h22M78 99h16M92 108h20M12 110h14" stroke="#e0f7ff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
          <path d="M0 114c20-4 40 2 60-1s40-4 60 0v24H0z" fill="#fcd9a0" />
          <path d="M98 128l3-3 3 3M14 124l2-2 2 2" stroke="#c2853b" strokeWidth="1.3" fill="none" />
        </>
      );
    case "rain":
      return (
        <>
          <defs>
            <linearGradient id={g("bg")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8796ad" />
              <stop offset="1" stopColor="#d3dbe6" />
            </linearGradient>
          </defs>
          <rect x="0" y="16" width="120" height="120" fill={url("bg")} />
          <g fill="#eef2f7">
            <circle cx="22" cy="40" r="11" />
            <circle cx="36" cy="34" r="13" />
            <circle cx="50" cy="42" r="9" />
            <rect x="14" y="40" width="40" height="10" rx="5" />
          </g>
          <g fill="#c4cedb">
            <circle cx="88" cy="34" r="10" />
            <circle cx="101" cy="40" r="9" />
            <rect x="80" y="36" width="30" height="10" rx="5" />
          </g>
          <g stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" opacity=".75">
            {[
              [12, 62],
              [22, 80],
              [8, 98],
              [18, 112],
              [100, 60],
              [110, 78],
              [98, 94],
              [108, 110],
              [30, 58],
              [92, 56],
            ].map(([x, y]) => (
              <path key={`${x}-${y}`} d={`M${x} ${y}l-2 6`} />
            ))}
          </g>
          <ellipse cx="60" cy="130" rx="46" ry="6" fill="#93c5fd" opacity=".6" />
        </>
      );
    case "fiesta": {
      const colors = ["#ef4444", "#facc15", "#3b82f6", "#22c55e", "#ec4899", "#f97316"];
      const flags = along(2, 30, 60, 52, 118, 30, 9);
      const flags2 = along(2, 52, 60, 70, 118, 52, 8);
      return (
        <>
          <defs>
            <linearGradient id={g("bg")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="1" stopColor="#e0f7ff" />
            </linearGradient>
          </defs>
          <rect x="0" y="16" width="120" height="120" fill={url("bg")} />
          <path d="M2 30Q60 52 118 30M2 52Q60 70 118 52" stroke="#78716c" strokeWidth="1" fill="none" />
          {[...flags, ...flags2].map(([x, y], i) => (
            <path key={i} d={`M${x - 5} ${y - 1}h10l-5 9z`} fill={colors[i % colors.length]} />
          ))}
          {[
            [14, 84, "#ef4444"],
            [104, 80, "#3b82f6"],
            [20, 108, "#facc15"],
            [98, 104, "#22c55e"],
            [8, 96, "#ec4899"],
          ].map(([x, y, c]) => (
            <rect key={`${x}`} x={x as number} y={y as number} width="4" height="2.4" rx="1" fill={c as string} transform={`rotate(25 ${x} ${y})`} />
          ))}
          <ellipse cx="60" cy="136" rx="64" ry="14" fill="#86c95a" />
        </>
      );
    }
    case "city": {
      const buildings = [
        [0, 92, 14],
        [13, 80, 12],
        [24, 100, 10],
        [86, 84, 12],
        [97, 72, 10],
        [106, 94, 14],
      ];
      return (
        <>
          <defs>
            <linearGradient id={g("bg")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#312e81" />
              <stop offset=".55" stopColor="#7c3aed" />
              <stop offset="1" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <rect x="0" y="16" width="120" height="120" fill={url("bg")} />
          <circle cx="92" cy="40" r="7" fill="#fde68a" opacity=".9" />
          <path d={sparkle(24, 36, 3)} fill="#fff" opacity=".8" />
          <path d={sparkle(46, 26, 2.4)} fill="#fff" opacity=".7" />
          {buildings.map(([x, y, w]) => (
            <g key={x}>
              <rect x={x} y={y} width={w} height={140 - y} fill="#1e1b4b" />
              {Array.from({ length: Math.floor((132 - y) / 8) }, (_, r) =>
                Array.from({ length: Math.floor(w / 5) }, (_, c) =>
                  (r * 3 + c * 7 + x) % 4 !== 0 ? <rect key={`${r}-${c}`} x={x + 1.6 + c * 5} y={y + 4 + r * 8} width="2.2" height="3" fill="#fde047" opacity=".85" /> : null,
                ),
              )}
            </g>
          ))}
          <rect x="0" y="126" width="120" height="14" fill="#1e1b4b" />
        </>
      );
    }
    case "night":
      return (
        <>
          <defs>
            <linearGradient id={g("bg")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b1d4a" />
              <stop offset="1" stopColor="#24408f" />
            </linearGradient>
          </defs>
          <rect x="0" y="16" width="120" height="120" fill={url("bg")} />
          <path d="M98 30a12 12 0 1 0 9 21 10 10 0 1 1-9-21z" fill="#fef3c7" />
          <path d={sparkle(20, 44, 5)} fill="#fff" />
          <path d={sparkle(104, 76, 4)} fill="#fff" opacity=".9" />
          <path d={sparkle(12, 84, 3)} fill="#fff" opacity=".8" />
          {[
            [32, 28],
            [84, 26],
            [16, 64],
            [108, 100],
            [22, 106],
            [96, 58],
            [40, 22],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="#fff" opacity=".85" />
          ))}
          <path d="M0 120c20-10 40-6 60-2s40 2 60-6v30H0z" fill="#172554" />
        </>
      );
    case "pasko": {
      const lights = along(2, 112, 60, 124, 118, 112, 10);
      const parol = (x: number, y: number, s: number, c: string, c2: string) => (
        <g>
          <path d={`M${x} ${y - s}l${s * 0.3} ${s * 0.6} ${s * 0.65} ${s * 0.1}-${s * 0.48} ${s * 0.45} ${s * 0.12} ${s * 0.66}-${s * 0.59}-${s * 0.31}-${s * 0.59} ${s * 0.31} ${s * 0.12}-${s * 0.66}-${s * 0.48}-${s * 0.45} ${s * 0.65}-${s * 0.1}z`} fill={c} stroke={c2} strokeWidth="1" strokeLinejoin="round" />
          <circle cx={x} cy={y + s * 0.15} r={s * 0.24} fill="#fff7cc" />
          <path d={`M${x - s * 0.3} ${y + s * 0.85}l-${s * 0.15} ${s * 0.9}M${x} ${y + s * 0.85}v${s}M${x + s * 0.3} ${y + s * 0.85}l${s * 0.15} ${s * 0.9}`} stroke={c} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
      return (
        <>
          <defs>
            <linearGradient id={g("bg")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0c1445" />
              <stop offset="1" stopColor="#1e3a8a" />
            </linearGradient>
          </defs>
          <rect x="0" y="16" width="120" height="120" fill={url("bg")} />
          <circle cx="22" cy="46" r="16" fill="#facc15" opacity=".18" />
          {parol(22, 46, 12, "#facc15", "#b45309")}
          {parol(101, 40, 8, "#ef4444", "#7f1d1d")}
          {[
            [40, 26],
            [80, 30],
            [12, 80],
            [108, 74],
            [30, 96],
            [96, 96],
            [50, 20],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#fff" opacity=".85" />
          ))}
          <path d="M2 112Q60 124 118 112" stroke="#334155" strokeWidth="1" fill="none" />
          {lights.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y + 2.5} r="2.2" fill={["#ef4444", "#22c55e", "#facc15", "#3b82f6"][i % 4]} />
          ))}
        </>
      );
    }
    default:
      return null;
  }
}

/** The scene, clipped to a circle with a soft rim. */
export default function AlkiScene({ id, pre }: { id: string; pre: string }) {
  const g = (n: string) => `${pre}${id}${n}`;
  if (!(SCENES as readonly string[]).includes(id)) return null;
  return (
    <g aria-hidden="true">
      <defs>
        <clipPath id={g("clip")}>
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
        <radialGradient id={g("vig")} cx="50%" cy="45%" r="55%">
          <stop offset=".7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${g("clip")})`}>
        <Art id={id} g={g} />
        {/* gentle darkening at the edge so Alki stands out in front */}
        <circle cx={CX} cy={CY} r={R} fill={`url(#${g("vig")})`} />
      </g>
      <circle cx={CX} cy={CY} r={R - 1} fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" />
    </g>
  );
}
