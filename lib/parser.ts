import type { Account, ParsedTx } from "./types";

const KEYWORDS: Record<string, string[]> = {
  Food: ["lunch", "dinner", "breakfast", "coffee", "starbucks", "restaurant", "foodpanda", "food", "jollibee", "mcdo", "grocery", "groceries", "snack", "meal", "milk tea", "merienda", "kape", "ulam", "rice", "pizza", "burger"],
  Transport: ["grab", "jeep", "jeepney", "fare", "pamasahe", "gas", "gasoline", "taxi", "mrt", "lrt", "bus", "toll", "angkas", "tricycle", "parking", "commute"],
  Bills: ["electric", "electricity", "water", "internet", "wifi", "rent", "load", "bill", "bills", "subscription", "netflix", "spotify", "meralco", "insurance"],
  Shopping: ["shopee", "lazada", "clothes", "shoes", "mall", "shirt", "bag", "gift"],
  Health: ["medicine", "doctor", "gym", "vitamins", "hospital", "dentist", "checkup", "pharmacy"],
  Fun: ["movie", "game", "games", "concert", "bar", "beer", "inuman", "party", "cinema"],
};

const INCOME_RE = /\b(salary|sahod|sweldo|received|income|earned|allowance|bonus|refund|deposit|paid me|got paid|freelance)\b/;
const DAY_MS = 86_400_000;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
// Tagalog weekday names, in the same Sunday-first order.
const WEEKDAYS_TL = ["linggo", "lunes", "martes", "miyerkules", "huwebes", "biyernes", "sabado"];
const WD = [...WEEKDAYS, ...WEEKDAYS_TL].join("|");
const weekdayIndex = (w: string) => (WEEKDAYS.includes(w) ? WEEKDAYS.indexOf(w) : WEEKDAYS_TL.indexOf(w));
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
// "nov 20", "20 nov", "on 11/15". A bare "1/2" is a fraction, so the numeric form needs "on".
// Capture groups: 1 month name + 2 day, or 3 day + 4 month name, or 5 month number + 6 day.
const EXPLICIT_DATE = `(?:on\\s+)?(?:${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?|(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}|on\\s+(\\d{1,2})/(\\d{1,2}))`;
const EXPLICIT_RE = new RegExp(`\\b${EXPLICIT_DATE}\\b`, "i");
const DATE_WORDS_RE = new RegExp(
  `\\b(?:${EXPLICIT_DATE}|(?:last|on|noong|nung)\\s+(?:${WD})|\\d+\\s+days?\\s+ago|\\d+\\s+araw\\s+(?:ang\\s+)?nakaraan|last\\s+(?:week|month)|nakaraang\\s+(?:linggo|buwan)|yesterday|kahapon|tomorrow|bukas|today|kanina|ngayon)\\b`,
  "gi",
);
const FILLER_RE = /\b(bayad|binayad|spent|spend|paid|pay|bought|buy|for|on|from|my|account|using|via|the|sa|ng|ko)\b/gi;

/** Understands "yesterday", "3 days ago", "last friday", "on monday", "nov 20", "on 11/15", "tomorrow", "last week/month". */
export function findDate(low: string, nowMs: number): number {
  if (/\b(yesterday|kahapon)\b/.test(low)) return nowMs - DAY_MS;
  if (/\b(tomorrow|bukas)\b/.test(low)) return nowMs + DAY_MS;
  const ago = low.match(/\b(\d+)\s+(?:days?\s+ago|araw\s+(?:ang\s+)?nakaraan)\b/);
  if (ago) return nowMs - Number(ago[1]) * DAY_MS;
  if (/\b(last\s+week|nakaraang\s+linggo)\b/.test(low)) return nowMs - 7 * DAY_MS;
  if (/\b(last\s+month|nakaraang\s+buwan)\b/.test(low)) {
    const d = new Date(nowMs);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d.getTime();
  }
  const wd = low.match(new RegExp(`\\b(last|on|noong|nung)\\s+(${WD})\\b`));
  if (wd) {
    const target = weekdayIndex(wd[2]);
    const today = new Date(nowMs).getDay();
    let back = (today - target + 7) % 7;
    if (back === 0 && wd[1] === "last") back = 7;
    return nowMs - back * DAY_MS;
  }
  const ex = low.match(EXPLICIT_RE);
  if (ex) {
    const mon = ex[1] ?? ex[4];
    const month = mon ? MONTHS.indexOf(mon.slice(0, 3)) : Number(ex[5]) - 1;
    const day = Number(ex[2] ?? ex[3] ?? ex[6]);
    const now = new Date(nowMs);
    let when = new Date(now.getFullYear(), month, day, now.getHours(), now.getMinutes());
    // No year given: a spending log means the most recent such date, never one far in the future.
    if (when.getTime() > nowMs + DAY_MS) when = new Date(now.getFullYear() - 1, month, day, now.getHours(), now.getMinutes());
    // Reject impossible dates like "feb 31" (the Date constructor would roll them over).
    if (month >= 0 && month < 12 && day >= 1 && when.getMonth() === month && when.getDate() === day) return when.getTime();
  }
  return nowMs;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A user-made category: matched by its name or any of its keywords. */
export interface ExtraCategory {
  name: string;
  keywords?: string[];
}

function findCategory(low: string, extra: ExtraCategory[] = []): string {
  // Your own categories win, so "milk tea 120" goes to "Milk tea" if you made one.
  for (const c of extra) {
    for (const w of [c.name, ...(c.keywords ?? [])]) {
      const word = w.trim().toLowerCase();
      if (word && new RegExp(`\\b${escapeRe(word)}\\b`).test(low)) return c.name;
    }
  }
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    for (const w of words) {
      if (new RegExp(`\\b${escapeRe(w)}\\b`).test(low)) return cat;
    }
  }
  return "Other";
}

