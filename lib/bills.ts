import type { Planned, State, Tx } from "./types";
import type { UpcomingItem } from "./stats";

const DAY = 86_400_000;

/**
 * An entry you already logged that looks like this bill's payment: similar name, an amount within 10%,
 * and a date within a week of the due date. Returns the closest one, or undefined.
 */
export function billMatch(state: State, u: UpcomingItem): Tx | undefined {
  const p = u.item;
  if (!(p.amount > 0)) return undefined;
  const words = p.name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  if (!words.length) return undefined;
  const dueMs = u.due.getTime();
  let best: Tx | undefined;
  let bestGap = Infinity;
  for (const t of state.txs) {
    if (t.bill || t.track || t.auto || t.type !== p.type) continue;
    const text = (t.note || "").toLowerCase();
    if (!words.some((w) => text.includes(w))) continue;
    if (Math.abs(t.amount - p.amount) > p.amount * 0.1) continue;
    const gap = Math.abs(t.date - dueMs);
    if (gap > 7 * DAY || gap >= bestGap) continue;
    best = t;
    bestGap = gap;
  }
  return best;
}

/** What was really paid for a month (falls back to the expected amount for older entries). */
export function paidAmount(p: Planned, key: string): number {
  return p.paid?.[key]?.amount ?? p.amount;
}

/**
 * Makes a bill unpaid again for a month. An entry Kwenta logged when you tapped "Mark paid" is deleted;
 * one you had logged yourself is kept and just unlinked.
 */
export function unpay(s: Pick<State, "txs" | "planned">, id: string, key: string): Pick<State, "txs" | "planned"> {
  const p = s.planned.find((x) => x.id === id);
  if (!p) return { txs: s.txs, planned: s.planned };
  const rec = p.paid?.[key];
  let txs = s.txs;
  if (rec) {
    txs = rec.created
      ? s.txs.filter((t) => t.id !== rec.txId)
      : s.txs.map((t) => {
          if (t.id !== rec.txId) return t;
          const { bill: _bill, ...rest } = t;
          void _bill;
          return rest;
        });
  }
  const paid = { ...p.paid };
  delete paid[key];
  return {
    txs,
    planned: s.planned.map((x) => (x.id === id ? { ...x, done: x.done.filter((d) => d !== key), paid } : x)),
  };
}
