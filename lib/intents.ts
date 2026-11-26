import type { ParsedTx, State } from "./types";
import { findDate, guessCategory, parseEntry } from "./parser";
import { upcoming, type UpcomingItem } from "./stats";
import { debtLeft, equalShares } from "./debts";
import { personKey } from "./people";

/**
 * Chat messages that mean more than "log an expense": paying a bill, splitting with friends,
 * paying someone back (or being paid back), and several entries in one message.
 * Everything here is pure: the chat decides what to do with the result.
 */
export type Intent =
  | { kind: "bill"; item: UpcomingItem; amount: number; acc: string; date: number }
  | { kind: "split"; title: string; total: number; myShare: number; cat: string; acc: string; people: { name: string; share: number }[] }
  | { kind: "settle"; person: string; direction: "owe" | "owed"; acc: string; pays: { debtId: string; amount: number }[]; leftover: number }
  | { kind: "multi"; txs: ParsedTx[]; hints: (string | undefined)[] }
  | { kind: "say"; text: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NUM_G = /(\d[\d,]*(?:\.\d+)?)(k\b)?/gi;
const DATE_G = /\b(?:(?:last|on|noong)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|\d+\s+days?\s+ago|yesterday|kahapon|today|kanina|ngayon)\b/gi;
const SPLIT_RE = /\b(hati|hatiin|split|sinplit)\b/;
const STOP_NAMES = new Set(["kami", "tayo", "namin", "natin", "me", "ako", "akin", "kayo", "sila"]);

export function amountOf(low: string): number | null {
  const m = low.match(/(\d[\d,]*(?:\.\d+)?)(k\b)?/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1);
  return n > 0 ? n : null;
}

const activeAccounts = (state: State) => state.accounts.filter((a) => !a.archived);

/** The account the message names, if any ("... gcash"). */
export function namedAccount(state: State, low: string): string | undefined {
  return activeAccounts(state)
    .map((a) => ({ id: a.id, idx: low.indexOf(a.name.toLowerCase()) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx)[0]?.id;
}

/**
 * The account you usually use for this: the last one used with the same payee, else for the same category.
 * Used when a message doesn't name an account, so Kwenta needn't ask every time.
 */
export function usualAccount(state: State, type: "expense" | "income", cat: string, note: string): { acc: string; why: string } | null {
  const ids = new Set(activeAccounts(state).map((a) => a.id));
  const recent = state.txs.filter((t) => t.type === type && !t.auto && !t.track && ids.has(t.acc)).sort((a, b) => b.date - a.date);
  const n = note.trim().toLowerCase();
  const byNote = n ? recent.find((t) => t.note.trim().toLowerCase() === n) : undefined;
  if (byNote) return { acc: byNote.acc, why: `your usual for ${note.trim()}` };
  const byCat = cat !== "Other" ? recent.find((t) => t.cat === cat) : undefined;
  if (byCat) return { acc: byCat.acc, why: `your usual for ${cat}` };
  return null;
}

const nameWords = (name: string) =>
  name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

const titleCase = (s: string) => s.replace(/\b([a-z])/gi, (c) => c.toUpperCase());

/** Cleans leftover words out of a fragment (numbers, dates, account names, filler). */
function stripped(text: string, state: State) {
  let t = text.replace(NUM_G, " ").replace(DATE_G, " ");
  for (const a of activeAccounts(state)) t = t.replace(new RegExp(`\\b${escapeRe(a.name)}\\b`, "gi"), " ");
  return t
    .replace(/\b(spent|spend|paid|pay|bayad|binayad|bought|for|on|from|my|account|using|via|the|sa|ng|ko|kami|tayo|namin|natin|split|hati|hatiin|sinplit|with|ni|nina|kay)\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Paying a bill ----------

function billIntent(state: State, text: string, low: string, now: number): Intent | null {
  const amount = amountOf(low);
  if (!amount) return null;
  let best: UpcomingItem | undefined;
  let bestScore = 0;
  for (const u of upcoming(state, now)) {
    // Only the bill that's actually coming up; a bill already paid this month isn't paid again from chat.
    if (u.daysLeft > 15) continue;
    const words = nameWords(u.item.name);
    let hits = words.filter((w) => new RegExp(`\\b${escapeRe(w)}\\b`).test(low)).length;
    if (!hits && u.item.type === "income" && /\b(salary|sweldo|sahod|payroll)\b/.test(u.item.name.toLowerCase()) && /\b(salary|sweldo|sahod|payroll)\b/.test(low)) hits = 1;
    if (!hits) continue;
    const score = hits / Math.max(1, words.length) + hits / 100;
    if (score > bestScore) {
      best = u;
      bestScore = score;
    }
  }
  if (!best) return null;
  const acc = namedAccount(state, low) ?? (activeAccounts(state).some((a) => a.id === best!.item.acc) ? best.item.acc : state.defAcc);
  return { kind: "bill", item: best, amount, acc, date: findDate(low, now) };
}

// ---------- Splitting ----------

function splitIntent(state: State, text: string, low: string, now: number): Intent | null {
  if (!SPLIT_RE.test(low)) return null;
  const total = amountOf(low);
  if (!total) return { kind: "say", text: "How much was it? Try “hati kami ni Migs 1200”." };
  const m = text.match(/\b(?:ni|nina|kay|with|w\/)\s+(.+)$/i);
  if (!m || m.index === undefined) return { kind: "say", text: "Who are you splitting with? Try “hati kami ni Migs 1200” or “split 1200 with Migs and Ana”." };
  const people: string[] = [];
  const known = [...(state.people ?? []).map((p) => p.name), ...(state.debts ?? []).map((d) => d.person)];
  for (const raw of stripped(m[1], state).split(/\s*(?:,|&|\band\b|\bat\b)\s*/i)) {
    const words = raw.trim();
    if (!words || STOP_NAMES.has(words.toLowerCase())) continue;
    const existing = known.find((k) => personKey(k) === personKey(words));
    const name = existing ?? titleCase(words);
    if (!people.some((p) => personKey(p) === personKey(name))) people.push(name);
  }
  if (!people.length) return { kind: "say", text: "Who are you splitting with? Try “hati kami ni Migs 1200”." };
  if (people.length > 10) return { kind: "say", text: "That’s a lot of people! Use Plan → Debts to split with more than 10." };
  const before = text.slice(0, m.index);
  const title = titleCase(stripped(before, state)) || "Shared bill";
  const cat = guessCategory(before.toLowerCase());
  const { mine, each } = equalShares(total, people.length, true);
  const acc = namedAccount(state, low) ?? usualAccount(state, "expense", cat, title)?.acc ?? state.defAcc;
  void now;
  return { kind: "split", title, total, myShare: mine, cat, acc, people: people.map((name, i) => ({ name, share: each[i] })) };
}

// ---------- Paying someone back / being paid back ----------

const I_PAY_RE = /\b(binayaran ko|bayad ko|binayad ko|nabayaran ko|i paid back|i paid|paid back|settle|bayad kay|bayad sa)\b/;
const THEY_PAY_RE = /\b(nagbayad|binayaran ako|bayad na|paid me|sent me|nag-?send|nagbalik|nagpadala)\b/;

function settleIntent(state: State, text: string, low: string): Intent | null {
  const iPay = I_PAY_RE.test(low);
  const theyPay = THEY_PAY_RE.test(low);
  if (!iPay && !theyPay) return null;
  const debts = (state.debts ?? []).filter((d) => debtLeft(d) > 0);
  const persons = [...new Set(debts.map((d) => d.person))].filter((p) => new RegExp(`\\b${escapeRe(personKey(p))}\\b`).test(low));
  if (!persons.length) {
    // They said someone paid / was paid, but there's no such debt on record.
    const m = text.match(/\b(?:si|kay|ni|na si)\s+([^\d]+?)(?=\s*\d|$)/i);
    const who = m ? titleCase(m[1].replace(/\b(ko|ako)\b/gi, "").trim()) : "";
    if (who) return { kind: "say", text: `I couldn’t find an open debt with ${who}. Add it first in Plan → Debts (or split a bill), then tell me again.` };
    return null;
  }
  const person = persons.sort((a, b) => b.length - a.length)[0];
  const mine = debts.filter((d) => personKey(d.person) === personKey(person));
  const has = (dir: "owe" | "owed") => mine.some((d) => d.direction === dir);
  // "binayaran ko" = I paid them (I owed). "nagbayad / paid me" = they paid me (they owed).
  let direction: "owe" | "owed" = iPay && !theyPay ? "owe" : "owed";
  if (iPay && theyPay) direction = "owed";
  if (!has(direction)) direction = direction === "owe" ? "owed" : "owe";
  if (!has(direction)) return null;
  const queue = mine.filter((d) => d.direction === direction).sort((a, b) => a.created - b.created);
  const owedTotal = queue.reduce((s, d) => s + debtLeft(d), 0);
  const amount = Math.min(amountOf(low) ?? owedTotal, owedTotal);
  let remaining = amount;
  const pays: { debtId: string; amount: number }[] = [];
  for (const d of queue) {
    if (remaining <= 0) break;
    const take = Math.min(debtLeft(d), remaining);
    pays.push({ debtId: d.id, amount: Math.round(take * 100) / 100 });
    remaining = Math.round((remaining - take) * 100) / 100;
  }
  const requested = amountOf(low);
  const acc = namedAccount(state, low) ?? usualAccount(state, direction === "owe" ? "expense" : "income", "Debt", "")?.acc ?? state.defAcc;
  return { kind: "settle", person: mine[0].person, direction, acc, pays, leftover: requested ? Math.max(0, Math.round((requested - amount) * 100) / 100) : 0 };
}

// ---------- Several entries in one message ----------

function multiIntent(state: State, text: string, now: number): Intent | null {
  const parts = text
    .split(/\s*(?:,|;|\band\b|\bat\b|\btapos\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  // Each piece needs its own amount and something that says what it was for.
  if (!parts.every((p) => /\d/.test(p) && /\p{L}{2,}/u.test(stripped(p, state)))) return null;
  const accounts = activeAccounts(state);
  const lows = parts.map((p) => p.toLowerCase());
  const lastDate = findDate(lows[lows.length - 1], now);
  const lastAcc = namedAccount(state, lows[lows.length - 1]);
  const txs: ParsedTx[] = [];
  const hints: (string | undefined)[] = [];
  for (let i = 0; i < parts.length; i++) {
    const tx = parseEntry(parts[i], accounts, state.defAcc, now, state.customCats ?? [], state.settings.payeeCats);
    if (!tx || tx.type === "transfer") return null;
    // A date or account said once at the end (“… and jeep 24 gcash kahapon”) applies to all.
    if (findDate(lows[i], now) === now && lastDate !== now) tx.date = lastDate;
    let hint: string | undefined;
    const named = namedAccount(state, lows[i]) ?? lastAcc;
    if (named) tx.acc = named;
    else {
      const u = usualAccount(state, tx.type, tx.cat, tx.note);
      if (u) {
        tx.acc = u.acc;
        hint = u.why;
      }
    }
    txs.push(tx);
    hints.push(hint);
  }
  return { kind: "multi", txs, hints };
}

// ---------- Lending and borrowing ----------

const LOAN_RE = /\b(lent|lend|loaned|pinahiram|pinautang|nagpahiram|pahiram|pautang|borrowed|borrow|hiniram|hiram|nangutang|nag-?utang|inutang|utang ni|utang kay)\b/;
const REPAY_RE = /\b(bayad|binayad|bayaran|binayaran|nabayaran|paid|pay|repaid|settle)\b/;

/**
 * Lending or borrowing isn't spending, and Kwenta keeps it under Debts. Chat can't create a debt yet, so rather than
 * quietly logging "lent Migs 250" as a ₱250 expense, point to the place that records it without counting it as spending.
 */
function loanIntent(low: string): Intent | null {
  if (!LOAN_RE.test(low) || REPAY_RE.test(low) || !/\d/.test(low)) return null;
  return { kind: "say", text: "That sounds like a loan, not spending. Add it in Plan → Debts so your balance is right and it isn’t counted as an expense." };
}

/** Works out whether a (non-question) message is one of the special intents above. */
export function detectIntent(text: string, state: State, now = Date.now()): Intent | null {
  const low = text.toLowerCase();
  return settleIntent(state, text, low) ?? splitIntent(state, text, low, now) ?? billIntent(state, text, low, now) ?? loanIntent(low) ?? multiIntent(state, text, now);
}
