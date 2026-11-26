/**
 * Credit card installment plans: published rates per bank and the math behind them.
 *
 * How Philippine card installments work: the bank charges a monthly *add-on rate* on the
 * ORIGINAL amount for every month of the term. So ₱12,000 over 12 months at 1% costs
 * ₱120 interest every month (₱1,440 total) and you pay ₱1,000 + ₱120 = ₱1,120 a month.
 * Because the interest never shrinks as you pay, the true (effective) rate is about
 * 1.8x the add-on rate.
 *
 * Rates below were checked against each bank's own pages in November 2026 (BPI, Metrobank and RCBC read in full;
 * BDO's pages could not be reached, so its figures come from search results and older notices). Banks change them
 * often and many offers are promos, so every value is editable in the app.
 */

export const RATES_AS_OF = "November 2026";

/** BSP ceiling on monthly add-on rates for card installments. */
export const BSP_CAP = {
  rate: 1.5,
  previous: 1.0,
  note: "BSP Circular No. 1242 (signed Nov 10, 2026) raises the cap on new card installments from 1% to 1.5% a month, taking effect 15 days after it is published (the exact date was not yet announced). Existing installments keep their agreed terms. The 3% a month cap on regular finance charges is unchanged.",
};

export type InstKind = "purchase" | "cash" | "conversion";

export const KIND_TEXT: Record<InstKind, { label: string; help: string }> = {
  purchase: { label: "Purchase", help: "You bought something and pay it monthly." },
  cash: { label: "Cash loan", help: "Part of your credit limit was sent to your bank account as cash." },
  conversion: { label: "Balance conversion", help: "An existing card balance was turned into monthly payments." },
};

export interface Program {
  id: string;
  name: string;
  kind: InstKind;
  /** Monthly add-on rate in %, e.g. 1 = 1%. */
  rate: number;
  /** Different rate for specific terms, e.g. { 36: 0.99 }. */
  rateByTerm?: Record<number, number>;
  terms: number[];
  /** One-time fee in pesos, given the amount. */
  fee: (amount: number) => number;
  feeText: string;
  note?: string;
}

const T_SHORT = [3, 6, 9, 12, 18, 24];
const T_36 = [3, 6, 9, 12, 18, 24, 36];
const T_60 = [3, 6, 9, 12, 18, 24, 36, 48, 60];

export const ZERO_PROGRAM: Program = {
  id: "zero",
  name: "0% installment (partner store)",
  kind: "purchase",
  rate: 0,
  terms: T_36,
  fee: () => 0,
  feeText: "No fee",
  note: "Common at partner merchants and online stores. No interest; you just split the price.",
};

export const CUSTOM_PROGRAM: Program = {
  id: "custom",
  name: "Custom rate",
  kind: "purchase",
  rate: 1,
  terms: T_60,
  fee: () => 0,
  feeText: "Enter your own",
  note: "Use the rate and fee on your bank’s SMS, app or statement.",
};

