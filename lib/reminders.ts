/**
 * Reminders without a server.
 *  - In the app: dueSoon() feeds the "Due soon" banner on Home.
 *  - In the background (Android Chrome, installed app): the service worker wakes up about once a
 *    day via Periodic Background Sync, reads a small reminder list the app saved to Cache Storage,
 *    and shows notifications. Only titles and dates are saved there, never amounts; titles can be
 *    hidden too.
 */
import type { State } from "./types";
import { DAY, accCurrency, installmentDues, startOfDay, upcoming } from "./stats";
import { debtLeft } from "./debts";
import { activeDeposits, depositMath, depositStatus } from "./deposits";
import { cardCycle, cardsDue, hasCycle } from "./cards";

export interface DueItem {
  id: string;
  title: string;
  kind: "bill" | "income" | "installment" | "debt" | "deposit" | "card" | "statement";
  due: Date;
  daysLeft: number;
  amount: number;
  currency: string;
  /** Month key for bills (to mark paid), or installment id. */
  ref: string;
  /** Credit cards: the minimum payment, when it is less than what's left. */
  min?: number;
  /** Day (start of day) the background notification may begin; before that it only shows in the app. */
  from: number;
}

/** How many days ahead to warn about a credit card payment, unless the user changed it. */
export const DEFAULT_CARD_LEAD = 3;
export const CARD_LEADS = [1, 2, 3, 5, 7];
export const cardLead = (state: State) => state.settings.reminders?.cardLead ?? DEFAULT_CARD_LEAD;
/** A statement shows as ready on its cut-off day and for this many days after, until you confirm the bank's figure. */
export const STATEMENT_GRACE = 3;

export const statementText = (daysAgo: number) => (daysAgo <= 0 ? "Statement ready today" : daysAgo === 1 ? "Statement ready yesterday" : `Statement ready ${daysAgo} days ago`);

/** Bills, expected income and installments that are overdue or due within `days`. */
export function dueSoon(state: State, now = Date.now(), days = 2): DueItem[] {
  const out: DueItem[] = [];
  for (const u of upcoming(state, now)) {
    if (u.daysLeft > days) continue;
    out.push({
      id: `p-${u.item.id}`,
      title: u.item.name,
      kind: u.item.type === "income" ? "income" : "bill",
      due: u.due,
      daysLeft: u.daysLeft,
      amount: u.item.amount,
      currency: accCurrency(state, u.item.acc),
      ref: u.key,
      from: startOfDay(u.due.getTime()) - DAY,
    });
  }
  for (const d of installmentDues(state, now)) {
    if (d.daysLeft > days) continue;
    out.push({
      id: `i-${d.plan.id}`,
      title: `${d.plan.name} (${d.n}/${d.plan.months})`,
      kind: "installment",
      due: d.due,
      daysLeft: d.daysLeft,
      amount: d.monthly,
      currency: accCurrency(state, d.plan.acc),
      ref: d.plan.id,
      from: startOfDay(d.due.getTime()) - DAY,
    });
  }
  const today = startOfDay(now);
  for (const d of state.debts ?? []) {
    if (!d.due || debtLeft(d) <= 0) continue;
    const daysLeft = Math.round((startOfDay(d.due) - today) / DAY);
    if (daysLeft > days) continue;
    out.push({
      id: `d-${d.id}`,
      title: d.direction === "owe" ? `You owe ${d.person}` : `${d.person} owes you`,
      kind: "debt",
      due: new Date(d.due),
      daysLeft,
      amount: debtLeft(d),
      currency: state.settings.currency || "PHP",
      ref: d.id,
      from: startOfDay(d.due) - DAY,
    });
  }
  const lead = cardLead(state);
  for (const { a, c } of cardsDue(state, now, Math.max(days, lead))) {
    out.push({
      id: `c-${a.id}`,
      title: `${a.name} payment`,
      kind: "card",
      due: new Date(c.dueDate),
      daysLeft: c.daysLeft,
      amount: c.left,
      currency: accCurrency(state, a.id),
      ref: a.id,
      min: c.minDue > 0 && c.minDue < c.left ? c.minDue : undefined,
      from: startOfDay(c.dueDate) - lead * DAY,
    });
  }
  // A new statement: ask for the bank's figure so the amount to pay is exact, not an estimate.
  for (const a of state.accounts) {
    if (a.archived || !hasCycle(a)) continue;
    const c = cardCycle(state, a, now);
    if (!c || c.statementBalance <= 0 || a.stmtFix?.key === c.key) continue;
    const ago = Math.round((today - startOfDay(c.statementDate)) / DAY);
    if (ago < 0 || ago > STATEMENT_GRACE) continue;
    out.push({
      id: `s-${a.id}`,
      title: `${a.name} statement`,
      kind: "statement",
      due: new Date(c.statementDate),
      daysLeft: -ago,
      amount: c.statementBalance,
      currency: accCurrency(state, a.id),
      ref: a.id,
      from: startOfDay(c.statementDate),
    });
  }
  for (const a of activeDeposits(state)) {
    const st = depositStatus(a, now);
    if (!st || st.daysLeft > days) continue;
    const d = a.deposit!;
    out.push({
      id: `t-${a.id}`,
      title: st.matured ? `${a.name} is ready to collect` : `${a.name} matures`,
      kind: "deposit",
      due: new Date(st.maturity),
      daysLeft: st.daysLeft,
      amount: depositMath(d.principal, d.rate, d.months, d.tax).atMaturity,
      currency: state.settings.currency || "PHP",
      ref: a.id,
      from: startOfDay(st.maturity) - DAY,
    });
  }
  // Snoozed items stay hidden (in the app and in notifications) until their return day.
  const snoozed = state.settings.snoozed ?? {};
  return out.filter((d) => !((snoozed[d.id] ?? 0) > today)).sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface SnoozeChoice {
  label: string;
  /** Start of the day the item comes back. */
  until: number;
}

/** Sensible snooze choices for an item: a day, a few days, and (when it's far enough off) until the day it's due. */
export function snoozeChoices(d: DueItem, now = Date.now()): SnoozeChoice[] {
  const today = startOfDay(now);
  const out: SnoozeChoice[] = [
    { label: "Tomorrow", until: today + DAY },
    { label: "3 days", until: today + 3 * DAY },
  ];
  const dueDay = startOfDay(d.due.getTime());
  if (d.kind !== "statement") {
    if (dueDay > today + 3 * DAY) out.push({ label: "Until due", until: dueDay });
    else if (dueDay <= today) out.push({ label: "Next week", until: today + 7 * DAY });
  }
  return out;
}

/** The snooze list with one more item hidden until `until`, dropping entries that have already expired. */
export function withSnooze(prev: Record<string, number> | undefined, id: string, until: number, now = Date.now()): Record<string, number> {
  const today = startOfDay(now);
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(prev ?? {})) if (v > today) next[k] = v;
  next[id] = until;
  return next;
}

