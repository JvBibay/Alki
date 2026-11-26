"use client";

import { useEffect, useState } from "react";
import type { Look } from "@/lib/closet";
import Mascot from "./Mascot";
import Emoji from "./Emoji";
import { coinScale, coinSymbol } from "@/lib/currency";
import { getBaseCurrency } from "@/lib/format";

/**
 * Opening animation: Alki drops in, a coin (with the main currency's sign) falls into its slot, and the name appears.
 * About 1.7s; tap anywhere to skip. Shorter when the phone asks for reduced motion.
 */
export default function Splash({ look, onLeave, onDone }: { look?: Look; onLeave?: () => void; onDone: () => void }) {
  const [phase, setPhase] = useState<"drop" | "coin" | "name" | "out">("drop");

  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Starts a beat late so the phone's own launch screen has gone before Alki drops in.
    const plan: [typeof phase, number][] = reduced
      ? [["name", 0], ["out", 500]]
      : [
          ["coin", 720],
          ["name", 1140],
          ["out", 1800],
        ];
    const timers = plan.map(([p, t]) =>
      setTimeout(() => {
        setPhase(p);
        // The app starts rising in underneath while this fades, so there's no flicker.
        if (p === "out") onLeave?.();
      }, t),
    );
    const end = setTimeout(onDone, reduced ? 800 : 2100);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
    };
  }, [onDone, onLeave]);

  const landed = phase !== "drop";
  // Keep hats/glasses, but no coin on Alki: this coin is the one that drops in.
  // No scene either: the opening screen keeps its own plain background.
  const splashLook = { ...look, head: look?.head ?? "__none", scene: undefined };
  const mark = coinSymbol(getBaseCurrency());

  return (
    <div className={`splash ${phase}`} onClick={() => { onLeave?.(); onDone(); }} role="presentation">
      <div className="splash-stage">
        <span className="splash-coin" aria-hidden="true">
          <span style={{ fontSize: `${coinScale(mark)}em` }}>{mark}</span>
        </span>
        {landed && (
          <span className="splash-sparkle" aria-hidden="true">
            <i><Emoji e="✨" /></i>
            <i><Emoji e="✨" /></i>
            <i><Emoji e="✨" /></i>
          </span>
        )}
        <div className="splash-alki">
          <Mascot size={132} look={splashLook} face={phase === "coin" || phase === "name" || phase === "out" ? "happy" : "normal"} />
        </div>
      </div>
      <div className="splash-name">
        <h1>Kwenta</h1>
        <p>Bawat piso, may kwenta.</p>
      </div>
    </div>
  );
}
