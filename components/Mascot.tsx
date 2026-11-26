"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { outfitToLook, type Look } from "@/lib/closet";
import AlkiScene from "./AlkiScene";
import { coinScale, coinSymbol } from "@/lib/currency";
import { getBaseCurrency } from "@/lib/format";

/** The main currency's sign on a coin or money bag, shrunk to fit when it's letters ("RM", "AED"). */
function CoinMark({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) {
  const mark = coinSymbol(getBaseCurrency());
  const s = coinScale(mark);
  return (
    <text x={x} y={y - (size * (1 - s)) / 2.6} textAnchor="middle" fontSize={size * s} fontWeight="900" fill={fill} fontFamily="system-ui" letterSpacing={mark.length > 1 ? -0.3 : 0}>
      {mark}
    </text>
  );
}

/**
 * Alki — Kwenta's helper. A little bamboo alkansya (coin bank) with a coin in its slot.
 * Wears accessories in four slots (head, eyes, neck, hand). With `animated`, Alki bobs,
 * blinks, waves, and its leaf and coin move (see the .alki-anim rules in globals.css).
 */
/** Alki's barrel-shaped bamboo body (slightly bulging sides, rounded top and bottom). */
const BODY = "M42 38H78C91 38 97.5 45 98 58C99.4 74 99.4 92 98 106C97.5 119 90 126 78 126H42C30 126 22.5 119 22 106C20.6 92 20.6 74 22 58C22.5 45 29 38 42 38Z";
const OUTLINE = "#94590f";

export default function Mascot({
  size = 72,
  look,
  outfit,
  wink = false,
  face = "normal",
  animated = false,
}: {
  size?: number;
  look?: Look;
  /** Old single-outfit setting; used when `look` is not given. */
  outfit?: string;
  wink?: boolean;
  /** Expression, used when Alki reacts to a tap. */
  face?: Face;
  animated?: boolean;
}) {
  const f: Face = wink ? "wink" : face;
  const l = look ?? outfitToLook(outfit);
  const hideCoin = !!l.head;
  // Gradient ids must be unique per Alki: several can be on screen, and a hidden one
  // would otherwise break the shading of the others.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `alki${uid}${n}`;
  const url = (n: string) => `url(#${id(n)})`;
  return (
    <svg
      className={`alki-svg${animated ? " alki-anim" : ""}`}
      width={size}
      height={(size * 140) / 120}
      viewBox="0 0 120 140"
      role="img"
      aria-label="Alki the coin bank"
      overflow="visible"
    >
      <defs>
        {/* Bamboo body: lit from the upper left, rounding away into shadow on the right. */}
        <linearGradient id={id("body")} x1="21" y1="0" x2="99" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e9a62e" />
          <stop offset=".26" stopColor="#ffd968" />
          <stop offset=".55" stopColor="#fcc94a" />
          <stop offset="1" stopColor="#d68e1e" />
        </linearGradient>
        <linearGradient id={id("bodyShade")} x1="0" y1="38" x2="0" y2="126" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff7cc" stopOpacity=".5" />
          <stop offset=".22" stopColor="#fff7cc" stopOpacity="0" />
          <stop offset=".72" stopColor="#8a4f0c" stopOpacity="0" />
          <stop offset="1" stopColor="#8a4f0c" stopOpacity=".34" />
        </linearGradient>
        <radialGradient id={id("gloss")} cx="40" cy="52" r="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("limb")} x1="0" y1="86" x2="0" y2="134" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0b440" />
          <stop offset="1" stopColor="#c27f1c" />
        </linearGradient>
        <radialGradient id={id("foot")} cx=".4" cy=".3" r=".8">
          <stop offset="0" stopColor="#f5bb4c" />
          <stop offset="1" stopColor="#b8741a" />
        </radialGradient>
        <radialGradient id={id("coin")} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff4b8" />
          <stop offset=".45" stopColor="#fcc42d" />
          <stop offset="1" stopColor="#d98a0b" />
        </radialGradient>
        <linearGradient id={id("leaf")} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#15803d" />
          <stop offset=".6" stopColor="#22b26b" />
          <stop offset="1" stopColor="#6ee7a0" />
        </linearGradient>
        <linearGradient id={id("slot")} x1="0" y1="40" x2="0" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2e1d05" />
          <stop offset="1" stopColor="#7a5214" />
        </linearGradient>
        <radialGradient id={id("eye")} cx=".45" cy=".35" r=".75">
          <stop offset=".6" stopColor="#fff" />
          <stop offset="1" stopColor="#eadfcd" />
        </radialGradient>
        <radialGradient id={id("cheek")}>
          <stop offset="0" stopColor="#f88d9a" stopOpacity=".9" />
          <stop offset="1" stopColor="#f88d9a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("ground")}>
          <stop offset="0" stopColor="#000" stopOpacity=".28" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id("clip")}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* scene behind Alki (closet → Scene); it stays still while Alki bobs */}
      {l.scene && <AlkiScene id={l.scene} pre={id("sc")} />}
      {/* with a scene, Alki stands a little smaller (scaled from the feet) so the scene shows around it */}
      <g transform={l.scene ? "translate(60 131) scale(.78) translate(-60 -131)" : undefined}>
      {/* shadow + feet stay on the ground while the body bobs */}
      <ellipse className="a-shadow" cx="60" cy="133" rx="40" ry="6" fill={url("ground")} />
      <ellipse cx="44" cy="128" rx="11.5" ry="6.5" fill={url("foot")} stroke={OUTLINE} strokeWidth="2.2" />
      <ellipse cx="76" cy="128" rx="11.5" ry="6.5" fill={url("foot")} stroke={OUTLINE} strokeWidth="2.2" />
      <ellipse cx="41" cy="125.6" rx="4.5" ry="1.7" fill="#fff" opacity=".35" />
      <ellipse cx="73" cy="125.6" rx="4.5" ry="1.7" fill="#fff" opacity=".35" />

      <g className="a-body">
        {/* two leaves sprouting at the top right */}
        <g className="a-leaf">
          <path d="M93 66c8-9 19-11 24-8-3 8-13 12-24 8z" fill={url("leaf")} stroke="#12703a" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M95 65c7-2 13-4 20-6" stroke="#bbf7d0" strokeOpacity=".7" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          <path d="M91 52c10-14 22-16 26-14-2 9-12 19-26 18z" fill={url("leaf")} stroke="#12703a" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M93 55c7-6 14-10 22-15" stroke="#bbf7d0" strokeOpacity=".75" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M100 46c5-4 10-6 15-7" stroke="#fff" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>
        {/* coin */}
        {!hideCoin && (
          <g className="a-coin">
            <g className="a-coin-spin">
            <circle cx="60" cy="27.6" r="11.5" fill="#b8650a" />
            <circle cx="60" cy="27" r="11.5" fill={url("coin")} stroke="#b86b06" strokeWidth="2.2" />
            <circle cx="60" cy="27" r="8.3" fill="none" stroke="#f59e0b" strokeOpacity=".6" strokeWidth="1" />
            <CoinMark x={60} y={32} size={13} fill="#a65208" />
            <path d="M52.6 22a8 8 0 0 1 6-4.2" stroke="#fff" strokeOpacity=".85" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            </g>
            <path className="a-coin-glint" d="M68.5 17.5l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="#fff" />
          </g>
        )}
        {l.hand === "balloon" && <Hand id="balloon" />}
        {/* arms: an outline stroke under a shaded one */}
        {f !== "thinking" && (
          <>
            <path d="M25 91c-8 2-12 8-12 14" stroke={OUTLINE} strokeWidth="10" strokeLinecap="round" fill="none" />
            <path d="M25 91c-8 2-12 8-12 14" stroke={url("limb")} strokeWidth="6.6" strokeLinecap="round" fill="none" />
            <path d="M23.5 89.8c-6 2-9 6-9.6 10" stroke="#fff" strokeOpacity=".35" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </>
        )}
        <g className="a-arm">
          <path d="M95 91c8 2 12 8 12 14" stroke={OUTLINE} strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M95 91c8 2 12 8 12 14" stroke={url("limb")} strokeWidth="6.6" strokeLinecap="round" fill="none" />
          <path d="M96.5 89.8c6 2 9 6 9.6 10" stroke="#fff" strokeOpacity=".35" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>
        {/* body */}
        <path d={BODY} fill={url("body")} />
        <g clipPath={url("clip")}>
          <rect x="20" y="38" width="80" height="88" fill={url("bodyShade")} />
          {/* bamboo nodes: a curved groove with a lit lip below it */}
          <path d="M18 59c26 8 58 8 84 0M18 107c26 8 58 8 84 0" stroke="#b5771a" strokeWidth="3" fill="none" />
          <path d="M18 62.4c26 8 58 8 84 0M18 110.4c26 8 58 8 84 0" stroke="#fff3c0" strokeOpacity=".75" strokeWidth="1.6" fill="none" />
          {/* glossy shine and a rim of reflected light on the shadow side */}
          <ellipse cx="37" cy="52" rx="9" ry="12" fill={url("gloss")} transform="rotate(-14 37 52)" />
          <path d="M31 74v28" stroke="#fff" strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" />
          <path d="M94 62v42" stroke="#ffe7a3" strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" />
        </g>
        <path d={BODY} fill="none" stroke={OUTLINE} strokeWidth="3.4" strokeLinejoin="round" />
        {/* coin slot, sunk into the top */}
        <rect x="48.5" y="40.5" width="23" height="5" rx="2.5" fill={url("slot")} />
        <path d="M50.5 46.6h19" stroke="#fff6c8" strokeOpacity=".8" strokeWidth="1.2" strokeLinecap="round" />
        {/* face */}
        <ellipse cx="37" cy="92" rx="8" ry="5" fill={url("cheek")} />
        <ellipse cx="83" cy="92" rx="8" ry="5" fill={url("cheek")} />
        <Face face={f} eye={url("eye")} limb={url("limb")} />

        {l.neck && <Neck id={l.neck} />}
        {l.eyes && <Eyes id={l.eyes} />}
        {l.hand && l.hand !== "balloon" && <Hand id={l.hand} />}
        {l.head && <Head id={l.head} />}
      </g>
      </g>
    </svg>
  );
}

