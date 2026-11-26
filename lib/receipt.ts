/**
 * Turns the text read from a receipt photo into entry details: total, store, date, category.
 * Receipts vary a lot, so everything here is a best guess for the person to check.
 */
import { guessCategory, type ExtraCategory } from "./parser";

export interface ReceiptGuess {
  amount?: number;
  merchant?: string;
  date?: number;
  cat?: string;
  /** How the total was found, for the "please check" message. */
  how?: "total-line" | "largest";
}

// Money like 1,234.50 / 1 234.50 / 450.00 (OCR often reads commas as dots or spaces).
const MONEY = /(?:₱|php|p)?\s*(\d{1,3}(?:[,.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2})(?!\d)/gi;

function toNumber(raw: string): number {
  // The last separator before 2 digits is the decimal point; everything else is thousands.
  const cleaned = raw.replace(/\s/g, "");
  const m = cleaned.match(/^(.*)[.,](\d{2})$/);
  if (!m) return NaN;
  return parseFloat(m[1].replace(/[.,]/g, "") + "." + m[2]);
}

const amountsIn = (line: string) => [...line.matchAll(MONEY)].map((m) => toNumber(m[1])).filter((n) => n > 0 && n < 10_000_000);

// Lines that look like a total but aren't the amount you paid.
const NOT_TOTAL = /sub\s*-?\s*total|total\s*(items?|qty|quantity|pcs|discount|savings|vat)|vatable|vat\s*(amount|exempt|sales)|zero[- ]?rated|change|cash\s*tendered|tendered|amount\s*tendered|\bcash\b|card\s*no|points|balance\s*after/i;
const TOTAL_STRONG = /grand\s*total|amount\s*due|total\s*amount\s*due|total\s*due|net\s*amount|total\s*sales|amount\s*payable|total\s*payable/i;
const TOTAL_WEAK = /\btotal\b|\bamount\b|\bdue\b/i;

// Store names and the category they usually mean (checked before the generic keyword guess).
const MERCHANTS: [RegExp, string][] = [
  [/jollibee|mcdo|mcdonald|chowking|greenwich|mang inasal|kfc|starbucks|tim hortons|7-?eleven|ministop|family\s*mart|puregold|savemore|sm\s*(super|hyper)market|robinsons\s*supermarket|landmark|s&r|waltermart|alfamart|uncle john/i, "Food"],
  [/mercury\s*drug|watsons|south\s*star|rose\s*pharmacy|the\s*generics/i, "Health"],
  [/shell|petron|caltex|seaoil|phoenix|cleanfuel|grab|angkas|joyride|lrt|mrt|autosweep|easytrip/i, "Transport"],
  [/meralco|maynilad|manila\s*water|pldt|globe|smart|converge|sky\s*cable|dito/i, "Bills"],
  [/sm\s*(store|dept)|uniqlo|h&m|zara|penshoppe|bench|national\s*book|ace\s*hardware|handyman|wilcon|lazada|shopee|anson|abenson|octagon|datablitz/i, "Shopping"],
  [/sm\s*cinema|ayala\s*cinema|timezone|worlds of fun/i, "Fun"],
];

const SKIP_MERCHANT = /official\s*receipt|sales\s*invoice|receipt|invoice|\btin\b|vat\s*reg|non-?vat|min\s*#|\bsn\b|serial|permit|cashier|terminal|tel\.?|phone|www\.|\.com|date|time|branch|store\s*#|\d{3}-\d{3}-\d{3}/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function findDate(text: string, now: number): number | undefined {
  const candidates: Date[] = [];
  // 11/18/2026, 11-18-26, 2026-11-18
  for (const m of text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g)) {
    const y = Number(m[3].length === 2 ? "20" + m[3] : m[3]);
    candidates.push(new Date(y, Number(m[1]) - 1, Number(m[2]), 12)); // PH receipts use month/day
  }
  for (const m of text.matchAll(/\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/g)) candidates.push(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  // Nov 18, 2026 / 18 Nov 2026
  for (const m of text.matchAll(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/gi)) {
    const mi = MONTHS.indexOf(m[1].toLowerCase());
    if (mi >= 0) candidates.push(new Date(Number(m[3]), mi, Number(m[2]), 12));
  }
  for (const m of text.matchAll(/\b(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(20\d{2})\b/gi)) {
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi >= 0) candidates.push(new Date(Number(m[3]), mi, Number(m[1]), 12));
  }
  // Must be a real date within the last year and not in the future.
  const ok = candidates.filter((d) => !Number.isNaN(d.getTime()) && d.getTime() <= now + 86_400_000 && d.getTime() > now - 366 * 86_400_000);
  return ok[0]?.getTime();
}

function findMerchant(lines: string[]): string | undefined {
  for (const raw of lines.slice(0, 6)) {
    const line = raw.replace(/[^A-Za-z0-9&'.\- ]/g, " ").replace(/\s+/g, " ").trim();
    const letters = (line.match(/[A-Za-z]/g) ?? []).length;
    if (letters < 3 || SKIP_MERCHANT.test(line) || letters < line.length * 0.5) continue;
    return line
      .toLowerCase()
      .replace(/\b([a-z])/g, (c) => c.toUpperCase())
      .replace(/\b(Inc|Corp|Co)\b\.?/g, "")
      .trim()
      .slice(0, 40);
  }
  return undefined;
}

export function parseReceipt(text: string, now = Date.now(), extra: ExtraCategory[] = []): ReceiptGuess {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: ReceiptGuess = {};

  // 1) A clear "grand total / amount due" line, then a plain "total" line (bottom-most wins).
  for (const pattern of [TOTAL_STRONG, TOTAL_WEAK]) {
    for (let i = lines.length - 1; i >= 0 && out.amount === undefined; i--) {
      const line = lines[i];
      if (!pattern.test(line) || NOT_TOTAL.test(line)) continue;
      // The amount is on the same line, or (on some receipts) the next one.
      const nums = amountsIn(line).length ? amountsIn(line) : amountsIn(lines[i + 1] ?? "");
      if (nums.length) {
        out.amount = nums[nums.length - 1];
        out.how = "total-line";
      }
    }
    if (out.amount !== undefined) break;
  }
  // 2) Otherwise, the largest amount that isn't cash given or change.
  if (out.amount === undefined) {
    const all = lines.filter((l) => !/change|tender|cash/i.test(l)).flatMap(amountsIn);
    if (all.length) {
      out.amount = Math.max(...all);
      out.how = "largest";
    }
  }

  out.merchant = findMerchant(lines);
  out.date = findDate(text, now);
  const hay = `${out.merchant ?? ""}\n${text}`;
  const known = MERCHANTS.find(([re]) => re.test(hay));
  const guessed = guessCategory(hay, extra);
  out.cat = known ? known[1] : guessed !== "Other" ? guessed : undefined;
  return out;
}