export const whenText = (daysLeft: number) =>
  daysLeft < 0 ? `${-daysLeft} day${daysLeft === -1 ? "" : "s"} overdue` : daysLeft === 0 ? "Due today" : daysLeft === 1 ? "Due tomorrow" : `Due in ${daysLeft} days`;

// ---------- Background reminders (service worker) ----------

const DATA_CACHE = "kwenta-data";
const DATA_URL = "/__kwenta-reminders.json";
export const SYNC_TAG = "kwenta-reminders";

export interface ReminderPayload {
  updated: number;
  /** Titles only if allowed; amounts are never saved here. */
  items: { title: string; due: number; kind: DueItem["kind"]; /** First day a notification may be shown. */ from: number; /** Snoozed: don't notify before this day. */ hideUntil?: number }[];
  lastLog: number;
  logNudge: boolean;
}

/** Everything due soon, ignoring snoozes (they're applied per day, so a snoozed item can come back while the app is closed). */
const unsnoozed = (state: State): State => ({ ...state, settings: { ...state.settings, snoozed: undefined } });

/** The reminder list the service worker reads (next 7 days, plus anything overdue). */
export function reminderPayload(state: State, now = Date.now()): ReminderPayload {
  const r = state.settings.reminders;
  const names = r?.names ?? true;
  const snoozed = state.settings.snoozed ?? {};
  const today = startOfDay(now);
  return {
    updated: now,
    items: dueSoon(unsnoozed(state), now, 7).map((d, i) => ({
      title: names ? d.title : d.kind === "income" ? "Expected income" : d.kind === "installment" ? `An installment` : d.kind === "debt" ? "A debt" : d.kind === "deposit" ? "A time deposit" : d.kind === "card" ? "A credit card payment" : d.kind === "statement" ? "A card statement" : `A bill${i ? ` (${i + 1})` : ""}`,
      due: startOfDay(d.due.getTime()),
      kind: d.kind,
      from: d.from,
      hideUntil: (snoozed[d.id] ?? 0) > today ? snoozed[d.id] : undefined,
    })),
    lastLog: state.txs.reduce((m, t) => Math.max(m, t.date), 0),
    logNudge: r?.logNudge ?? true,
  };
}

/** The hour of day (local time) a push reminder wakes the phone. */
export const WAKE_HOUR = 9;
/** How many days ahead wake times are scheduled; the app refreshes them whenever it opens or something changes. */
export const WAKE_DAYS = 7;

/**
 * When a push should wake this phone, as timestamps: each coming day at 9:00 local time that has something to
 * remind about (a bill from its start day, anything overdue, a new statement during its first days). Snoozes
 * are applied per day. Only times leave the device, never what is due.
 */
