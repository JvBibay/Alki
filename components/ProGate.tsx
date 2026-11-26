"use client";

import { useState } from "react";
import type { Ctx } from "@/lib/ui";
import Plans from "./Plans";

/** Shown in place of a paid screen on the free plan. */
export default function ProGate({ ctx, what }: { ctx: Ctx; what: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="form" style={{ padding: 16 }}>
      <div className="card" style={{ padding: 16, textAlign: "center" }}>
        <p style={{ fontSize: 28, margin: 0 }} aria-hidden>
          🔒
        </p>
        <b>{what} is part of a paid plan</b>
        <p className="sub" style={{ margin: "6px 0 12px" }}>
          The free plan keeps tracking, budgets, goals and cash flow. Choose monthly, annual or lifetime to unlock this.
        </p>
        <button className="btn" onClick={() => setOpen(true)}>
          See plans
        </button>
      </div>
      {open && (
        <Plans
          access={ctx.access}
          onClose={() => {
            setOpen(false);
            ctx.access.refresh();
          }}
        />
      )}
    </div>
  );
}
