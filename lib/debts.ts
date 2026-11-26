/** Debts (utang) and split bills: the math behind them. */
import type { Debt, State } from "./types";

/** What's still unpaid on a debt. */
export const debtPaid = (d: Debt) => d.payments.reduce((s, p) => s + p.amount, 0);
export const debtLeft = (d: Debt) => Math.max(0, Math.round((d.amount - debtPaid(d)) * 100) / 100);
export const isSettled = (d: Debt) => debtLeft(d) <= 0;

/** Totals in the main currency (debts are recorded in the main currency). */
export function debtTotals(state: State) {
  let owe = 0;
  let owed = 0;
  for (const d of state.debts ?? []) {
    const left = debtLeft(d);
    if (d.direction === "owe") owe += left;
    else owed += left;
  }
  return { owe, owed, open: (state.debts ?? []).filter((d) => !isSettled(d)).length };
}

/**
 * Splits a total into shares, to the centavo, so they always add back up to the total.
 * `people` excludes you; `includeMe` adds your own share.
 */
export function equalShares(total: number, people: number, includeMe: boolean) {
  const n = people + (includeMe ? 1 : 0);
  if (n <= 0 || total <= 0) return { mine: includeMe ? total : 0, each: [] as number[] };
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  let extra = cents - base * n; // spread leftover centavos so nothing is lost
  const shares = Array.from({ length: n }, () => {
    const c = base + (extra > 0 ? 1 : 0);
    extra--;
    return c / 100;
  });
  // You take the last share (smallest when it doesn't divide evenly); friends get the rest.
  return includeMe ? { mine: shares[n - 1], each: shares.slice(0, n - 1) } : { mine: 0, each: shares };
}

/** A friendly text summary to paste into a group chat. */
export function splitSummary(title: string, total: number, people: { name: string; share: number; paid: boolean }[], myShare: number, fmt: (n: number) => string) {
  const lines = [`🧾 ${title}: ${fmt(total)}`];
  if (myShare > 0) lines.push(`• Me: ${fmt(myShare)} ✅`);
  for (const p of people) lines.push(`• ${p.name}: ${fmt(p.share)} ${p.paid ? "✅ paid" : "⏳"}`);
  lines.push("— sent from Kwenta");
  return lines.join("\n");
}