/** Best category for any text (e.g. a receipt), or "Other". */
export function guessCategory(text: string, extra: ExtraCategory[] = []): string {
  return findCategory(text.toLowerCase(), extra);
}

// A quantity or unit right after a number ("3 friends", "2 days", "5 pm"): it is a count, not the price.
const COUNT_WORD = /^\s*(?:days?|weeks?|months?|years?|hours?|hrs?|mins?|minutes?|pcs?|pieces?|pax|friends?|people|persons?|kids?|items?|orders?|times|am|pm|araw|linggo|buwan|taon)\b/;
// A currency word right after the amount ("180php", "50 pesos"): part of the amount, so it leaves the note too.
const CURRENCY_AFTER = /^\s*(?:php|pesos?|piso)\b/;

interface PickedAmount {
  value: number;
  index: number;
  length: number;
}

/**
 * Finds the price in "7-eleven 85", "3 shirts 900" or "bought 2 burgers for 240".
 * Numbers that are not prices are skipped: glued to words ("7-eleven", "2pc", "x2"), fractions, percentages,
 * clock times, and counts ("3 friends"). Of what is left, a peso-marked number wins; otherwise the largest,
 * because a price is nearly always bigger than the quantity next to it. Dates are masked out first.
 */
function pickAmount(low: string): PickedAmount | null {
  const masked = low.replace(DATE_WORDS_RE, (d) => " ".repeat(d.length));
  const re = /(₱\s*|\bphp\s*)?(\d[\d,]*(?:\.\d+)?)(k\b)?/g;
  let best: (PickedAmount & { marked: boolean }) | null = null;
  for (let m = re.exec(masked); m; m = re.exec(masked)) {
    const start = m.index;
    const end = start + m[0].length;
    const numStart = start + (m[1]?.length ?? 0);
    const before = masked.slice(0, numStart);
    const after = masked.slice(end);
    const cur = after.match(CURRENCY_AFTER);
    const glued =
      /\bx$/.test(before) || // "x2"
      /[a-z]-$/.test(before) || // "covid-19"
      /^-[a-z]/.test(after) || // "7-eleven"
      /\d[/:]$/.test(before) || /^[/:]\d/.test(after) || // 1/2, 2:30
      /^%/.test(after) ||
      (!m[3] && !cur && /^[a-z]/.test(after) && /[^a-z]$/.test(before)); // "2pc", "3rd"
    if (glued || COUNT_WORD.test(after)) continue;
    const raw = parseFloat(m[2].replace(/,/g, "")) * (m[3] ? 1000 : 1);
    const marked = !!m[1];
    const better = !best || (marked && !best.marked) || (marked === best.marked && raw > best.value);
    if (better) best = { value: raw, index: start, length: end - start + (cur ? cur[0].length : 0), marked };
  }
  if (!best) return null;
  // Whole centavos only, and nothing the keypad could not enter either (9 digits).
  const value = Math.round(best.value * 100) / 100;
  if (!Number.isFinite(value) || value <= 0 || value >= 1_000_000_000) return null;
  return { value, index: best.index, length: best.length };
}

/**
 * Turns a sentence like "grab 250 gcash" into a transaction.
 * Returns null when no amount can be found.
 */
export function parseEntry(
  raw: string,
  accounts: Pick<Account, "id" | "name">[],
  defAcc: string,
  nowMs: number = Date.now(),
  extraCats: ExtraCategory[] = [],
  learned: Record<string, string> = {},
): ParsedTx | null {
  const text = raw.trim();
  if (!text) return null;
  const low = text.toLowerCase();

  const m = pickAmount(low);
  if (!m) return null;
  const amount = m.value;

  const mentions = accounts
    .map((a) => ({ id: a.id, name: a.name, idx: low.indexOf(a.name.toLowerCase()) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  const date = findDate(low, nowMs);

  let note = text.slice(0, m.index) + " " + text.slice(m.index + m.length);
  note = note.replace(DATE_WORDS_RE, " ").replace(/^\s*\+/, " ");

  if (/\b(transfer|move|moved)\b/.test(low) && mentions.length >= 2) {
    let from = mentions[0];
    let to = mentions[1];
    const fi = low.indexOf(" from ");
    if (fi > -1) {
      const after = mentions.filter((x) => x.idx > fi);
      if (after.length) {
        from = after[0];
        to = mentions.find((x) => x.id !== from.id) ?? to;
      }
    }
    return { type: "transfer", amount, acc: from.id, to: to.id, cat: "Transfer", note: "Transfer", date };
  }

  const isIncome = INCOME_RE.test(low) || /^\s*\+/.test(low);
  let cat = isIncome ? "Income" : findCategory(low, extraCats);
  const acc = mentions.length ? mentions[0].id : defAcc;

  for (const a of accounts) {
    note = note.replace(new RegExp(`\\b${escapeRe(a.name)}\\b`, "gi"), " ");
  }
  note = note.replace(FILLER_RE, " ").replace(/\s+/g, " ").trim();
  // A sign, peso mark or comma left beside the amount ("taxi -50", "lunch ₱180") is not part of the note.
  note = note.replace(/^[\s\-–—−:;,.₱$]+|[\s\-–—−:;,.₱$]+$/g, "").trim();
  if (!note) note = isIncome ? "Income" : cat;
  note = note.charAt(0).toUpperCase() + note.slice(1);
  // A category you corrected before for this payee wins over the keyword guess.
  const mine = !isIncome ? learned[note.toLowerCase()] : undefined;
  if (mine) cat = mine;

  return { type: isIncome ? "income" : "expense", amount, acc, cat, note, date };
}
