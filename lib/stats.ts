import type { Account, Installment, PayFreq, Planned, Settings, State, Tx } from "./types";
import { dueDate, quote } from "./installments";
import { cardCycle, hasCycle } from "./cards";
import { convert, defaultFx } from "./currency";

/** Main currency used for totals. */
export const baseCurrency = (state: State) => state.settings?.currency || "PHP";
/** Currency of an account (defaults to the main currency). */
export const accCurrency = (state: State, accId?: string) => state.accounts.find((a) => a.id === accId)?.currency || baseCurrency(state);
/** Converts an amount in an account's currency to the main currency. */
export const toBase = (state: State, amount: number, accId?: string) => convert(amount, accCurrency(state, accId), baseCurrency(state), state.fx ?? defaultFx());

export const DAY = 86_400_000;

export const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Balance of an account in its own currency, up to (and including) `until`. Credit cards go negative as you spend. */
export function balance(state: State, a: Account, until = Infinity): number {
  let b = Number(a.opening) || 0;
  for (const t of state.txs) {
    if (t.date > until) continue;
    if (t.track) continue; // track-only entries don't move money in the account
    if (t.type === "income" && t.acc === a.id) b += t.amount;
    else if (t.type === "expense" && t.acc === a.id) b -= t.amount;
    else if (t.type === "transfer") {
      if (t.acc === a.id) b -= t.amount;
      if (t.to === a.id) b += t.toAmount ?? t.amount; // cross-currency transfers record what arrived
    }
  }
  return b;
}

/**
 * What an account's balance would be after taking `amount` out of it. Pass the entry being edited so its old
 * effect isn't counted twice.
 */
export function balanceAfterSpend(state: State, a: Account, amount: number, editing?: Tx): number {
  let b = balance(state, a);
  if (editing && !editing.track) {
    if (editing.acc === a.id) b += editing.type === "income" ? -editing.amount : editing.amount;
    if (editing.type === "transfer" && editing.to === a.id) b -= editing.toAmount ?? editing.amount;
  }
  return Math.round((b - amount) * 100) / 100;
}

/** The maintaining balance an account keeps aside, in the main currency (0 when none). */
export const keptBase = (state: State, a: Account) => (a.maintaining ? toBase(state, a.maintaining, a.id) : 0);

/** Balance of an account converted to the main currency. */
export const balanceBase = (state: State, a: Account, until = Infinity) => toBase(state, balance(state, a, until), a.id);

/** Accounts that count in totals (not archived, not hidden from net worth). */
export const countedAccounts = (state: State) => state.accounts.filter((a) => !a.archived && !a.excludeFromTotal);

/** Accounts to offer in pickers: everything not archived (plus any ids you need to keep, e.g. when editing). */
export const activeAccounts = (state: State, keep: (string | undefined)[] = []) =>
  // Locked savings can't be spent from, so they're left out of pickers too.
  state.accounts.filter((a) => keep.includes(a.id) || (!a.archived && a.kind !== "locked"));

/** Assets, liabilities and net worth in the main currency. */
/**
 * Net worth: your accounts (credit card balances count against you), plus money friends owe you, minus money you owe.
 * Goals aren't added: a goal's "saved" is a label on money already sitting in your accounts.
 * With `until`, it's as of that moment (debts that existed then, less payments made by then).
 */
export function netWorth(state: State, until = Infinity) {
  let assets = 0;
  let liabilities = 0;
  for (const a of countedAccounts(state)) {
    const b = balanceBase(state, a, until);
    if (b >= 0) assets += b;
    else liabilities += -b;
  }
  for (const d of state.debts ?? []) {
    if (d.created > until) continue;
    const paid = d.payments.filter((p) => p.date <= until).reduce((s, p) => s + p.amount, 0);
    const left = Math.max(0, d.amount - paid);
    if (d.direction === "owed") assets += left;
    else liabilities += left;
  }
  return { assets, liabilities, net: assets - liabilities };
}

export interface Sums {
  income: number;
  expense: number;
  count: number;
  cats: Record<string, number>;
}

/** Income and spending between two times, in the main currency. */
export function sumRange(state: State, from: number, to: number): Sums {
  const r: Sums = { income: 0, expense: 0, count: 0, cats: {} };
  for (const t of state.txs) {
    if (t.date < from || t.date >= to) continue;
    r.count++;
    // Transfers, debt movements (lending, borrowing, paying back) and balance adjustments aren't income or spending.
    if (t.type === "transfer" || t.cat === "Debt" || t.cat === "Adjustment") continue;
    const amt = toBase(state, t.amount, t.acc);
    if (t.type === "income") r.income += amt;
    else {
      r.expense += amt;
      r.cats[t.cat] = (r.cats[t.cat] || 0) + amt;
    }
  }
  return r;
}

export function monthRange(y: number, m: number): [number, number] {
  return [new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()];
}

export type Period = "day" | "week" | "month";

