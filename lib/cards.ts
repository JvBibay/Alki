/**
 * Credit card billing cycles: statement (cut-off) day, payment due day, statement balance,
 * minimum due, and whether this cycle has been paid.
 *
 * Statement balance = what you owed on the card at the end of the statement day. Purchases
 * on installment are logged in full on the card, so the part not yet billed is subtracted.
 */
import type { Account, State } from "./types";
import { DAY, balance, startOfDay, toBase } from "./stats";
import { dueDate as instDue, quote } from "./installments";

export const DEFAULT_MIN_PCT = 3;
export const DEFAULT_MIN_FLOOR = 500;

const clampDay = (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()), 12);

export type CardStatus = "none" | "due" | "min" | "paid" | "overdue";

export interface CardCycle {
  statementDate: number;
  dueDate: number;
  daysLeft: number;
  statementBalance: number;
  minDue: number;
  paidSince: number;
  /** Still to pay to clear the statement (0 when paid). */
  left: number;
  status: CardStatus;
  /** "2026-10" style key of the statement month (for "mark as paid"). */
  key: string;
  nextStatement: number;
}

/** True when the card has both a statement day and a due day set. */
export const hasCycle = (a: Account) => a.kind === "credit" && !!a.statementDay && !!a.dueDay;

export function cardCycle(state: State, a: Account, now = Date.now()): CardCycle | null {
  if (!hasCycle(a)) return null;
  const S = a.statementDay!;
  const D = a.dueDay!;
  const today = new Date(startOfDay(now));
  // Most recent statement date on or before today.
  let st = clampDay(today.getFullYear(), today.getMonth(), S);
  if (startOfDay(st.getTime()) > today.getTime()) st = clampDay(today.getFullYear(), today.getMonth() - 1, S);
  // Its due date: the next "due day" after the statement date.
  let due = clampDay(st.getFullYear(), st.getMonth(), D);
  if (due.getTime() <= st.getTime()) due = clampDay(st.getFullYear(), st.getMonth() + 1, D);
  const nextSt = clampDay(st.getFullYear(), st.getMonth() + 1, S);

  const stEnd = startOfDay(st.getTime()) + DAY - 1;
  let owed = -balance(state, a, stEnd);
  // The amount owed at start isn't on a statement until the first cut-off after it was entered.
  if (a.openingAt && a.openingAt > stEnd) owed += a.opening;
  // Installment purchases are logged in full; only the billed part belongs on the statement.
  for (const p of state.installments ?? []) {
    if (p.acc !== a.id || !p.txIds?.principal) continue;
    const logged = state.txs.find((t) => t.id === p.txIds!.principal);
    if (!logged || logged.date > stEnd) continue;
    let billed = 0;
    for (let i = 0; i < p.months; i++) if (instDue(p.start, i).getTime() <= stEnd) billed++;
    owed -= Math.max(0, p.principal - quote(p.principal, p.rate, p.months).principalPart * billed);
  }
  const key = `${st.getFullYear()}-${st.getMonth() + 1}`;
  // The user can type the bank's figure for this statement.
  const statementBalance = a.stmtFix?.key === key ? Math.max(0, a.stmtFix.amount) : Math.max(0, Math.round(owed * 100) / 100);

  // Payments into the card since the statement closed.
  let paidSince = 0;
  for (const t of state.txs) {
    if (t.date <= stEnd || t.track) continue;
    if (t.type === "transfer" && t.to === a.id) paidSince += t.toAmount ?? t.amount;
    else if (t.type === "income" && t.acc === a.id) paidSince += t.amount; // refunds / cashback
  }
  paidSince = Math.round(paidSince * 100) / 100;

  const pct = a.minPct ?? DEFAULT_MIN_PCT;
  const floor = a.minFloor ?? DEFAULT_MIN_FLOOR;
  const minDue = statementBalance <= 0 ? 0 : Math.round(Math.min(statementBalance, Math.max(floor, (statementBalance * pct) / 100)) * 100) / 100;
  const markedPaid = (a.paidCycles ?? []).includes(key);
  const left = markedPaid ? 0 : Math.max(0, Math.round((statementBalance - paidSince) * 100) / 100);
  const daysLeft = Math.round((startOfDay(due.getTime()) - today.getTime()) / DAY);

  let status: CardStatus;
  if (statementBalance <= 0) status = "none";
  else if (markedPaid || paidSince >= statementBalance - 0.005) status = "paid";
  else if (paidSince >= minDue - 0.005) status = "min";
  else if (daysLeft < 0) status = "overdue";
  else status = "due";

  return { statementDate: st.getTime(), dueDate: due.getTime(), daysLeft, statementBalance, minDue, paidSince, left, status, key, nextStatement: nextSt.getTime() };
}

