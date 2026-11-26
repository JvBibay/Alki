/**
 * Locked savings / time deposits: money set aside for a fixed number of months at a fixed
 * yearly rate. Philippine banks withhold 20% final tax on deposit interest, so we show both
 * gross and net. Interest is estimated as simple interest (principal × rate × months / 12);
 * your bank's exact figure may differ slightly by day-count rules.
 */
import type { Account, State } from "./types";
import { DAY, startOfDay } from "./stats";

export const DEFAULT_TAX = 20;
export const TERM_CHOICES = [1, 3, 6, 12, 24];

/** Same day of the month, `months` later (clamped to month end, e.g. Jan 31 + 1 → Feb 28). */
export function addMonths(ts: number, months: number): number {
  const d = new Date(ts);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + months, 1, 12);
  t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return t.getTime();
}

export function depositMath(principal: number, ratePct: number, months: number, taxPct = DEFAULT_TAX) {
  const gross = Math.round(principal * (ratePct / 100) * (months / 12) * 100) / 100;
  const tax = Math.round(gross * (taxPct / 100) * 100) / 100;
  const net = Math.round((gross - tax) * 100) / 100;
  return { gross, tax, net, atMaturity: Math.round((principal + net) * 100) / 100 };
}

export interface DepositStatus {
  maturity: number;
  daysLeft: number;
  /** 0–1, how much of the term has passed. */
  progress: number;
  matured: boolean;
  /** "4 months 12 days left" */
  left: string;
}

export function depositStatus(a: Account, now = Date.now()): DepositStatus | null {
  const d = a.deposit;
  if (!d) return null;
  const maturity = addMonths(d.start, d.months);
  const today = startOfDay(now);
  const daysLeft = Math.round((startOfDay(maturity) - today) / DAY);
  const total = Math.max(1, startOfDay(maturity) - startOfDay(d.start));
  const progress = Math.min(1, Math.max(0, (today - startOfDay(d.start)) / total));
  let left = "";
  if (daysLeft > 0) {
    // Whole months still to go, then leftover days.
    let m = 0;
    while (addMonths(today, m + 1) <= maturity) m++;
    const days = Math.round((startOfDay(maturity) - startOfDay(addMonths(today, m))) / DAY);
    left = [m ? `${m} month${m === 1 ? "" : "s"}` : "", days ? `${days} day${days === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ") + " left";
  }
  return { maturity, daysLeft, progress, matured: daysLeft <= 0, left };
}

/** Deposits that are still locked (not yet collected or withdrawn). */
export const activeDeposits = (state: State) => state.accounts.filter((a) => a.kind === "locked" && a.deposit?.status === "locked");