export type Face = "normal" | "wink" | "happy" | "surprised" | "love" | "sad" | "angry" | "worried" | "sleepy" | "excited" | "confused" | "thinking";

/** Eyes and mouth for each expression. */
function Face({ face, eye = "#fff", limb = "#e0a43c" }: { face: Face; eye?: string; limb?: string }) {
  const ink = "#2b2118";
  if (face === "excited") {
    // >‿< eyes squeezed shut with joy, big open grin
    return (
      <g>
        <path d="M38 73.5l11 6.5-11 6.5M82 73.5l-11 6.5 11 6.5" stroke={ink} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M47 92h26c0 10-6 15.5-13 15.5S47 102 47 92z" fill="#9f1239" stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M53 103.5c3-3.5 11-3.5 14 0-3.5 2.6-10.5 2.6-14 0z" fill="#fb7185" />
        <path d="M49.5 93.5h21" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
      </g>
    );
  }
  if (face === "confused") {
    // one brow up, eyes glancing aside, wobbly mouth, and a question mark
    return (
      <g>
        <g className="a-eyes">
          <circle cx="46" cy="81" r="8.5" fill={eye} />
          <circle cx="74" cy="80" r="9" fill={eye} />
          <circle cx="49" cy="80" r="4.4" fill={ink} />
          <circle cx="77" cy="79" r="4.6" fill={ink} />
          <circle cx="50.4" cy="78.4" r="1.6" fill="#fff" />
          <circle cx="78.4" cy="77.4" r="1.7" fill="#fff" />
        </g>
        <path d="M38 71l13 1M67 66c5-4 11-4 15 0" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M52 99c3-2.5 5 2 8 0s5 2 8 0" stroke={ink} strokeWidth="2.8" strokeLinecap="round" fill="none" />
        <text x="104" y="34" fontSize="22" fontWeight="900" fill="#2563eb" fontFamily="system-ui" transform="rotate(12 104 34)">
          ?
        </text>
      </g>
    );
  }
  if (face === "thinking") {
    // eyes looking up and away, one brow raised, a hand on the chin
    return (
      <g>
        <g className="a-eyes">
          <circle cx="46" cy="80" r="8.5" fill={eye} />
          <circle cx="74" cy="80" r="8.5" fill={eye} />
          <circle cx="49" cy="77" r="4.4" fill={ink} />
          <circle cx="77" cy="77" r="4.4" fill={ink} />
          <circle cx="50.2" cy="75.6" r="1.5" fill="#fff" />
          <circle cx="78.2" cy="75.6" r="1.5" fill="#fff" />
        </g>
        <path d="M38 70c4-2 9-2 13 0M67 66c5-3 11-3 15 1" stroke={ink} strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M60 96.5c3-1 6-1 9 0" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* left arm bent up so the hand rests under the chin */}
        <path d="M24 98c2 9 14 13 28 11" stroke="#94590f" strokeWidth="10" strokeLinecap="round" fill="none" />
        <path d="M24 98c2 9 14 13 28 11" stroke={limb} strokeWidth="6.6" strokeLinecap="round" fill="none" />
        <ellipse cx="57" cy="107" rx="7" ry="5.6" fill={limb} stroke="#94590f" strokeWidth="2" />
        <path d="M53 104.6a4 4 0 0 1 4-1.6" stroke="#fff" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <text x="100" y="32" fontSize="18" fontWeight="900" fill="#2563eb" fontFamily="system-ui">
          ?
        </text>
      </g>
    );
  }
  if (face === "happy") {
    return (
      <g>
        <path d="M38 82c3-6 13-6 16 0M66 82c3-6 13-6 16 0" stroke={ink} strokeWidth="3.4" strokeLinecap="round" fill="none" />
        <path d="M50 94c4 9 16 9 20 0z" fill="#9f1239" stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
      </g>
    );
  }
  if (face === "sleepy") {
    return (
      <g>
        <path d="M38 81h15M66 81h15" stroke={ink} strokeWidth="3.2" strokeLinecap="round" />
        <ellipse cx="60" cy="98" rx="3.5" ry="3" fill="#9f1239" stroke={ink} strokeWidth="2" />
        {/* zZ floats up on the left, clear of the leaves */}
        <text x="14" y="56" fontSize="11" fontWeight="900" fill="#6b7280" fontFamily="system-ui">
          z
        </text>
        <text x="4" y="44" fontSize="15" fontWeight="900" fill="#6b7280" fontFamily="system-ui">
          Z
        </text>
      </g>
    );
  }
  if (face === "sad" || face === "worried" || face === "angry") {
    const brows =
      face === "angry"
        ? "M37 67l14 6M83 67l-14 6" // angled down toward the middle
        : face === "sad"
          ? "M38 72l13-5M82 72l-13-5" // inner ends up
          : "M37 69c5-4 10-4 14 0M69 69c4-4 9-4 14 0"; // raised, curved
    return (
      <g>
        <g className="a-eyes">
          <circle cx="46" cy="81" r="8.5" fill={eye} />
          <circle cx="74" cy="81" r="8.5" fill={eye} />
          <circle cx="47" cy={face === "sad" ? 84 : 82} r={face === "angry" ? 4.2 : 4.6} fill={ink} />
          <circle cx="75" cy={face === "sad" ? 84 : 82} r={face === "angry" ? 4.2 : 4.6} fill={ink} />
          <circle cx="48.6" cy={face === "sad" ? 82.4 : 80.4} r="1.6" fill="#fff" />
          <circle cx="76.6" cy={face === "sad" ? 82.4 : 80.4} r="1.6" fill="#fff" />
        </g>
        <path d={brows} stroke={ink} strokeWidth="3.4" strokeLinecap="round" fill="none" />
        {face === "worried" ? (
          <path d="M51 99c3-3 6 3 9 0s6 3 9 0" stroke={ink} strokeWidth="2.8" strokeLinecap="round" fill="none" />
        ) : (
          <path d={face === "angry" ? "M52 100c4-3 12-3 16 0" : "M52 101c4-5 12-5 16 0"} stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
        )}
        {face === "sad" && <path d="M40 90c-2 4-3 6 0 8s4-2 0-8z" fill="#60a5fa" />}
        {face === "worried" && <path d="M90 62c-3 5-4 7-1 9s5-3 1-9z" fill="#93c5fd" />}
        {face === "angry" && (
          <>
            <ellipse cx="38" cy="93" rx="7" ry="4" fill="#ef4444" opacity=".55" />
            <ellipse cx="82" cy="93" rx="7" ry="4" fill="#ef4444" opacity=".55" />
          </>
        )}
      </g>
    );
  }
  if (face === "love") {
    return (
      <g fill="#e11d48">
        <path d="M46 90c-9-6-11-11-8-15 2-2 6-2 8 1 2-3 6-3 8-1 3 4 1 9-8 15z" />
        <path d="M74 90c-9-6-11-11-8-15 2-2 6-2 8 1 2-3 6-3 8-1 3 4 1 9-8 15z" />
        <path d="M52 96c4 5 12 5 16 0" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    );
  }
  const surprised = face === "surprised";
  return (
    <g>
      <g className="a-eyes">
        <circle cx="46" cy="80" r={surprised ? 10 : 9} fill={eye} />
        <circle cx="74" cy="80" r={surprised ? 10 : 9} fill={eye} />
        <circle cx="47" cy="81" r={surprised ? 3.6 : 5} fill={ink} />
        {face === "wink" ? (
          <path d="M66 81c3-3 10-3 13 0" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
        ) : (
          <circle cx="75" cy="81" r={surprised ? 3.6 : 5} fill={ink} />
        )}
        <circle cx="49" cy="78.6" r="2" fill="#fff" />
        <circle cx="45.2" cy="83" r="0.9" fill="#fff" opacity=".8" />
        {face !== "wink" && (
          <>
            <circle cx="77" cy="78.6" r="2" fill="#fff" />
            <circle cx="73.2" cy="83" r="0.9" fill="#fff" opacity=".8" />
          </>
        )}
      </g>
      {surprised ? (
        <ellipse cx="60" cy="98" rx="4.5" ry="5.5" fill="#9f1239" stroke={ink} strokeWidth="2.4" />
      ) : (
        <path d="M52 96c4 5 12 5 16 0" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
      )}
    </g>
  );
}

