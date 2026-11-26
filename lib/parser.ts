import type { Account, ParsedTx } from "./types";

const KEYWORDS: Record<string, string[]> = {
  Food: ["lunch", "dinner", "breakfast", "coffee", "starbucks", "restaurant", "foodpanda", "food", "jollibee", "mcdo", "grocery", "groceries", "snack", "meal", "milk tea", "merienda", "kape", "ulam", "rice", "pizza", "burger"],
  Transport: ["grab", "jeep", "jeepney", "fare", "gas", "gasoline", "taxi", "mrt", "lrt", "bus", "toll", "angkas", "tricycle", "parking", "commute"],
  Bills: ["electric", "electricity", "water", "internet", "wifi", "rent", "load", "bill", "bills", "subscription", "netflix", "spotify", "meralco", "insurance"],
  Shopping: ["shopee", "lazada", "clothes", "shoes", "mall", "shirt", "bag", "gift"],
  Health: ["medicine", "doctor", "gym", "vitamins", "hospital", "dentist", "checkup", "pharmacy"],
  Fun: ["movie", "game", "games", "concert", "bar", "beer", "inuman", "party", "cinema"],
};

const INCOME_RE = /\b(salary|sahod|sweldo|received|income|earned|allowance|bonus|refund|deposit|paid me|got paid|freelance)\b/;
const DAY_MS = 86_400_000;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WD = WEEKDAYS.join("|");
const DATE_WORDS_RE = new RegExp(
  `\\b(?:(?:last|on|noong)\\s+(?:${WD})|\\d+\\s+days?\\s+ago|yesterday|kahapon|today|kanina|ngayon)\\b`,
  "gi",
);
const FILLER_RE = /\b(bayad|binayad|spent|spend|paid|pay|bought|buy|for|on|from|my|account|using|via|the|sa|ng|ko)\b/gi;

/** Understands "yesterday", "3 days ago", "last friday" and "on monday". */
export function findDate(low: string, nowMs: number): number {
  if (/\b(yesterday|kahapon)\b/.test(low)) return nowMs - DAY_MS;
  const ago = low.match(/\b(\d+)\s+days?\s+ago\b/);
  if (ago) return nowMs - Number(ago[1]) * DAY_MS;
  const wd = low.match(new RegExp(`\\b(last|on|noong)\\s+(${WD})\\b`));
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    const today = new Date(nowMs).getDay();
    let back = (today - target + 7) % 7;
    if (back === 0 && wd[1] === "last") back = 7;
    return nowMs - back * DAY_MS;
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

  const m = low.match(/(\d[\d,]*(?:\.\d+)?)(k\b)?/);
  if (!m || m.index === undefined) return null;
  // Whole centavos only, and nothing the keypad could not enter either (9 digits).
  const amount = Math.round(parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1) * 100) / 100;
  if (!amount || amount <= 0 || amount >= 1_000_000_000) return null;

  const mentions = accounts
    .map((a) => ({ id: a.id, name: a.name, idx: low.indexOf(a.name.toLowerCase()) }))
    .filter((x) => x.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  const date = findDate(low, nowMs);

  let note = text.slice(0, m.index) + " " + text.slice(m.index + m[0].length);
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
