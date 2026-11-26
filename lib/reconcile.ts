import type { Account, State, Tx } from "./types";
import { balance } from "./stats";

/** How an entry moves one account's balance (+ in, − out). Track-only entries and other accounts' entries move nothing. */
export function effectOn(t: Tx, accId: string): number {
  if (t.track) return 0;
  if (t.type === "income") return t.acc === accId ? t.amount : 0;
  if (t.type === "expense") return t.acc === accId ? -t.amount : 0;
  let e = 0;
  if (t.acc === accId) e -= t.amount;
  if (t.to === accId) e += t.toAmount ?? t.amount;
  return e;
}

export type HintKind = "flipped" | "extra" | "missing";

export interface Hint {
  kind: HintKind;
  /** The entry the hint is about (none for "missing"). */
  tx?: Tx;
}

const cents = (n: number) => Math.round(n * 100);
const RECENT_DAYS = 45;

/**
 * Why might Kwenta differ from the bank? `diff` is real balance minus Kwenta's balance, in the account's own
 * balance terms (a card's balance is negative when you owe). Looks at recent entries for:
 *  - flipped: logged as spending but was income (or the reverse), so flipping it closes the gap exactly;
 *  - extra: an entry the bank doesn't have (a duplicate, or logged on the wrong account), so removing it closes the gap;
 * and always ends with "missing": something simply wasn't logged.
 */
export function reconcileHints(state: State, a: Account, diff: number, now = Date.now()): Hint[] {
  const d = cents(diff);
  if (d === 0) return [];
  const since = now - RECENT_DAYS * 86_400_000;
  const recent = state.txs
    .filter((t) => t.date >= since && t.date <= now + 86_400_000 && effectOn(t, a.id) !== 0)
    .sort((x, y) => y.date - x.date);
  const out: Hint[] = [];
  for (const t of recent) {
    const e = cents(effectOn(t, a.id));
    // Flipping direction changes the balance by −2e. Transfers are skipped: they have two sides.
    if (t.type !== "transfer" && d === -2 * e) out.push({ kind: "flipped", tx: t });
    else if (d === -e) out.push({ kind: "extra", tx: t });
  }
  const hints = out.slice(0, 3);
  hints.push({ kind: "missing" });
  return hints;
}

/** Days since the account was last checked against the bank, or null if it never was. */
export function daysSinceChecked(a: Account, now = Date.now()): number | null {
  return a.checkedAt ? Math.max(0, Math.floor((now - a.checkedAt) / 86_400_000)) : null;
}

/** The account's balance in its own "what the bank shows" terms (a card shows what you owe). */
export function shownBalance(state: State, a: Account): number {
  const b = balance(state, a);
  return Math.round((a.kind === "credit" ? Math.max(0, -b) : b) * 100) / 100;
}