function Head({ id }: { id: string }) {
  switch (id) {
    case "salakot":
      return (
        <g>
          <path d="M10 46C30 34 42 14 60 10c18 4 30 24 50 36-30 8-70 8-100 0z" fill="#c08a3e" stroke="#8a5a1c" strokeWidth="2.5" />
          <path d="M30 40c10-6 20-20 30-26m30 26c-10-6-20-20-30-26" stroke="#8a5a1c" strokeWidth="1.5" fill="none" />
          <circle cx="60" cy="10" r="4" fill="#8a5a1c" />
        </g>
      );
    case "party":
      return (
        <g>
          <path d="M44 42 62 4l16 38z" fill="#6366f1" />
          <path d="M50 30l20-4M47 37l26-5M55 18l12-2" stroke="#fbbf24" strokeWidth="3" />
          <circle cx="62" cy="5" r="5" fill="#f472b6" />
        </g>
      );
    case "crown":
      return <path d="M36 44 38 18l12 12 10-18 10 18 12-12 2 26z" fill="#facc15" stroke="#ca8a04" strokeWidth="2.5" strokeLinejoin="round" />;
    case "santa":
      return (
        <g>
          <path d="M28 44C30 20 52 8 74 12c10 2 18 10 22 22l4 12z" fill="#dc2626" />
          <path d="M74 12c12 0 22 8 24 22" stroke="#b91c1c" strokeWidth="2" fill="none" />
          <circle cx="101" cy="40" r="7" fill="#fff" />
          <rect x="22" y="38" width="76" height="12" rx="6" fill="#fff" />
        </g>
      );
    case "beanie":
      return (
        <g>
          <path d="M28 46C28 18 92 18 92 46z" fill="#2563eb" />
          <path d="M40 24v18M52 20v22M64 20v22M76 24v18" stroke="#1d4ed8" strokeWidth="2" />
          <rect x="25" y="38" width="70" height="11" rx="5" fill="#1e40af" />
          <circle cx="60" cy="16" r="6" fill="#fbbf24" />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M22 74C20 30 100 30 98 74" stroke="#1f2937" strokeWidth="6" fill="none" strokeLinecap="round" />
          <rect x="12" y="64" width="16" height="24" rx="7" fill="#ef4444" stroke="#1f2937" strokeWidth="2" />
          <rect x="92" y="64" width="16" height="24" rx="7" fill="#ef4444" stroke="#1f2937" strokeWidth="2" />
        </g>
      );
    case "gradcap":
      return (
        <g>
          <path d="M40 30h40v14H40z" fill="#111827" />
          <path d="M20 28 60 14l40 14-40 14z" fill="#1f2937" stroke="#111827" strokeWidth="1.5" />
          <path d="M60 28l26 6v14" stroke="#facc15" strokeWidth="2.5" fill="none" />
          <circle cx="86" cy="50" r="3.5" fill="#facc15" />
        </g>
      );
    case "witch":
      return (
        <g>
          <ellipse cx="60" cy="45" rx="42" ry="7.5" fill="#3b1a6e" stroke="#1e0b3d" strokeWidth="2" />
          <path d="M38 44 56 12c3-6 10-9 17-6 6 2 9 8 12 7-6 3-9-2-12-1-4 1-5 4-4 8l12 24z" fill="#6d28d9" stroke="#1e0b3d" strokeWidth="2" strokeLinejoin="round" />
          <path d="M57 14c2-3 6-6 10-6" stroke="#a78bfa" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M39.5 36c13 3 28 3 41 0l1.6 7.4c-14 3-30 3-44 0z" fill="#2e1065" />
          <rect x="55" y="35.5" width="10" height="8.5" rx="1.5" fill="none" stroke="#facc15" strokeWidth="2.2" />
        </g>
      );
    case "sampaguita":
      return (
        <g>
          <path d="M26 44c20-8 48-8 68 0" stroke="#15803d" strokeWidth="3" fill="none" />
          {[30, 41, 52, 63, 74, 85].map((x, i) => (
            <g key={x}>
              <ellipse cx={x - 4} cy={42 - (i === 0 || i === 5 ? 0 : 2)} rx="4" ry="2.2" fill="#22c55e" transform={`rotate(-30 ${x - 4} 42)`} />
              <circle cx={x} cy={39 - (i === 0 || i === 5 ? 0 : 2)} r="5" fill="#fff" stroke="#e5e7eb" />
              <circle cx={x} cy={39 - (i === 0 || i === 5 ? 0 : 2)} r="1.6" fill="#fde68a" />
            </g>
          ))}
        </g>
      );
    default:
      return null;
  }
}

