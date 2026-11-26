"use client";

import { createContext, useContext, useId, type ReactNode } from "react";

/**
 * Alki's scene stretched across a whole header band, as a landscape.
 * Built from layers that work at any width: a CSS sky, strips that repeat sideways
 * (ground, skyline, flags, stars), and a few single features (sun, moon, parol) placed
 * in the open middle, away from the greeting on the left and Alki on the right.
 * A soft shade on the left keeps the white header text readable.
 */

type StripPos = "top" | "bottom" | "fill";

/** Whether the scene moves (Alki's "motion" setting, and the phone's reduced-motion setting, both turn it off). */
const Live = createContext(true);

/**
 * A repeating strip. With `drift`, the pattern slides by exactly one tile (x, y) every `dur` seconds, so
 * it loops with no visible jump: falling rain, drifting clouds, rising fireflies.
 */
function Strip({ uid, name, w, h, pos, children, opacity = 1, drift }: { uid: string; name: string; w: number; h: number; pos: StripPos; children: ReactNode; opacity?: number; drift?: { x: number; y: number; dur: number } }) {
  const id = `${uid}${name}`;
  const live = useContext(Live);
  return (
    <svg className={`bs-strip ${pos} bs-${name}`} width="100%" height={pos === "fill" ? "100%" : h} style={{ opacity }} aria-hidden="true">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={w} height={h}>
          {children}
          {live && drift && <animateTransform attributeName="patternTransform" type="translate" from="0 0" to={`${drift.x} ${drift.y}`} dur={`${drift.dur}s`} repeatCount="indefinite" />}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * A single sky feature. `left`/`top` place it on wide screens; on phones the header is
 * crowded, so `m` moves it into the gap in the top row (between the streak pill and the buttons).
 */
function Feature({
  left,
  top,
  bottom,
  m,
  side,
  w,
  h,
  name,
  children,
}: {
  name?: string;
  left: string;
  top?: string;
  bottom?: string;
  m?: [string, string];
  /** Where it goes on a stage, where Alki stands in the middle: the left or right side. */
  side: "l" | "r";
  w: number;
  h: number;
  children: ReactNode;
}) {
  const style: Record<string, string | undefined> = { "--l": left, "--t": top, bottom };
  if (m) {
    style["--ml"] = m[0];
    style["--mt"] = m[1];
  }
  return (
    <svg className={`bs-feat side-${side}${m ? " moves" : ""}${name ? ` bs-${name}` : ""}`} style={style} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {children}
    </svg>
  );
}

const sparkle = (x: number, y: number, s: number) => `M${x} ${y - s}l${s * 0.28} ${s * 0.72} ${s * 0.72} ${s * 0.28}-${s * 0.72} ${s * 0.28}-${s * 0.28} ${s * 0.72}-${s * 0.28}-${s * 0.72}-${s * 0.72}-${s * 0.28} ${s * 0.72}-${s * 0.28}z`;

const Stars = ({ uid, w = 90, h = 70 }: { uid: string; w?: number; h?: number }) => (
  <Strip uid={uid} name="stars" w={w} h={h} pos="fill">
    <circle cx="8" cy="10" r="1" fill="#fff" opacity=".9" />
    <circle cx="40" cy="24" r=".8" fill="#fff" opacity=".7" />
    <circle cx="70" cy="8" r="1.2" fill="#fff" opacity=".85" />
    <circle cx="24" cy="48" r=".9" fill="#fff" opacity=".6" />
    <circle cx="62" cy="56" r="1" fill="#fff" opacity=".75" />
    <path d={sparkle(52, 36, 3)} fill="#fff" opacity=".8" />
  </Strip>
);

const parol = (x: number, y: number, s: number, c: string, c2: string) => (
  <g>
    <circle cx={x} cy={y} r={s * 1.5} fill={c} opacity=".18" />
    <path
      d={`M${x} ${y - s}l${s * 0.3} ${s * 0.6} ${s * 0.65} ${s * 0.1}-${s * 0.48} ${s * 0.45} ${s * 0.12} ${s * 0.66}-${s * 0.59}-${s * 0.31}-${s * 0.59} ${s * 0.31} ${s * 0.12}-${s * 0.66}-${s * 0.48}-${s * 0.45} ${s * 0.65}-${s * 0.1}z`}
      fill={c}
      stroke={c2}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx={x} cy={y + s * 0.15} r={s * 0.24} fill="#fff7cc" />
    <path d={`M${x - s * 0.3} ${y + s * 0.85}l-${s * 0.15} ${s * 0.9}M${x} ${y + s * 0.85}v${s}M${x + s * 0.3} ${y + s * 0.85}l${s * 0.15} ${s * 0.9}`} stroke={c} strokeWidth="1.6" strokeLinecap="round" />
  </g>
);

const CITY = [
  [0, 30, 22],
  [24, 52, 18],
  [44, 18, 16],
  [62, 44, 26],
  [90, 26, 20],
  [112, 56, 14],
  [128, 36, 22],
];

const SKY: Record<string, string> = {
  classic: "radial-gradient(120% 140% at 75% 110%, #4fd27a 0%, #22a04b 38%, #146c34 75%)",
  grove: "linear-gradient(180deg, #17482a 0%, #23663a 55%, #3d8a45 100%)",
  beach: "linear-gradient(180deg, #33245f 0%, #9a3f78 42%, #e2734c 75%, #f3a85f 100%)",
  rain: "linear-gradient(180deg, #2f3c4f 0%, #4b5a6f 65%, #5d6c80 100%)",
  fiesta: "linear-gradient(180deg, #1e40af 0%, #2f6fe0 65%, #4f8ff0 100%)",
  city: "linear-gradient(180deg, #1a1748 0%, #40197f 50%, #8c2f86 82%, #d4588f 100%)",
  night: "linear-gradient(180deg, #060f2e 0%, #10225a 65%, #1a3580 100%)",
  pasko: "linear-gradient(180deg, #080f38 0%, #142a6e 100%)",
};

function Layers({ id, uid }: { id: string; uid: string }) {
  switch (id) {
    case "classic":
      return (
        <Strip uid={uid} name="spark" w={120} h={80} pos="fill" opacity={0.55} drift={{ x: 0, y: -80, dur: 22 }}>
          <path d={sparkle(20, 20, 5)} fill="#fff" />
          <path d={sparkle(84, 54, 3.5)} fill="#fff" />
          <circle cx="60" cy="14" r="1.2" fill="#fff" />
          <circle cx="104" cy="28" r="1" fill="#fff" />
        </Strip>
      );
    case "grove":
      return (
        <>
          <Strip uid={uid} name="far" w={70} h={170} pos="bottom" opacity={0.5}>
            <rect x="12" y="10" width="8" height="160" rx="3" fill="#5f9e3a" />
            <path d="M12 60h8M12 110h8M12 150h8" stroke="#2f5d1c" strokeWidth="1.6" />
            <rect x="46" y="40" width="7" height="130" rx="3" fill="#5f9e3a" />
            <path d="M46 84h7M46 128h7" stroke="#2f5d1c" strokeWidth="1.6" />
          </Strip>
          <Strip uid={uid} name="near" w={130} h={170} pos="bottom">
            <rect x="6" y="0" width="12" height="170" rx="5" fill="#4d8a1f" />
            <rect x="8" y="0" width="3" height="170" fill="#a3e635" opacity=".4" />
            <path d="M6 54h12M6 108h12" stroke="#2a5410" strokeWidth="2" />
            <path d="M18 54c10-8 20-8 27-4-9 6-19 8-27 4zM18 108c9-8 19-9 26-5-8 7-18 8-26 5z" fill="#3f8f2a" />
            <rect x="82" y="30" width="10" height="140" rx="4" fill="#4d8a1f" />
            <path d="M82 76h10M82 124h10" stroke="#2a5410" strokeWidth="2" />
            <path d="M82 76c-9-7-18-7-25-3 8 5 17 7 25 3z" fill="#3f8f2a" />
          </Strip>
          <Strip uid={uid} name="flies" w={110} h={90} pos="fill" opacity={0.7} drift={{ x: 110, y: -90, dur: 16 }}>
            <circle cx="30" cy="30" r="1.6" fill="#fef08a" />
            <circle cx="86" cy="62" r="1.3" fill="#fef08a" />
            <circle cx="64" cy="18" r="1" fill="#fef08a" />
          </Strip>
        </>
      );
    case "beach":
      return (
        <>
          <Feature name="sun" left="52%" bottom="22px" side="l" w={90} h={60}>
            <circle cx="45" cy="52" r="34" fill="#ffd36b" opacity=".25" />
            <circle cx="45" cy="52" r="24" fill="#ffd36b" />
          </Feature>
          <Feature name="birds" left="38%" top="22%" m={["30%", "14px"]} side="r" w={60} h={24}>
            <path d="M6 14c4-4 8-4 11 0M22 8c3-3 6-3 9 0M42 16c3-3 6-3 9 0" stroke="#3b1d3f" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".7" />
          </Feature>
          <Strip uid={uid} name="sea" w={160} h={44} pos="bottom">
            <rect y="0" width="160" height="22" fill="#2f6db5" />
            <path d="M10 6h26M70 12h30M120 5h24M40 17h20" stroke="#bfe3ff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
            <path d="M0 22c20-5 40 3 80-1s60-4 80 1v22H0z" fill="#e8b77a" />
            <path d="M0 23c20-5 40 3 80-1s60-4 80 1" stroke="#fff" strokeWidth="1.6" fill="none" opacity=".6" />
          </Strip>
        </>
      );
    case "rain":
      return (
        <>
          <Strip uid={uid} name="drops" w={46} h={46} pos="fill" opacity={0.6} drift={{ x: 0, y: 46, dur: 0.8 }}>
            <path d="M10 4l-3 8M32 20l-3 8M18 34l-3 8M42 2l-3 8" stroke="#93c5fd" strokeWidth="1.6" strokeLinecap="round" />
          </Strip>
          <Strip uid={uid} name="clouds" w={170} h={46} pos="top" drift={{ x: 170, y: 0, dur: 70 }}>
            <g fill="#8c99ab">
              <circle cx="24" cy="10" r="16" />
              <circle cx="48" cy="6" r="18" />
              <circle cx="72" cy="12" r="13" />
              <circle cx="120" cy="4" r="15" />
              <circle cx="146" cy="10" r="14" />
            </g>
            <g fill="#a9b4c3">
              <circle cx="40" cy="0" r="14" />
              <circle cx="132" cy="-2" r="12" />
            </g>
          </Strip>
          <Strip uid={uid} name="puddle" w={140} h={16} pos="bottom">
            <rect y="8" width="140" height="8" fill="#2a3544" />
            <ellipse cx="40" cy="9" rx="22" ry="3" fill="#7fb0e6" opacity=".45" />
            <ellipse cx="110" cy="10" rx="14" ry="2.4" fill="#7fb0e6" opacity=".35" />
          </Strip>
        </>
      );
    case "fiesta": {
      const colors = ["#ef4444", "#facc15", "#22c55e", "#ec4899", "#f97316", "#a855f7"];
      const flags = Array.from({ length: 6 }, (_, i) => {
        const t = (i + 0.5) / 6;
        const x = t * 132;
        const y = 4 + 4 * 14 * t * (1 - t);
        return { x, y, c: colors[i] };
      });
      return (
        <>
          <Strip uid={uid} name="confetti" w={96} h={64} pos="fill" opacity={0.65} drift={{ x: 0, y: 64, dur: 7 }}>
            <rect x="10" y="12" width="5" height="3" rx="1" fill="#facc15" transform="rotate(25 10 12)" />
            <rect x="60" y="34" width="5" height="3" rx="1" fill="#f472b6" transform="rotate(-20 60 34)" />
            <rect x="34" y="50" width="5" height="3" rx="1" fill="#4ade80" transform="rotate(40 34 50)" />
            <circle cx="84" cy="14" r="1.6" fill="#fff" />
          </Strip>
          <Strip uid={uid} name="flags" w={132} h={34} pos="top">
            <path d="M0 4Q66 32 132 4" stroke="#e5e7eb" strokeWidth="1" fill="none" opacity=".8" />
            {flags.map((f, i) => (
              <path key={i} d={`M${f.x - 7} ${f.y}h14l-7 13z`} fill={f.c} />
            ))}
          </Strip>
          <Strip uid={uid} name="hills" w={220} h={34} pos="bottom">
            <path d="M0 20c40-14 70-14 110 0s70 14 110 0v14H0z" fill="#3f9142" />
            <path d="M0 26c50-8 80-8 110 0s60 8 110 0v8H0z" fill="#2f7a35" />
          </Strip>
        </>
      );
    }
    case "city":
      return (
        <>
          <Stars uid={uid} w={110} h={60} />
          <Feature name="moon" left="56%" top="16%" m={["44%", "6px"]} side="r" w={40} h={40}>
            <circle cx="20" cy="20" r="16" fill="#fde68a" opacity=".2" />
            <circle cx="20" cy="20" r="10" fill="#fde68a" />
          </Feature>
          <Strip uid={uid} name="sky" w={150} h={92} pos="bottom">
            {CITY.map(([x, y, w]) => (
              <rect key={x} x={x} y={y} width={w} height={92 - y} fill="#16123d" />
            ))}
          </Strip>
          {/* Windows are their own layers so they can blink, in two groups that take turns. */}
          {[0, 1].map((group) => (
            <Strip key={group} uid={uid} name={`win${group}`} w={150} h={92} pos="bottom">
              {CITY.map(([x, y, w]) =>
                Array.from({ length: Math.floor((88 - y) / 9) }, (_, r) =>
                  Array.from({ length: Math.floor(w / 6) }, (_, c) =>
                    (r * 5 + c * 3 + x) % 3 !== 0 && (r + c) % 2 === group ? <rect key={`${x}-${r}-${c}`} x={x + 2 + c * 6} y={y + 5 + r * 9} width="2.6" height="3.4" fill="#fde047" opacity=".8" /> : null,
                  ),
                ),
              )}
            </Strip>
          ))}
        </>
      );
    case "night":
      return (
        <>
          <Stars uid={uid} />
          <Feature name="moon" left="58%" top="14%" m={["44%", "4px"]} side="r" w={44} h={44}>
            <circle cx="22" cy="22" r="20" fill="#fef3c7" opacity=".12" />
            <path d="M22 8a14 14 0 1 0 11 24 11.5 11.5 0 1 1-11-24z" fill="#fef3c7" />
          </Feature>
          <Feature name="shoot" left="20%" top="10%" m={["22%", "6px"]} side="l" w={54} h={30}>
            <path d="M2 2L50 26" stroke="url(#shootfade)" strokeWidth="1.6" strokeLinecap="round" />
            <defs>
              <linearGradient id="shootfade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="1" stopColor="#fff" stopOpacity=".95" />
              </linearGradient>
            </defs>
          </Feature>
          <Strip uid={uid} name="hills" w={240} h={40} pos="bottom">
            <path d="M0 26c40-18 80-18 120-4s80 10 120-6v24H0z" fill="#0d1a45" />
            <path d="M0 32c50-10 90-6 120 0s70 4 120-4v12H0z" fill="#081233" />
          </Strip>
        </>
      );
    case "pasko":
      return (
        <>
          <Stars uid={uid} w={100} h={70} />
          <Feature name="parol1" left="46%" top="16%" m={["30%", "0px"]} side="l" w={60} h={70}>
            {parol(30, 24, 16, "#facc15", "#b45309")}
          </Feature>
          <Feature name="parol2" left="64%" top="30%" m={["50%", "8px"]} side="r" w={40} h={50}>
            {parol(20, 16, 10, "#ef4444", "#7f1d1d")}
          </Feature>
          <Strip uid={uid} name="lights" w={110} h={26} pos="top">
            <path d="M0 4Q55 22 110 4" stroke="#475569" strokeWidth="1" fill="none" />
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((t, i) => (
              <circle key={i} cx={t * 110} cy={4 + 4 * 9 * t * (1 - t) + 3} r="3" fill={["#ef4444", "#22c55e", "#facc15", "#3b82f6", "#ec4899"][i]} />
            ))}
          </Strip>
          <Strip uid={uid} name="hills" w={240} h={30} pos="bottom">
            <path d="M0 18c40-12 80-12 120-2s80 8 120-4v18H0z" fill="#0b1640" />
          </Strip>
        </>
      );
    default:
      return null;
  }
}

export const hasBandScene = (id?: string) => !!id && id in SKY;

/**
 * `band`: behind a header (shaded on the left for the white text, Alki on the right).
 * `stage`: behind a centered Alki, like the closet preview: no shade, features moved to the sides.
 */
export default function BandScene({ id, variant = "band", motion = true }: { id: string; variant?: "band" | "stage"; motion?: boolean }) {
  const uid = `bs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!hasBandScene(id)) return null;
  // Moving is on by default; it stops with Alki's "motion" setting or the phone's reduced-motion setting.
  const live = motion && !(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  return (
    <Live.Provider value={live}>
      <div className={`bandscene bs-${id} ${variant}${live ? " live" : ""}`} aria-hidden="true">
        <div className="bs-sky" style={{ background: SKY[id] }} />
        <Layers id={id} uid={uid} />
        {variant === "band" && <div className="bs-scrim" />}
      </div>
    </Live.Provider>
  );
}
