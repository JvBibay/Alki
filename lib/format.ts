import { formatMoney, getCurrency } from "./currency";
import type { Account } from "./types";

// The main currency, set by the app from Settings so every total shows the right symbol.
let BASE = "PHP";
export const setBaseCurrency = (code?: string) => {
  BASE = code || "PHP";
};
export const getBaseCurrency = () => BASE;

// "Hide amounts" privacy mode: every formatted amount shows as ₱••••• instead.
let HIDE = false;
export const setHideAmounts = (on?: boolean) => {
  HIDE = !!on;
};
export const amountsHidden = () => HIDE;
const MASK = "•••••";

/** Money in the main currency: ₱1,250 or ₱1,250.50. */
export function fmt(n: number, decimals = false): string {
  if (HIDE) return getCurrency(BASE).symbol + MASK;
  return formatMoney(n, BASE, decimals);
}

/** Money in a specific currency, e.g. an account's own: $50.25, ¥12,000. */
export function fmtIn(n: number, code?: string, decimals = false): string {
  if (HIDE) return getCurrency(code || BASE).symbol + MASK;
  return formatMoney(n, code || BASE, decimals);
}

/** Short form for tight spaces: ₱12.5k */
export function fmtShort(n: number): string {
  if (HIDE) return getCurrency(BASE).symbol + "•••";
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? (a / 1_000_000).toFixed(1) + "M" : a >= 10_000 ? (a / 1000).toFixed(1) + "k" : a.toLocaleString("en-PH", { maximumFractionDigits: 0 });
  return (n < 0 ? "−" : "") + getCurrency(BASE).symbol + s.replace(".0", "");
}

export function accountName(accounts: Account[], id?: string): string {
  return accounts.find((a) => a.id === id)?.name ?? "Deleted account";
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

export function dayLabel(ts: number): string {
  const now = Date.now();
  if (sameDay(ts, now)) return "Today";
  if (sameDay(ts, now - 86_400_000)) return "Yesterday";
  return new Date(ts).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
}

/** Two-letter weekday for chart axes (Mo Tu We Th Fr Sa Su), so Tuesday/Thursday and Saturday/Sunday don't both read "T" / "S". */
export const weekdayShort = (d: Date | number) => new Date(d).toLocaleDateString("en-PH", { weekday: "short" }).slice(0, 2);

/** Full day for a caption: "Tuesday, Nov 24". */
export const weekdayFull = (d: Date | number) => new Date(d).toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" });

export const shortDate = (d: Date | number) =>
  new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
