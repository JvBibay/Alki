import type { State, Tx } from "./types";
import { DAY, monthRange, startOfDay, sumRange, toBase } from "./stats";

export interface MonthRecap {
  y: number;
  m: number;
  label: string;
  entries: number;
  income: number;
  expense: number;
  saved: number;
  /** Share of income kept, 0–100 (null when there was no income). */
  savingsRate: number | null;
  /** Spending change vs the month before, in % (null if no data before). */
  vsPrev: number | null;
  topCats: { cat: string; amount: number; pct: number }[];
  biggest: Tx | null;
  biggestBase: number;
  busiestDay: { date: number; amount: number } | null;
  noSpendDays: number;
  daysInMonth: number;
  topAccount: { id: string; count: number } | null;
  loggedDays: number;
  style: { title: string; emoji: string; line: string };
}

const STYLES = {
  saver: { title: "The Alkansya Pro", emoji: "🪙", line: "You kept a big part of what came in. Future you says thanks." },
  foodie: { title: "The Foodie", emoji: "🍜", line: "Food led your month. Try one home-cooked day a week and watch it add up." },
  commuter: { title: "The Road Warrior", emoji: "🚌", line: "Getting around took the most. Grouping errands can trim it." },
  shopper: { title: "The Cart Collector", emoji: "🛍️", line: "Shopping topped the list. A 24-hour wait before checkout helps." },
  bills: { title: "The Responsible One", emoji: "💡", line: "Bills came first. Check for subscriptions you no longer use." },
  fun: { title: "The Good-Times Spender", emoji: "🎬", line: "You made time for fun. Just keep it inside a budget." },
  health: { title: "The Self-Carer", emoji: "💊", line: "Health was your priority. Money well spent." },
  balanced: { title: "The Balancer", emoji: "⚖️", line: "No single thing ran away with your money. Steady!" },
  starter: { title: "The Fresh Start", emoji: "🌱", line: "A quiet month of records. The more you log, the smarter this gets." },
};

function styleFor(r: Pick<MonthRecap, "entries" | "savingsRate" | "topCats">) {
  if (r.entries < 5) return STYLES.starter;
  if (r.savingsRate !== null && r.savingsRate >= 30) return STYLES.saver;
  const top = r.topCats[0];
  if (!top || top.pct < 30) return STYLES.balanced;
  return (
    { Food: STYLES.foodie, Transport: STYLES.commuter, Shopping: STYLES.shopper, Bills: STYLES.bills, Fun: STYLES.fun, Health: STYLES.health }[top.cat] ??
    STYLES.balanced
  );
}

/** Everything the monthly recap shows, in the main currency. */
export function monthRecap(state: State, y: number, m: number, now = Date.now()): MonthRecap {
  const [from, to] = monthRange(y, m);
  const s = sumRange(state, from, to);
  const [pf, pt] = monthRange(y, m - 1);
  const prev = sumRange(state, pf, pt);
  const txs = state.txs.filter((t) => t.date >= from && t.date < to);
  const expenses = txs.filter((t) => t.type === "expense" && t.cat !== "Adjustment");

  const topCats = Object.entries(s.cats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amount]) => ({ cat, amount, pct: s.expense ? Math.round((amount / s.expense) * 100) : 0 }));

  let biggest: Tx | null = null;
  let biggestBase = 0;
  const perDay = new Map<number, number>();
  for (const t of expenses) {
    const v = toBase(state, t.amount, t.acc);
    if (v > biggestBase) {
      biggestBase = v;
      biggest = t;
    }
    const d = startOfDay(t.date);
    perDay.set(d, (perDay.get(d) ?? 0) + v);
  }
  const busiest = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];

  // Only count days that have already happened.
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lastDay = Math.min(to, startOfDay(now) + DAY);
  let elapsed = 0;
  let noSpend = 0;
  for (let d = from; d < lastDay; d += DAY) {
    elapsed++;
    if (!perDay.has(startOfDay(d))) noSpend++;
  }

  const counts = new Map<string, number>();
  for (const t of txs) counts.set(t.acc, (counts.get(t.acc) ?? 0) + 1);
  const topAcc = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  const savingsRate = s.income > 0 ? Math.round(((s.income - s.expense) / s.income) * 100) : null;
  const base = {
    entries: txs.length,
    savingsRate,
    topCats: topCats.filter((c) => c.amount > 0),
  };

  return {
    y,
    m,
    label: new Date(y, m, 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" }),
    entries: txs.length,
    income: s.income,
    expense: s.expense,
    saved: s.income - s.expense,
    savingsRate,
    vsPrev: prev.expense > 0 ? Math.round(((s.expense - prev.expense) / prev.expense) * 100) : null,
    topCats: base.topCats,
    biggest,
    biggestBase,
    busiestDay: busiest ? { date: busiest[0], amount: busiest[1] } : null,
    noSpendDays: Math.min(noSpend, elapsed),
    daysInMonth,
    topAccount: topAcc ? { id: topAcc[0], count: topAcc[1] } : null,
    loggedDays: new Set(txs.map((t) => startOfDay(t.date))).size,
    style: styleFor(base),
  };
}

/** The month whose recap Home should offer: last month, during the first 10 days, if it has entries. */
export function pendingRecap(state: State, now = Date.now()): { y: number; m: number; key: string } | null {
  const d = new Date(now);
  if (d.getDate() > 10) return null;
  const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const m = (d.getMonth() + 11) % 12;
  const key = `${y}-${m}`;
  if (state.settings.recapSeen === key) return null;
  const [from, to] = monthRange(y, m);
  const n = state.txs.filter((t) => t.date >= from && t.date < to).length;
  return n >= 3 ? { y, m, key } : null;
}