function Eyes({ id }: { id: string }) {
  switch (id) {
    case "shades":
      return (
        <g fill="#111827">
          <rect x="33" y="72" width="25" height="15" rx="6" />
          <rect x="62" y="72" width="25" height="15" rx="6" />
          <rect x="56" y="76" width="8" height="3" />
          <path d="M37 76h8" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "round":
      return (
        <g stroke="#3f2a14" strokeWidth="2.6" fill="rgba(255,255,255,.18)">
          <circle cx="46" cy="80" r="11.5" />
          <circle cx="74" cy="80" r="11.5" />
          <path d="M57.5 79c1.5-2 3.5-2 5 0" fill="none" />
          <path d="M34.5 78 26 75M85.5 78 94 75" fill="none" />
        </g>
      );
    case "hearts":
      return (
        <g stroke="#9d174d" strokeWidth="2" fill="rgba(244,114,182,.55)">
          <path d="M46 92c-12-7-15-14-11-19 3-3 8-2 11 2 3-4 8-5 11-2 4 5 1 12-11 19z" />
          <path d="M74 92c-12-7-15-14-11-19 3-3 8-2 11 2 3-4 8-5 11-2 4 5 1 12-11 19z" />
          <path d="M57 80h6" fill="none" />
        </g>
      );
    case "stars":
      return (
        <g stroke="#a16207" strokeWidth="2" fill="rgba(250,204,21,.55)" strokeLinejoin="round">
          <path d="M46 67l3.6 7.4 8.2 1.2-5.9 5.8 1.4 8.1L46 85.7l-7.3 3.8 1.4-8.1-5.9-5.8 8.2-1.2z" />
          <path d="M74 67l3.6 7.4 8.2 1.2-5.9 5.8 1.4 8.1L74 85.7l-7.3 3.8 1.4-8.1-5.9-5.8 8.2-1.2z" />
          <path d="M57.5 80h5" fill="none" />
        </g>
      );
    case "monocle":
      return (
        <g>
          <circle cx="74" cy="80" r="12" stroke="#ca8a04" strokeWidth="3" fill="rgba(255,255,255,.2)" />
          <path d="M84 87c4 8 2 18-4 24" stroke="#ca8a04" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
        </g>
      );
    default:
      return null;
  }
}

function Neck({ id }: { id: string }) {
  switch (id) {
    case "scarf":
      return (
        <g>
          <path d="M25 100c22 7 48 7 70 0v10c-22 7-48 7-70 0z" fill="#e11d48" />
          <path d="M78 106l6 22-10-2-3-18z" fill="#be123c" />
        </g>
      );
    case "xmas":
      return (
        <g>
          <path d="M23 100c24 7.5 50 7.5 74 0v11c-24 7.5-50 7.5-74 0z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M36 103.5v11M48 105.3v11M60 105.8v11M72 105.3v11M84 103.5v11" stroke="#fff" strokeWidth="3" strokeOpacity=".9" />
          <path d="M76 107l7 24h-11l-3-20z" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M71.6 126.5h11" stroke="#fff" strokeWidth="3" />
          <text x="76.5" y="122" textAnchor="middle" fontSize="8" fill="#fff" fontFamily="system-ui">
            ❄
          </text>
        </g>
      );
    case "bowtie":
      return (
        <g>
          <path d="M46 104l14 6-14 7zM74 104l-14 6 14 7z" fill="#dc2626" stroke="#991b1b" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="60" cy="110.5" r="3.5" fill="#991b1b" />
        </g>
      );
    case "lei":
      return (
        <g>
          {[30, 37, 44, 52, 60, 68, 76, 83, 90].map((x, i) => {
            const y = 104 + Math.sin((i / 8) * Math.PI) * 8;
            return (
              <g key={x}>
                <circle cx={x} cy={y} r="4" fill="#fff" stroke="#e5e7eb" />
                <circle cx={x} cy={y} r="1.3" fill="#fde68a" />
              </g>
            );
          })}
          <ellipse cx="60" cy="120" rx="3" ry="5" fill="#22c55e" />
        </g>
      );
    case "medal":
      return (
        <g>
          <path d="M46 100l14 14 14-14" stroke="#2563eb" strokeWidth="5" fill="none" strokeLinejoin="round" />
          <circle cx="60" cy="118" r="7" fill="#facc15" stroke="#ca8a04" strokeWidth="2" />
          <path d="M60 113.5l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#ca8a04" />
        </g>
      );
    default:
      return null;
  }
}

/** Held items sit at Alki's left hand (around x 14, y 106). */
function Hand({ id }: { id: string }) {
  switch (id) {
    case "coffee":
      return (
        <g>
          <path d="M4 96h16l-2 18H6z" fill="#fff" stroke="#9ca3af" strokeWidth="1.5" />
          <rect x="5" y="102" width="14" height="6" fill="#92400e" />
          <rect x="3" y="93" width="18" height="4" rx="2" fill="#78350f" />
          <path d="M9 90c-1-3 2-4 1-7M14 90c-1-3 2-4 1-7" stroke="#9ca3af" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      );
    case "moneybag":
      return (
        <g>
          <path d="M6 100c-6 6-6 18 8 18s14-12 8-18z" fill="#a16207" stroke="#713f12" strokeWidth="1.5" />
          <path d="M8 96h12l-3 5h-6z" fill="#854d0e" />
          <CoinMark x={14} y={114} size={10} fill="#fde68a" />
        </g>
      );
    case "flag":
      return (
        <g>
          <path d="M10 112V76" stroke="#6b4a12" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="10" y="76" width="22" height="7" fill="#0038a8" />
          <rect x="10" y="83" width="22" height="7" fill="#ce1126" />
          <path d="M10 76l11 7-11 7z" fill="#fff" />
          <circle cx="13.8" cy="83" r="1.8" fill="#fcd116" />
        </g>
      );
    case "coin":
      return (
        <g>
          <circle cx="13" cy="106.8" r="10" fill="#b8650a" />
          <circle cx="13" cy="106" r="10" fill="#fcc42d" stroke="#b86b06" strokeWidth="2" />
          <circle cx="13" cy="106" r="7" fill="none" stroke="#f59e0b" strokeWidth="1" />
          <CoinMark x={13} y={110.5} size={11.5} fill="#a65208" />
          <path d="M6.8 101.8a7 7 0 0 1 5-3.6" stroke="#fff" strokeOpacity=".85" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>
      );
    case "balloon":
      return (
        <g>
          <path d="M14 106c-4-12 4-24-2-40" stroke="#9ca3af" strokeWidth="1.2" fill="none" />
          <ellipse cx="10" cy="54" rx="10" ry="12" fill="#f472b6" />
          <path d="M8 66l2 3 2-3z" fill="#db2777" />
          <ellipse cx="6" cy="49" rx="2.5" ry="4" fill="#fff" opacity=".5" />
        </g>
      );
    default:
      return null;
  }
}

type Anim = "hop" | "wiggle" | "spin" | "jump" | "wave" | "droop" | "shake" | "shiver" | "sway" | "celebrate" | "walk";
type Burst = "coins" | "hearts" | "sparkles" | "stars" | "tears" | "steam" | "sweat" | "zzz" | "confetti";

const REACTIONS: { anim: Anim; face: Face; burst: Burst }[] = [
  { anim: "hop", face: "happy", burst: "coins" },
  { anim: "wiggle", face: "wink", burst: "sparkles" },
  { anim: "wave", face: "happy", burst: "sparkles" },
  { anim: "jump", face: "love", burst: "hearts" },
  { anim: "spin", face: "surprised", burst: "stars" },
  { anim: "celebrate", face: "excited", burst: "confetti" },
  { anim: "walk", face: "happy", burst: "sparkles" },
];

const FUN_LINES = [
  "Hi! Ipon tayo today? 🪙",
  "Kumain ka na? Log mo na rin! 🍜",
  "Every coin counts. Literally. 🪙",
  "Small ipon, big dreams! ✨",
  "Your future self says salamat! 💚",
  "I’m 80% bamboo, 20% savings.",
  "Psst… you’re doing great. 🙌",
  "Coins in, worries out! 🪙",
];

/** Text color of each burst. Tap reactions use real, full-color emoji on purpose (more playful),
 *  so this only colors the plain currency sign in the coin burst. */
const BURST_COLOR: Record<Burst, string> = {
  coins: "#e0a020",
  hearts: "#ec4899",
  sparkles: "#f5b301",
  stars: "#f5b301",
  tears: "#3b82f6",
  steam: "#ef4444",
  sweat: "#38bdf8",
  zzz: "#8b5cf6",
  confetti: "#22c55e",
};

const BURST_EMOJI: Record<Burst, string[]> = {
  coins: ["🪙", "₱", "🪙", "💰"], // "₱" is swapped for the main currency's sign when shown
  hearts: ["💚", "💖", "💛", "💗"],
  sparkles: ["✨", "⭐", "✨", "💫"],
  stars: ["⭐", "💫", "🌟", "✨"],
  tears: ["💧", "💧", "💧", "💧"],
  steam: ["💢", "💨", "💢", "💨"],
  sweat: ["💦", "💦", "💦", "💦"],
  zzz: ["💤", "💤", "💤", "💤"],
  confetti: ["🎉", "🎊", "✨", "🎉"],
};

/** How Alki acts out each mood when tapped. */
const MOOD_ACT: Partial<Record<Face, { anim: Anim; burst: Burst }>> = {
  sad: { anim: "droop", burst: "tears" },
  angry: { anim: "shake", burst: "steam" },
  worried: { anim: "shiver", burst: "sweat" },
  sleepy: { anim: "sway", burst: "zzz" },
  love: { anim: "jump", burst: "hearts" },
  excited: { anim: "celebrate", burst: "confetti" },
};

/**
 * Alki you can play with: each tap plays a reaction (animation, expression, a little burst)
 * and Alki says something: a fun line or one of the `lines` passed in (tips about your money).
 * Five quick taps make Alki dizzy.
 */
export function LiveAlki({
  size,
  look,
  outfit,
  motion = true,
  lines = [],
  mood,
  onSay,
  className = "",
}: {
  size: number;
  look?: Look;
  outfit?: string;
  motion?: boolean;
  /** Extra things Alki can say, e.g. streak or payday reminders. */
  lines?: string[];
  /** Alki's current mood (from lib/mood): sets the resting face and some tap reactions. */
  mood?: { face: Face; line: string };
  /** Show Alki's words somewhere else (e.g. a card below) instead of a floating bubble. */
  onSay?: (line: string | null) => void;
  className?: string;
}) {
  const [r, setR] = useState<{ n: number; anim: Anim; face: Face; burst: Burst; line: string } | null>(null);
  const taps = useRef<number[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; side: "left" | "below"; tail: number } | null>(null);

  // Place the speech bubble where it fits: beside Alki if that spot is free of anything marked
  // data-avoid (greeting, buttons, net worth…), otherwise just below Alki with the tail pointing up.
  useLayoutEffect(() => {
    if (!r || onSay) {
      setPos(null);
      return;
    }
    const place = () => {
      const a = wrapRef.current?.querySelector(".alkibtn")?.getBoundingClientRect();
      const b = bubbleRef.current;
      if (!a || !b) return;
      const bw = b.offsetWidth;
      const bh = b.offsetHeight;
      const vw = window.innerWidth;
      const gap = 8;
      const avoid = [...document.querySelectorAll("[data-avoid]")].map((e) => e.getBoundingClientRect());
      const hits = (x: number, y: number) => avoid.some((o) => x < o.right && x + bw > o.left && y < o.bottom && y + bh > o.top);
      const sx = a.left - gap - bw;
      const sy = a.top + a.height * 0.15;
      if (sx >= 8 && !hits(sx, sy)) {
        setPos({ left: sx, top: sy, side: "left", tail: 0 });
        return;
      }
      const cx = a.left + a.width / 2;
      const left = Math.max(8, Math.min(vw - 8 - bw, cx - bw + 40));
      setPos({ left, top: a.bottom + gap, side: "below", tail: Math.min(bw - 16, Math.max(16, cx - left)) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [r, onSay]);
  const lastLine = useRef("");
  const lastAnim = useRef<Anim | "">("");

  useEffect(() => {
    if (!r) return;
    onSay?.(r.line);
    const t = setTimeout(() => {
      setR(null);
      onSay?.(null);
    }, onSay ? 4500 : 2800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  function tap() {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 1600), now];
    try {
      navigator.vibrate?.(12);
    } catch {
      /* not supported */
    }
    if (taps.current.length >= 5) {
      taps.current = [];
      setR({ n: now, anim: "spin", face: "surprised", burst: "stars", line: "Whoa, nahihilo ako! 😵‍💫 Ang kulit mo!" });
      return;
    }
    // When Alki has strong feelings, it often acts them out and tells you why.
    const act = mood ? MOOD_ACT[mood.face] : undefined;
    if (mood && act && (Math.random() < 0.6 || lastLine.current !== mood.line)) {
      lastLine.current = mood.line;
      lastAnim.current = act.anim;
      setR({ n: now, anim: act.anim, face: mood.face, burst: act.burst, line: mood.line });
      return;
    }
    const options = REACTIONS.filter((x) => x.anim !== lastAnim.current);
    const pick = options[Math.floor(Math.random() * options.length)];
    // Prefer helpful lines about your money, mixed with fun ones.
    const pool = [...lines.filter(Boolean), ...lines.filter(Boolean), ...FUN_LINES, ...(look && Object.keys(look).length ? ["Like my outfit? 😎"] : [])].filter(
      (x) => x !== lastLine.current,
    );
    const line = pool[Math.floor(Math.random() * pool.length)] ?? FUN_LINES[0];
    lastLine.current = line;
    lastAnim.current = pick.anim;
    setR({ n: now, ...pick, line });
  }

  return (
    <div className={`livealki ${className}`} ref={wrapRef}>
      <button type="button" className={`alkibtn${r && motion ? ` react-${r.anim}` : ""}`} key={r?.n ?? 0} onClick={tap} aria-label="Tap Alki">
        <Mascot size={size} look={look} outfit={outfit} animated={motion && !r} face={r?.face ?? mood?.face ?? "normal"} />
      </button>
      {r && motion && (
        <span className="alkiburst" key={`b${r.n}`} aria-hidden="true" style={{ color: BURST_COLOR[r.burst] }}>
          {BURST_EMOJI[r.burst].map((e, i) => (
            <i key={i} style={{ ["--dx" as string]: `${(i - 1.5) * 22}px`, animationDelay: `${i * 60}ms` }}>
              {e === "₱" ? coinSymbol(getBaseCurrency()) : e}
            </i>
          ))}
        </span>
      )}
      {r &&
        !onSay &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            ref={bubbleRef}
            key={`s${r.n}`}
            role="status"
            className={`alkibubble ${pos?.side ?? "measuring"}`}
            style={pos ? { left: pos.left, top: pos.top, ["--tail" as string]: `${pos.tail}px` } : { left: -9999, top: 0 }}
          >
            {r.line}
          </span>,
          document.body,
        )}
    </div>
  );
}

export const ALKI_SIZES = {
  small: { home: 64, wallet: 60 },
  medium: { home: 92, wallet: 82 },
  large: { home: 120, wallet: 104 },
} as const;
export type AlkiSize = keyof typeof ALKI_SIZES;