/** Programs by bank id (the part of the institution id before "-cc"). */
export const BANK_PROGRAMS: Record<string, Program[]> = {
  bdo: [
    {
      id: "bdo-purchase-convert",
      name: "Purchase Convert (low rate)",
      kind: "purchase",
      rate: 0.55,
      terms: T_SHORT,
      fee: (a) => (a <= 20000 ? 100 : 200),
      feeText: "₱100 up to ₱20,000; ₱200 above",
      note: "Low rates are time-limited promos that BDO changes often (BDO’s regular Purchase Convert rate is 1%). Use the rate on your offer.",
    },
    {
      id: "bdo-balance-convert",
      name: "Balance Convert",
      kind: "conversion",
      rate: 1.0,
      terms: T_36,
      fee: () => 350,
      feeText: "₱350",
      note: "BDO also offers lower special rates by invitation. BDO’s fee notice lists Balance Convert but older schedules show ₱250, so check the fee on your offer.",
    },
    {
      id: "bdo-cash-installment",
      name: "Cash Installment",
      kind: "cash",
      rate: 1.0,
      terms: T_36,
      fee: () => 350,
      feeText: "₱350",
      note: "Promo rates (e.g. 0.49% for 12–24 months) are offered by SMS to selected cardholders.",
    },
  ],
  bpi: [
    {
      id: "bpi-installment",
      name: "Installment / Credit-to-Cash",
      kind: "cash",
      rate: 1.0,
      rateByTerm: { 36: 0.99 },
      terms: [6, 12, 18, 24, 36],
      fee: (a) => (a > 50000 ? 700 : 500),
      feeText: "₱500 up to ₱50,000; ₱700 above",
      note: "BPI lists 1% a month, or 0.99% for 36 months; its fee table says “up to 1%”. Fees as of September 17, 2026.",
    },
    {
      id: "bpi-balance-transfer",
      name: "Balance Transfer",
      kind: "conversion",
      rate: 1.0,
      rateByTerm: { 36: 0.99 },
      terms: [6, 12, 18, 24, 36],
      fee: (a) => (a > 50000 ? 700 : 500),
      feeText: "₱500 up to ₱50,000; ₱700 above",
    },
    {
      id: "bpi-balance-conversion",
      name: "Balance Conversion",
      kind: "conversion",
      rate: 1.0,
      rateByTerm: { 36: 0.99 },
      terms: T_36,
      fee: (a) => (a > 50000 ? 700 : 500),
      feeText: "₱500 up to ₱50,000; ₱700 above",
    },
  ],
  metrobank: [
    { id: "mb-easy", name: "Easy Installment", kind: "purchase", rate: 1.0, terms: [3, 6, 9, 12, 18, 24, 36, 48], fee: () => 0, feeText: "No fee listed", note: "Metrobank lists 1% a month for every term." },
    {
      id: "mb-balance-conversion",
      name: "Balance Conversion",
      kind: "conversion",
      rate: 1.0,
      terms: T_60,
      fee: () => 500,
      feeText: "₱500",
      note: "Metrobank doesn’t publish this rate or its terms online (“prevailing rates”). 1% and these terms are assumptions: use the rate on your offer.",
    },
    { id: "mb-cash2go", name: "Cash2Go", kind: "cash", rate: 1.0, terms: T_60, fee: () => 350, feeText: "₱350", note: "Metrobank lists “up to 1%” a month for 3–60 months (minimum ₱6,000)." },
    {
      id: "mb-balance-transfer",
      name: "Balance Transfer",
      kind: "conversion",
      rate: 1.0,
      terms: [6, 9, 12, 18, 24, 36, 48, 60],
      fee: () => 350,
      feeText: "₱350",
      note: "Metrobank doesn’t publish this rate or its terms online (“prevailing rates”). 1% and these terms are assumptions: use the rate on your offer.",
    },
  ],
  rcbc: [
    {
      id: "rcbc-instacash",
      name: "InstaCash",
      kind: "cash",
      rate: 1.0,
      terms: T_60,
      fee: () => 500,
      feeText: "₱500, added to your card bill (not taken from the cash)",
      note: "RCBC lists 1% a month for 3–60 months. Offers are personal (SMS or email), so use the rate on yours.",
    },
    {
      id: "rcbc-balance-conversion",
      name: "Balance Conversion",
      kind: "conversion",
      rate: 1.0,
      terms: T_36,
      fee: () => 500,
      feeText: "₱500",
      note: "RCBC lists 1% a month for 3–36 months, but says your rate is personal: call RCBC to confirm.",
    },
  ],
};

/** Fallback for banks without published rates: the common 1% a month. */
export const GENERIC_PROGRAM: Program = {
  id: "generic",
  name: "Bank installment (typical 1%)",
  kind: "purchase",
  rate: 1.0,
  terms: T_36,
  fee: () => 0,
  feeText: "Check your offer",
  note: "No published rate found for this bank; 1% a month is the most common rate. Edit to match your offer.",
};

export function programsFor(instId?: string): Program[] {
  const bank = instId?.replace(/-cc$/, "") ?? "";
  return [ZERO_PROGRAM, ...(BANK_PROGRAMS[bank] ?? [GENERIC_PROGRAM]), CUSTOM_PROGRAM];
}

export const rateFor = (p: Program, months: number) => p.rateByTerm?.[months] ?? p.rate;

// ---------- Math ----------

export interface Quote {
  monthly: number;
  principalPart: number;
  interestPart: number;
  totalInterest: number;
  totalCost: number;
  /** True monthly rate (IRR of the payments), in %. Counts the one-time fee as money you don't get to use. */
  effMonthly: number;
  /** effMonthly × 12, the way banks show it. */
  effAnnual: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function quote(principal: number, ratePct: number, months: number, fee = 0): Quote {
  const n = Math.max(1, Math.round(months));
  const p = Math.max(0, principal);
  const principalPart = p / n;
  const interestPart = (p * ratePct) / 100;
  const monthly = principalPart + interestPart;
  // With a fee, you effectively receive (principal - fee) for the same payments, so the true rate is higher.
  const eff = effectiveRate(Math.max(0, p - Math.max(0, fee)), monthly, n);
  return {
    monthly: round2(monthly),
    principalPart: round2(principalPart),
    interestPart: round2(interestPart),
    totalInterest: round2(interestPart * n),
    totalCost: round2(p + interestPart * n + fee),
    effMonthly: round2(eff * 100),
    effAnnual: round2(eff * 1200),
  };
}

/** Monthly rate i such that principal = payment × (1 − (1+i)^−n) / i. */
export function effectiveRate(principal: number, payment: number, n: number): number {
  if (principal <= 0 || payment * n <= principal + 1e-9) return 0;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    const pv = (payment * (1 - Math.pow(1 + mid, -n))) / mid;
    if (pv > principal) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Due date of payment number k (0-based), keeping the same day of month. */
export function dueDate(start: number, k: number): Date {
  const s = new Date(start);
  const y = s.getFullYear();
  const m = s.getMonth() + k;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(s.getDate(), last));
}
