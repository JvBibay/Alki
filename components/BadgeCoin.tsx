import { useId } from "react";
import type { BadgeTier } from "@/lib/badges";
import Emoji from "./Emoji";

/** Light → mid → dark → edge colors for each metal. */
const METAL: Record<BadgeTier, [string, string, string, string]> = {
  gold: ["#fff4b8", "#f3c431", "#b07a0c", "#6f4704"],
  silver: ["#ffffff", "#cdd5dd", "#808a97", "#434b57"],
  bronze: ["#ffddb8", "#d28d4c", "#8d4d20", "#4f2810"],
};

const REEDS = Array.from({ length: 72 }, (_, i) => {
  const a = (i / 72) * Math.PI * 2;
  return { x1: 50 + Math.cos(a) * 44.2, y1: 50 + Math.sin(a) * 44.2, x2: 50 + Math.cos(a) * 48, y2: 50 + Math.sin(a) * 48 };
});

/** A minted coin: metal face, reeded edge, raised inner ring, a stamped icon and a soft highlight. */
export default function BadgeCoin({ icon, tier, size = 56 }: { icon: string; tier: BadgeTier; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const [hi, mid, lo, edge] = METAL[tier];
  const face = `bc-face-${uid}`;
  const rim = `bc-rim-${uid}`;
  const sheen = `bc-sheen-${uid}`;
  return (
    <span className="badgecoin" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id={rim} x1="15%" y1="8%" x2="85%" y2="92%">
            <stop offset="0" stopColor={hi} />
            <stop offset="0.45" stopColor={mid} />
            <stop offset="1" stopColor={lo} />
          </linearGradient>
          <radialGradient id={face} cx="38%" cy="32%" r="80%">
            <stop offset="0" stopColor={hi} />
            <stop offset="0.5" stopColor={mid} />
            <stop offset="1" stopColor={lo} />
          </radialGradient>
          <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* edge, then the rim face with its reeding */}
        <circle cx="50" cy="50" r="49.5" fill={edge} />
        <circle cx="50" cy="50" r="48" fill={`url(#${rim})`} />
        {REEDS.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={edge} strokeOpacity="0.38" strokeWidth="0.9" />
        ))}
        {/* raised inner ring: dark line below-right, light line above-left */}
        <circle cx="50" cy="50" r="42" fill={`url(#${face})`} stroke={edge} strokeOpacity="0.55" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="40.4" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="36" fill="none" stroke={edge} strokeOpacity="0.25" strokeWidth="0.8" strokeDasharray="0.6 2.2" />
        {/* soft highlight across the upper left */}
        <path d="M17 38 A36 36 0 0 1 62 15 A44 44 0 0 0 17 38 Z" fill={`url(#${sheen})`} />
      </svg>
      <span className="badgecoin-ico" style={{ fontSize: size * 0.42, color: edge }}>
        <Emoji e={icon} />
      </span>
    </span>
  );
}