export function periodRange(p: Period, now = Date.now()): [number, number] {
  const d0 = startOfDay(now);
  if (p === "day") return [d0, d0 + DAY];
  if (p === "week") {
    const dow = (new Date(d0).getDay() + 6) % 7; // Monday first
    return [d0 - dow * DAY, d0 + (7 - dow) * DAY];
  }
  const d = new Date(now);
  return monthRange(d.getFullYear(), d.getMonth());
}

/** Spending per day for the last `n` days, oldest first. */
export function lastDays(state: State, n: number, now = Date.now()) {
  const today = startOfDay(now);
  return Array.from({ length: n }, (_, i) => {
    const from = today - (n - 1 - i) * DAY;
    const s = sumRange(state, from, from + DAY);
    return { from, expense: s.expense, income: s.income };
  });
}

/** Net worth at the end of each of the last `n` days, oldest first. */
export function netWorthSeries(state: State, n: number, now = Date.now()) {
  const today = startOfDay(now);
  return Array.from({ length: n }, (_, i) => {
    const end = today - (n - 1 - i) * DAY + DAY - 1;
    return { at: end, value: netWorth(state, end).net };
  });
}

/** Consecutive days (ending today, or yesterday if nothing logged yet today) with at least one entry. */
export function streak(txs: Tx[], now = Date.now()) {
  // Entries Kwenta adds itself (like interest) aren't the user logging something.
  const days = new Set(txs.filter((t) => !t.auto).map((t) => startOfDay(t.date)));
  let cur = startOfDay(now);
  const loggedToday = days.has(cur);
  if (!loggedToday) cur -= DAY;
  let count = 0;
  while (days.has(cur)) {
    count++;
    cur -= DAY;
  }
  // Longest run ever
  const sorted = [...days].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = -Infinity;
  for (const d of sorted) {
    run = Math.round((d - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { count, loggedToday, best, totalDays: days.size };
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

function clampDay(y: number, m: number, day: number) {
  return new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
}

export interface UpcomingItem {
  item: Planned;
  due: Date;
  key: string;
  daysLeft: number;
}

/** Next unpaid occurrence of each planned item (this month if not done yet, otherwise next month). */
export function upcoming(state: State, now = Date.now()): UpcomingItem[] {
  const today = new Date(startOfDay(now));
  const out: UpcomingItem[] = [];
  for (const p of state.planned) {
    let y = today.getFullYear();
    let m = today.getMonth();
    let due = clampDay(y, m, p.day);
    if (p.done.includes(monthKey(due))) {
      m += 1;
      if (m > 11) {
        m = 0;
        y++;
      }
      due = clampDay(y, m, p.day);
    }
    out.push({ item: p, due, key: monthKey(due), daysLeft: Math.round((due.getTime() - today.getTime()) / DAY) });
  }
  return out.sort((a, b) => a.due.getTime() - b.due.getTime());
}

export interface InstallmentDue {
  plan: Installment;
  due: Date;
  /** 1-based payment number. */
  n: number;
  monthly: number;
  daysLeft: number;
}

/** The next unposted bill of every active installment plan, soonest first. */
export function installmentDues(state: State, now = Date.now()): InstallmentDue[] {
  const today = startOfDay(now);
  return (state.installments ?? [])
    .filter((p) => p.paid < p.months)
    .map((p) => {
      const due = dueDate(p.start, p.paid);
      return { plan: p, due, n: p.paid + 1, monthly: quote(p.principal, p.rate, p.months).monthly, daysLeft: Math.round((startOfDay(due.getTime()) - today) / DAY) };
    })
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

/** Total monthly installment payments on one card. */
export function monthlyInstallments(state: State, accId: string) {
  const active = (state.installments ?? []).filter((p) => p.acc === accId && p.paid < p.months);
  return { count: active.length, monthly: active.reduce((s, p) => s + quote(p.principal, p.rate, p.months).monthly, 0) };
}

/** The next payday on or after today. */
export const payFreqOf = (s: Pick<Settings, "payFreq" | "payday">): PayFreq => s.payFreq ?? ((s.payday?.length ?? 0) >= 2 ? "semimonthly" : "monthly");

/** The next payday on or after today, for monthly, twice-a-month, weekly or every-2-weeks pay. */
export function nextPayday(s: Pick<Settings, "payFreq" | "payday" | "payWeekday" | "payAnchor">, now = Date.now()) {
  const today = new Date(startOfDay(now));
  const freq = payFreqOf(s);
  if (freq === "weekly" || freq === "biweekly") {
    const wd = s.payWeekday ?? 5;
    const d = new Date(today);
    d.setDate(d.getDate() + ((wd - d.getDay() + 7) % 7));
    if (freq === "biweekly" && s.payAnchor) {
      // Paydays are an even number of weeks from the known payday.
      const weeks = Math.round((d.getTime() - startOfDay(s.payAnchor)) / (7 * DAY));
      if (((weeks % 2) + 2) % 2 === 1) d.setDate(d.getDate() + 7);
    }
    return { date: d, daysLeft: Math.round((d.getTime() - today.getTime()) / DAY) };
  }
  const paydays = freq === "monthly" ? [s.payday?.[0] ?? 30] : (s.payday ?? [15, 30]).slice(0, 2);
  const cands: Date[] = [];
  for (let k = 0; k < 2; k++) {
    const y = today.getFullYear();
    const m = today.getMonth() + k;
    for (const d of paydays) cands.push(clampDay(y + Math.floor(m / 12), m % 12, d));
  }
  const next = cands.filter((d) => d >= today).sort((a, b) => a.getTime() - b.getTime())[0] ?? today;
  return { date: next, daysLeft: Math.round((next.getTime() - today.getTime()) / DAY) };
}

/** Money you can expect to have on payday after the bills due before then. */
/**
 * How this month compares with last month, in a form the screen can word safely:
 * no baseline or a tiny one gives no percentage, and huge percentages are capped.
 * "up" is good for income and bad for spending.
 */
export type MonthChange =
  | { kind: "first" }
  | { kind: "diff"; diff: number; tone: "good" | "bad" | "flat" }
  | { kind: "pct"; pct: number; capped: boolean; tone: "good" | "bad" | "flat" };
export const CHANGE_MIN_BASE = 1000;
export const CHANGE_CAP = 500;
export function monthChange(cur: number, old: number, kind: "expense" | "income"): MonthChange {
  if (!(old > 0)) return { kind: "first" };
  const diff = Math.round(cur - old);
  const tone = diff === 0 ? "flat" : (diff > 0) === (kind === "income") ? "good" : "bad";
  if (old < CHANGE_MIN_BASE) return { kind: "diff", diff, tone };
  const pct = Math.round((diff / old) * 100);
  return { kind: "pct", pct: Math.max(-CHANGE_CAP, Math.min(CHANGE_CAP, pct)), capped: Math.abs(pct) > CHANGE_CAP, tone };
}

export function forecast(state: State, now = Date.now()) {
  const pay = nextPayday(state.settings, now);
  // Spendable money only: no credit cards, no locked savings.
  // Maintaining balances (money a bank wants left in an account) are kept aside, so they aren't counted as spendable.
  const liquid = countedAccounts(state).filter((a) => a.kind !== "credit" && a.kind !== "locked").reduce((s, a) => s + balanceBase(state, a) - keptBase(state, a), 0);
  const due = upcoming(state, now).filter((u) => u.due <= pay.date);
  // Bills and installments are in their account's currency; convert to the main currency.
  // A monthly installment whose bill date is on or before the card's last cut-off is already in that statement's
  // balance (see cardCycle), so it must not be counted again here while it waits to be marked "Posted".
  const inStatement = (d: ReturnType<typeof installmentDues>[number]) => {
    const card = state.accounts.find((a) => a.id === d.plan.acc);
    if (!card || !hasCycle(card) || !d.plan.txIds?.principal) return false;
    const c = cardCycle(state, card, now);
    return !!c && d.due.getTime() <= startOfDay(c.statementDate) + DAY - 1;
  };
  const instDue = installmentDues(state, now).filter((d) => d.due <= pay.date && !inStatement(d)).reduce((s, d) => s + toBase(state, d.monthly, d.plan.acc), 0);
  const bills = due.filter((u) => u.item.type === "expense").reduce((s, u) => s + toBase(state, u.item.amount, u.item.acc), 0) + instDue;
  const incoming = due.filter((u) => u.item.type === "income").reduce((s, u) => s + toBase(state, u.item.amount, u.item.acc), 0);
  // Credit card payments (what's left on the statement) that fall due before payday, including overdue ones.
  const cards = state.accounts
    .filter((a) => !a.archived && hasCycle(a))
    .reduce((sum, a) => {
      const c = cardCycle(state, a, now);
      return c && c.left > 0 && startOfDay(c.dueDate) <= startOfDay(pay.date.getTime()) ? sum + toBase(state, c.left, a.id) : sum;
    }, 0);
  const [mFrom] = periodRange("month", now);
  const daysIn = Math.max(1, Math.round((startOfDay(now) - mFrom) / DAY) + 1);
  const avgDaily = sumRange(state, mFrom, now + 1).expense / daysIn;
  // Money for the days before payday: expected income isn't counted, because the next paycheck is what ends this stretch.
  const available = liquid - bills - cards;
  const projected = available - avgDaily * pay.daysLeft;
  const safeDaily = Math.floor(pay.daysLeft ? Math.max(0, available / pay.daysLeft) : Math.max(0, available));
  return { pay, liquid, bills, cards, incoming, available, over: Math.max(0, Math.round(-available)), avgDaily: Math.round(avgDaily), projected: Math.round(projected), safeDaily };
}
