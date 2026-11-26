"use client";

import type { Ctx } from "@/lib/ui";
import type { PayFreq } from "@/lib/types";
import { nextPayday, payFreqOf } from "@/lib/stats";
import { shortDate } from "@/lib/format";

const FREQS: [PayFreq, string][] = [
  ["monthly", "Monthly"],
  ["semimonthly", "Twice a month"],
  ["weekly", "Weekly"],
  ["biweekly", "Every 2 weeks"],
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const clampDay = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : 0;
};
const toInput = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** How often you get paid; drives "Next sweldo", the daily allowance and the forecast. */
export default function PaySchedule({ ctx }: { ctx: Ctx }) {
  const { k } = ctx;
  const s = k.state.settings;
  const freq = payFreqOf(s);
  const next = nextPayday(s);
  const set = (patch: Partial<typeof s>) => k.updateSettings(patch);

  return (
    <div className="payschedule">
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        Sweldo schedule
      </div>
      <div className="seg small wrap" role="tablist">
        {FREQS.map(([f, label]) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={freq === f}
            onClick={() =>
              set({
                payFreq: f,
                // Sensible starting values for each schedule.
                payday: f === "monthly" ? [s.payday[s.payday.length - 1] ?? 30] : f === "semimonthly" ? [s.payday[0] && s.payday[0] <= 15 ? s.payday[0] : 15, 30] : s.payday,
              })
            }
          >
            {label}
          </button>
        ))}
      </div>

      {freq === "monthly" && (
        <label>
          Payday (day of the month)
          <input type="number" inputMode="numeric" min={1} max={31} value={s.payday[0] ?? ""} onChange={(e) => set({ payday: [clampDay(e.target.value) || 30] })} />
        </label>
      )}

      {freq === "semimonthly" && (
        <div className="formrow">
          <label>
            First payday
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={s.payday[0] ?? ""}
              onChange={(e) => set({ payday: [clampDay(e.target.value) || 15, s.payday[1] ?? 30] })}
            />
          </label>
          <label>
            Second payday
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={s.payday[1] ?? ""}
              onChange={(e) => set({ payday: [s.payday[0] ?? 15, clampDay(e.target.value) || 30] })}
            />
          </label>
        </div>
      )}

      {(freq === "weekly" || freq === "biweekly") && (
        <div className="formrow">
          <label>
            Payday
            <select value={s.payWeekday ?? 5} onChange={(e) => set({ payWeekday: Number(e.target.value) })}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  Every {d}
                </option>
              ))}
            </select>
          </label>
          {freq === "biweekly" && (
            <label>
              A recent payday
              <input
                type="date"
                value={toInput(s.payAnchor ?? next.date.getTime())}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  const date = new Date(y, m - 1, d, 12);
                  set({ payAnchor: date.getTime(), payWeekday: date.getDay() });
                }}
              />
            </label>
          )}
        </div>
      )}

      <p className="sub">
        Next sweldo: <b>{next.daysLeft === 0 ? "today 🎉" : `${shortDate(next.date)} (${next.daysLeft} day${next.daysLeft === 1 ? "" : "s"})`}</b>
        {freq === "semimonthly" && " · Day 30/31 means the last day of the month."}
      </p>
    </div>
  );
}
