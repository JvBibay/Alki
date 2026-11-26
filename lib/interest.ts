import type { Account, State, Tx } from "./types";
import { balance } from "./stats";

/**
 * Automatic interest for savings accounts.
 *
 * Interest is worked out from the account's end-of-day balances over each calendar period (day,
 * month, quarter or year) at the yearly rate, minus withholding tax, and recorded as an "Interest"
 * income entry dated on the last day of the period. Only whole, finished periods are posted, and an
 * account remembers where it got to (`interestFrom`), so nothing is ever posted twice. Entries are
 * recorded net of tax: the tax isn't logged as a separate expense.
 */

export type InterestFreq = "daily" | "monthly" | "quarterly" | "yearly";
export const FREQS: { id: InterestFreq; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
];
export const isFreq = (x: unknown): x is InterestFreq => FREQS.some((f) => f.id === x);

/** Never post more than this many periods in one go (a long-unused app catches up over a few opens). */
const MAX_PERIODS = 400;

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const nextDay = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Accounts that earn interest: a rate is set, tracking has started, and it's a bank or e-wallet. */
export const earnsInterest = (a: Account) => !!a.rate && a.rate > 0 && !!a.interestFrom && (a.kind === "bank" || a.kind === "ewallet") && !a.archived;

/** Start of the day after the calendar period (of this frequency) that contains `ts`. */
export function periodEnd(ts: number, freq: InterestFreq): number {
  const d = new Date(ts);
  switch (freq) {
    case "daily":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    case "monthly":
      return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    case "quarterly":
      return new Date(d.getFullYear(), (Math.floor(d.getMonth() / 3) + 1) * 3, 1).getTime();
    default:
      return new Date(d.getFullYear() + 1, 0, 1).getTime();
  }
}

/** When the interest being counted now will be credited (the end of the current period). */
export function nextInterestDate(a: Account): number | null {
  if (!earnsInterest(a)) return null;
  return periodEnd(startOfDay(a.interestFrom!), a.interestFreq ?? "monthly");
}

function label(start: number, freq: InterestFreq): string {
  const d = new Date(start);
  if (freq === "daily") return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  if (freq === "monthly") return d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  if (freq === "quarterly") return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  return String(d.getFullYear());
}

/** How a transaction changes this account's balance. */
function delta(t: Tx, a: Account): number {
  if (t.track) return 0;
  if (t.type === "income" && t.acc === a.id) return t.amount;
  if (t.type === "expense" && t.acc === a.id) return -t.amount;
  if (t.type === "transfer") return (t.to === a.id ? t.toAmount ?? t.amount : 0) - (t.acc === a.id ? t.amount : 0);
  return 0;
}

const daysInYear = (ts: number) => {
  const y = new Date(ts).getFullYear();
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
};

/** Gross interest per year (before tax) on a balance, using the account's rate and any higher-rate tier. */
export function yearlyInterestOn(a: Account, bal: number): number {
  if (bal <= 0) return 0;
  const base = a.rate ?? 0;
  if (a.rate2 && a.tierAt && bal > a.tierAt) {
    // Default: the higher rate only applies to the part above the threshold (never overstates).
    return a.tierMode === "whole" ? (bal * a.rate2) / 100 : (a.tierAt * base + (bal - a.tierAt) * a.rate2) / 100;
  }
  return (bal * base) / 100;
}

/**
 * Gross interest earned over the days in [from, to): each day earns a day's worth (1/365, or 1/366 in a
 * leap year) of the yearly interest on that day's closing balance.
 */
export function accrue(state: State, a: Account, from: number, to: number): number {
  let bal = balance(state, a, from - 1);
  const txs = state.txs.filter((t) => (t.acc === a.id || t.to === a.id) && t.date >= from && t.date < to).sort((x, y) => x.date - y.date);
  let i = 0;
  let sum = 0;
  for (let day = from; day < to; day = nextDay(day)) {
    const end = nextDay(day);
    while (i < txs.length && txs[i].date < end) bal += delta(txs[i++], a);
    sum += yearlyInterestOn(a, bal) / daysInYear(day);
  }
  return sum;
}

export interface InterestAdded {
  acc: string;
  name: string;
  currency?: string;
  amount: number;
}

/**
 * Posts any interest that has come due since each account last got its interest. Returns the new
 * state and what was added, or null when nothing changed.
 */
export function dueInterest(state: State, now = Date.now()): { state: State; added: InterestAdded[] } | null {
  const today = startOfDay(now);
  const work: State = { ...state, txs: [...state.txs] };
  const ids = new Set(state.txs.map((t) => t.id));
  const added: InterestAdded[] = [];
  let changed = false;

  const accounts = state.accounts.map((a) => {
    if (!earnsInterest(a)) return a;
    const freq = a.interestFreq ?? "monthly";
    const from = startOfDay(a.interestFrom!);
    let cursor = from;
    // Under a centavo can't be paid out, so it's carried forward (banks do the same) instead of being lost.
    let carry = a.interestCarry ?? 0;
    for (let n = 0; n < MAX_PERIODS; n++) {
      const end = periodEnd(cursor, freq);
      if (end > today) break; // this period isn't over yet
      const total = carry + accrue(work, a, cursor, end) * (1 - (a.tax ?? 0) / 100);
      const net = Math.floor(total * 100 + 1e-6) / 100;
      const id = `int-${a.id}-${cursor}`;
      if (net >= 0.01 && !ids.has(id)) {
        // Interest earned during a period is dated on its last day, so it counts in the right month.
        const tx: Tx = { id, type: "income", amount: net, cat: "Interest", note: `Interest · ${label(cursor, freq)}`, acc: a.id, date: end - 1, auto: true };
        work.txs.push(tx);
        ids.add(id);
        added.push({ acc: a.id, name: a.name, currency: a.currency, amount: net });
        carry = total - net;
      } else {
        carry = total;
      }
      cursor = end;
    }
    if (cursor === from) return a;
    changed = true;
    return { ...a, interestFrom: cursor, interestCarry: carry > 1e-9 ? Math.round(carry * 1e9) / 1e9 : undefined };
  });

  return changed ? { state: { ...work, accounts }, added } : null;
}
