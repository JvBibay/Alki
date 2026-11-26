/**
 * Budgets: a spending limit per category, each with its own period
 * (daily, weekly, every 2 weeks, monthly or yearly).
 */
import type { State } from "./types";
import { addDays, DAY, startOfDay, sumRange } from "./stats";

export type BudgetPeriod = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export const PERIODS: { id: BudgetPeriod; label: string; this: string }[] = [
  { id: "daily", label: "Daily", this: "today" },
  { id: "weekly", label: "Weekly", this: "this week" },
  { id: "biweekly", label: "Every 2 weeks", this: "these 2 weeks" },
  { id: "monthly", label: "Monthly", this: "this month" },
  { id: "yearly", label: "Yearly", this: "this year" },
];
export const periodInfo = (p: BudgetPeriod) => PERIODS.find((x) => x.id === p) ?? PERIODS[3];

// Two-week windows line up from a fixed Monday so they're stable over time.
const BIWEEK_ANCHOR = new Date(2024, 0, 1).getTime();

/** Start and end of the current period containing `now`. */
export function periodBounds(p: BudgetPeriod, now = Date.now()): [number, number] {
  const d0 = startOfDay(now);
  const d = new Date(d0);
  switch (p) {
    case "daily":
      return [d0, addDays(d0, 1)];
    case "weekly": {
      const start = addDays(d0, -((d.getDay() + 6) % 7)); // Monday
      return [start, addDays(start, 7)];
    }
    case "biweekly": {
      // Count whole days (rounded, so a 23- or 25-hour day can't tip the count), then whole weeks.
      const weeks = Math.floor(Math.round((d0 - BIWEEK_ANCHOR) / DAY) / 7);
      const start = addDays(BIWEEK_ANCHOR, (weeks - (((weeks % 2) + 2) % 2)) * 7);
      return [start, addDays(start, 14)];
    }
    case "yearly":
      return [new Date(d.getFullYear(), 0, 1).getTime(), new Date(d.getFullYear() + 1, 0, 1).getTime()];
    default:
      return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()];
  }
}

export interface BudgetStatus {
  cat: string;
  limit: number;
  period: BudgetPeriod;
  spent: number;
  pct: number;
  left: number;
  /** How far into the period we are, 0–1 (for the "on pace" marker). */
  elapsed: number;
  from: number;
  to: number;
}

/**
 * How a budget is doing against the clock:
 *  - "over": already past the limit
 *  - "fast": under the limit, but the share spent is ahead of the share of the period gone (by more than 5 points)
 *  - "ok": on track: spent share at or below the elapsed share (give or take 5 points)
 */
export type Pace = "over" | "fast" | "ok";
export const PACE_SLACK = 0.05;
export function paceOf(b: Pick<BudgetStatus, "spent" | "limit" | "pct" | "elapsed">): Pace {
  if (b.spent > b.limit) return "over";
  return b.pct / 100 > b.elapsed + PACE_SLACK ? "fast" : "ok";
}

export const periodOf = (state: State, cat: string): BudgetPeriod => state.budgetPeriods?.[cat] ?? "monthly";

/** Every budget with what's been spent in its current period (main currency). */
export function budgetList(state: State, now = Date.now()): BudgetStatus[] {
  const cache = new Map<string, ReturnType<typeof sumRange>>();
  return Object.entries(state.budgets)
    .filter(([, limit]) => limit > 0)
    .map(([cat, limit]) => {
      const period = periodOf(state, cat);
      const [from, to] = periodBounds(period, now);
      const key = `${from}-${to}`;
      if (!cache.has(key)) cache.set(key, sumRange(state, from, to));
      const spent = cache.get(key)!.cats[cat] ?? 0;
      return {
        cat,
        limit,
        period,
        spent,
        pct: (spent / limit) * 100,
        left: limit - spent,
        elapsed: Math.min(1, Math.max(0, (now - from) / (to - from))),
        from,
        to,
      };
    });
}