/** 1 → "1st", 22 → "22nd", 4 → "4th". */
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;

/** Short label for the card row: "Due in 3 days", "Paid ✅", "Overdue"… */
export function cycleLabel(c: CardCycle | null, dueDay?: number): string {
  if (!c) return dueDay ? `Due every ${ordinal(dueDay)}` : "";
  switch (c.status) {
    case "none":
      return "No payment due";
    case "paid":
      return "Paid ✅";
    case "min":
      return "Minimum paid";
    case "overdue":
      return `Overdue ${-c.daysLeft} day${c.daysLeft === -1 ? "" : "s"} ⚠️`;
    default:
      return c.daysLeft === 0 ? "Due today" : c.daysLeft === 1 ? "Due tomorrow" : c.daysLeft <= 7 ? `Due in ${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"}` : `Due ${new Date(c.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`;
  }
}

/** Cards with a payment due within `days` (or overdue) that isn't paid yet. */
export function cardsDue(state: State, now = Date.now(), days = 2) {
  return state.accounts
    .filter((a) => !a.archived && hasCycle(a))
    .map((a) => ({ a, c: cardCycle(state, a, now)! }))
    .filter(({ c }) => (c.status === "due" || c.status === "overdue") && c.daysLeft <= days);
}

// ---------- Credit limits (own or shared) ----------

/** The card that holds the limit for `a`: itself, or the card it shares a limit with. */
export function limitHolder(state: State, a: Account): Account {
  let cur = a;
  for (let i = 0; i < 5 && cur.limitShare; i++) {
    const next = state.accounts.find((x) => x.id === cur.limitShare && x.kind === "credit" && !x.archived);
    if (!next || next.id === a.id) break;
    cur = next;
  }
  return cur;
}

export interface CreditInfo {
  /** The limit (in the holder card's currency), or 0 if none is set. */
  limit: number;
  /** Used by this card and every card sharing its limit (in the holder's currency). */
  used: number;
  available: number;
  /** Other cards sharing the same limit. */
  shared: Account[];
  holder: Account;
}

/** Credit limit, total used and what's available, counting every card on a shared limit. */
export function creditInfo(state: State, a: Account): CreditInfo {
  const holder = limitHolder(state, a);
  const group = state.accounts.filter((x) => x.kind === "credit" && !x.archived && limitHolder(state, x).id === holder.id);
  if (!group.some((x) => x.id === a.id)) group.push(a);
  const rate = toBase(state, 1, holder.id) || 1;
  const used = group.reduce((s, x) => s + toBase(state, Math.max(0, -balance(state, x)), x.id), 0) / rate;
  const limit = holder.limit ?? 0;
  const r = (n: number) => Math.round(n * 100) / 100;
  return { limit, used: r(used), available: r(limit - used), shared: group.filter((x) => x.id !== a.id), holder };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What a card payment screen needs: everything the card owes right now, what's left of the statement, the minimum
 * still due, and a sensible starting amount. The statement can be ₱0 while new charges are already on the card
 * (they show up on the next statement), so the suggestion falls back to everything owed.
 */
export function payOptions(state: State, a: Account) {
  const cycle = cardCycle(state, a);
  const used = Math.max(0, r2(-balance(state, a)));
  const left = cycle?.left ?? 0;
  const minLeft = cycle ? Math.max(0, r2(cycle.minDue - cycle.paidSince)) : 0;
  return { cycle, used, left, minLeft, suggested: left > 0 ? left : used };
}
