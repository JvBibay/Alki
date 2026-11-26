/**
 * Currencies, exchange rates and money formatting.
 *
 * Each account has its own currency. Totals (net worth, stats, budgets) are shown in the
 * main currency chosen in Settings. Rates are stored as "units of a currency per 1 USD",
 * the way most rate services publish them, so any pair can be converted.
 */

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  /** Digits after the decimal point. */
  decimals: number;
}

export const CURRENCIES: Currency[] = [
  { code: "PHP", symbol: "₱", name: "Philippine peso", flag: "🇵🇭", decimals: 2 },
  { code: "USD", symbol: "$", name: "US dollar", flag: "🇺🇸", decimals: 2 },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", decimals: 2 },
  { code: "GBP", symbol: "£", name: "British pound", flag: "🇬🇧", decimals: 2 },
  { code: "JPY", symbol: "¥", name: "Japanese yen", flag: "🇯🇵", decimals: 0 },
  { code: "KRW", symbol: "₩", name: "South Korean won", flag: "🇰🇷", decimals: 0 },
  { code: "CNY", symbol: "CN¥", name: "Chinese yuan", flag: "🇨🇳", decimals: 2 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong dollar", flag: "🇭🇰", decimals: 2 },
  { code: "SGD", symbol: "S$", name: "Singapore dollar", flag: "🇸🇬", decimals: 2 },
  { code: "TWD", symbol: "NT$", name: "New Taiwan dollar", flag: "🇹🇼", decimals: 0 },
  { code: "AUD", symbol: "A$", name: "Australian dollar", flag: "🇦🇺", decimals: 2 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand dollar", flag: "🇳🇿", decimals: 2 },
  { code: "CAD", symbol: "C$", name: "Canadian dollar", flag: "🇨🇦", decimals: 2 },
  { code: "CHF", symbol: "CHF ", name: "Swiss franc", flag: "🇨🇭", decimals: 2 },
  { code: "AED", symbol: "AED ", name: "UAE dirham", flag: "🇦🇪", decimals: 2 },
  { code: "SAR", symbol: "SAR ", name: "Saudi riyal", flag: "🇸🇦", decimals: 2 },
  { code: "QAR", symbol: "QAR ", name: "Qatari riyal", flag: "🇶🇦", decimals: 2 },
  { code: "KWD", symbol: "KWD ", name: "Kuwaiti dinar", flag: "🇰🇼", decimals: 3 },
  { code: "BHD", symbol: "BHD ", name: "Bahraini dinar", flag: "🇧🇭", decimals: 3 },
  { code: "OMR", symbol: "OMR ", name: "Omani rial", flag: "🇴🇲", decimals: 3 },
  { code: "MYR", symbol: "RM", name: "Malaysian ringgit", flag: "🇲🇾", decimals: 2 },
  { code: "THB", symbol: "฿", name: "Thai baht", flag: "🇹🇭", decimals: 2 },
  { code: "IDR", symbol: "Rp", name: "Indonesian rupiah", flag: "🇮🇩", decimals: 0 },
  { code: "VND", symbol: "₫", name: "Vietnamese dong", flag: "🇻🇳", decimals: 0 },
  { code: "INR", symbol: "₹", name: "Indian rupee", flag: "🇮🇳", decimals: 2 },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));
export const getCurrency = (code?: string): Currency => BY_CODE.get(code ?? "") ?? BY_CODE.get("PHP")!;

/** Built-in rates (units per 1 USD) from open.er-api.com, used until you update them. */
export const DEFAULT_RATES_DATE = "2026-11-18";
export const DEFAULT_RATES: Record<string, number> = {
  PHP: 63.684, USD: 1, EUR: 0.9092, GBP: 0.7576, JPY: 159.39, KRW: 1335.36, CNY: 6.6799, HKD: 7.8462,
  SGD: 1.2885, TWD: 32.967, AUD: 1.4844, NZD: 1.8186, CAD: 1.4294, CHF: 0.8407, AED: 3.6725, SAR: 3.75,
  QAR: 3.64, KWD: 0.31134, BHD: 0.376, OMR: 0.3845, MYR: 4.0933, THB: 33.824, IDR: 18278.2, VND: 25704.3, INR: 93.513,
};

export interface FxState {
  /** Units per 1 USD. */
  rates: Record<string, number>;
  updated: number;
  source: "built-in" | "online" | "manual";
}

export const defaultFx = (): FxState => ({ rates: { ...DEFAULT_RATES }, updated: new Date(DEFAULT_RATES_DATE).getTime(), source: "built-in" });

/** Converts between any two currencies. Unknown currencies are treated 1:1. */
export function convert(amount: number, from: string, to: string, fx: FxState): number {
  if (from === to || !amount) return amount;
  const rf = fx.rates[from] ?? DEFAULT_RATES[from];
  const rt = fx.rates[to] ?? DEFAULT_RATES[to];
  if (!rf || !rt) return amount;
  return (amount / rf) * rt;
}

/** Rounds to the currency's own decimals (2 for pesos, 0 for yen, 3 for Kuwaiti dinar). */
export const roundIn = (n: number, code?: string) => {
  const f = 10 ** getCurrency(code).decimals;
  return Math.round(n * f) / f;
};

/** "1 USD = 63.68 PHP" style rate between two currencies. */
export const pairRate = (from: string, to: string, fx: FxState) => convert(1, from, to, fx);

/** Formats money with the currency's symbol and digits: ₱1,250.50, ¥12,000, KWD 1.250. */
export function formatMoney(n: number, code = "PHP", forceDecimals = false): string {
  const c = getCurrency(code);
  const abs = Math.abs(n);
  const hasFraction = Math.round(abs * 10 ** c.decimals) % 10 ** c.decimals !== 0;
  const digits = forceDecimals || hasFraction ? c.decimals : 0;
  const v = abs.toLocaleString("en-PH", { minimumFractionDigits: digits, maximumFractionDigits: c.decimals });
  return (n < 0 ? "−" : "") + c.symbol + v;
}

/**
 * The short mark drawn on coins and badges: the currency's sign without its prefix letters
 * ("HK$" → "$", "CN¥" → "¥", "₱" → "₱"), or its letters when it has no sign ("RM", "AED").
 */
export function coinSymbol(code?: string): string {
  const s = getCurrency(code).symbol.trim();
  const sign = [...s].reverse().find((ch) => !/[A-Za-z]/.test(ch));
  return sign ?? s;
}

/** Font scale for a coin mark so longer ones ("RM", "AED") still fit inside the circle. */
export const coinScale = (mark: string) => (mark.length <= 1 ? 1 : mark.length === 2 ? 0.66 : 0.5);

const RATE_URL = "https://open.er-api.com/v6/latest/USD";

/** Downloads today's rates. Only the request for public rates is sent; no personal data. */
export async function fetchRates(): Promise<FxState> {
  const res = await fetch(RATE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Rate service unavailable");
  const data = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
  if (data.result !== "success" || !data.rates) throw new Error("Rate service returned no rates");
  const rates: Record<string, number> = {};
  for (const c of CURRENCIES) {
    const r = data.rates[c.code];
    if (typeof r === "number" && r > 0) rates[c.code] = r;
  }
  return { rates: { ...DEFAULT_RATES, ...rates }, updated: (data.time_last_update_unix ?? Date.now() / 1000) * 1000, source: "online" };
}

export const RATE_SOURCE = { name: "ExchangeRate-API", url: "https://www.exchangerate-api.com" };