export function wakeTimes(state: State, now = Date.now()): number[] {
  const items = dueSoon(unsnoozed(state), now, 7);
  const snoozed = state.settings.snoozed ?? {};
  const out: number[] = [];
  for (let i = 0; i < WAKE_DAYS; i++) {
    const d = new Date(now);
    const fire = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, WAKE_HOUR, 0, 0, 0).getTime();
    if (fire <= now + 60_000) continue;
    const day = startOfDay(fire);
    const ready = items.some(
      (it) =>
        it.from <= day &&
        (snoozed[it.id] ?? 0) <= day &&
        (it.kind !== "statement" || day <= startOfDay(it.due.getTime()) + STATEMENT_GRACE * DAY),
    );
    if (ready) out.push(fire);
  }
  return out;
}

export async function saveReminderData(payload: ReminderPayload | null) {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(DATA_CACHE);
  if (!payload) await cache.delete(DATA_URL);
  else await cache.put(DATA_URL, new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }));
}

export type ReminderSupport = "full" | "notify-only" | "none";

/** What this browser can do: background daily checks, notifications only while open, or nothing. */
export async function reminderSupport(): Promise<ReminderSupport> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return "none";
  const reg = await navigator.serviceWorker.getRegistration();
  return reg && "periodicSync" in reg ? "full" : "notify-only";
}

/** Asks for notification permission and registers the daily background check. */
export async function enableReminders(): Promise<{ ok: boolean; background: boolean; message: string }> {
  if (!("Notification" in window)) return { ok: false, background: false, message: "This browser can’t show notifications." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, background: false, message: "Notifications are blocked. Allow them for Kwenta in your phone’s settings." };
  const reg = await navigator.serviceWorker?.ready;
  if (!reg || !("periodicSync" in reg)) {
    return { ok: true, background: false, message: "Notifications allowed, but this browser can’t check in the background. You’ll still see Due soon on Home." };
  }
  try {
    const status = await navigator.permissions.query({ name: "periodic-background-sync" as PermissionName });
    if (status.state === "denied") return { ok: true, background: false, message: "Background checks aren’t allowed here. Install Kwenta to your home screen and try again." };
    await (reg as ServiceWorkerRegistration & { periodicSync: { register: (t: string, o: { minInterval: number }) => Promise<void> } }).periodicSync.register(SYNC_TAG, { minInterval: 12 * 60 * 60 * 1000 });
    return { ok: true, background: true, message: "Daily reminders are on. Chrome checks about once a day." };
  } catch {
    return { ok: true, background: false, message: "Couldn’t start background checks. Make sure Kwenta is installed to your home screen." };
  }
}

export async function disableReminders() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg && "periodicSync" in reg) {
    await (reg as ServiceWorkerRegistration & { periodicSync: { unregister: (t: string) => Promise<void> } }).periodicSync.unregister(SYNC_TAG).catch(() => undefined);
  }
  await saveReminderData(null);
}

/** Shows a notification right away, to check that reminders can reach you. */
export async function testNotification(body: string) {
  const reg = await navigator.serviceWorker?.getRegistration();
  const opts = { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "kwenta-test" };
  if (reg) await reg.showNotification("Kwenta reminder", opts);
  else new Notification("Kwenta reminder", opts);
}

/**
 * What to say about what's due on `today` (a start-of-day timestamp), or null when nothing is. The same wording the
 * service worker builds in public/sw.js (dueNotification), so Chrome and the Android app read alike.
 * Snoozed items wait for their return day.
 */
export function dueNotification(data: Pick<ReminderPayload, "items">, today: number): { title: string; body: string } | null {
  // An item may notify from its own start day (cards can start earlier).
  const ready = data.items.filter((i) => (i.from ?? i.due - DAY) <= today && (i.hideUntil ?? 0) <= today);
  const stmts = ready.filter((i) => i.kind === "statement");
  const due = ready.filter((i) => i.kind !== "statement");
  if (!due.length && !stmts.length) return null;
  const overdue = due.filter((i) => i.due < today);
  const lines = [
    ...stmts.map((i) => `• ${i.title}: ready, check the balance`),
    ...due.map((i) => {
      const d = Math.round((i.due - today) / DAY);
      return `• ${i.title}: ${d < 0 ? "overdue" : d === 0 ? "due today" : d === 1 ? "due tomorrow" : `due in ${d} days`}`;
    }),
  ];
  return {
    title: overdue.length ? "Kwenta: payment overdue ⚠️" : due.length ? "Kwenta: payment due soon" : "Kwenta: statement ready",
    body: lines.slice(0, 4).join("\n") + (lines.length > 4 ? `\n+${lines.length - 4} more` : ""),
  };
}

export const NUDGE_NOTICE = { title: "Alki misses you 🪙", body: "Nothing logged today yet. Takes 5 seconds: tell me what you spent!" };

export const ONE_DAY = DAY;
