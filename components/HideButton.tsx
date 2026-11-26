"use client";

import type { Ctx } from "@/lib/ui";
import Icon from "./Icon";

/** Eye button that hides or shows every amount in the app (privacy mode). */
export default function HideButton({ ctx }: { ctx: Ctx }) {
  const hidden = !!ctx.k.state.settings.hideAmounts;
  return (
    <button
      className="iconbtn light"
      onClick={() => ctx.k.updateSettings({ hideAmounts: !hidden })}
      aria-label={hidden ? "Show amounts" : "Hide amounts"}
      aria-pressed={hidden}
      title={hidden ? "Show amounts" : "Hide amounts"}
    >
      <Icon name={hidden ? "eyeOff" : "eye"} />
    </button>
  );
}
