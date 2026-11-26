"use client";

import { useState } from "react";
import type { Ctx } from "@/lib/ui";
import { daysLeft, trialEndingSoon } from "@/lib/plans";
import Plans from "./Plans";
import Emoji from "./Emoji";

const KEY = "kwenta-trial-nudge";
const today = () => new Date().toDateString();
const dismissedToday = () => {
  try {
    return localStorage.getItem(KEY) === today();
  } catch {
    return false;
  }
};

/** In the last 2 days of the free trial: a gentle reminder on Home. "Later" hides it until tomorrow. */
export default function TrialBanner({ ctx }: { ctx: Ctx }) {
  const [hidden, setHidden] = useState(dismissedToday);
  const [open, setOpen] = useState(false);
  const { access } = ctx;
  if (!trialEndingSoon(access) || !access.until) return open ? <Plans access={access} onClose={() => setOpen(false)} /> : null;
  return (
    <>
      {!hidden && (
        <section className="card" style={{ padding: 12, margin: "12px 16px" }} aria-label="Free trial ending">
          <b>
            <Emoji e="⏳" /> Your free trial ends in {daysLeft(access.until)}
          </b>
          <p className="sub" style={{ margin: "4px 0 10px" }}>
            After that you keep the free plan (2 accounts). Choose a plan to keep everything open. Nothing is charged automatically.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn sm" onClick={() => setOpen(true)}>
              See plans
            </button>
            <button
              className="btn ghost sm"
              onClick={() => {
                try {
                  localStorage.setItem(KEY, today());
                } catch {
                  /* ignore */
                }
                setHidden(true);
              }}
            >
              Later
            </button>
          </div>
        </section>
      )}
      {open && (
        <Plans
          access={access}
          onClose={() => {
            setOpen(false);
            access.refresh();
          }}
        />
      )}
    </>
  );
}
