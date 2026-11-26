import type { FxState } from "./currency";
import type { InterestFreq } from "./interest";
export type TxType = "expense" | "income" | "transfer";
export type AccKind = "cash" | "ewallet" | "bank" | "credit" | "locked";

export interface Account {
  id: string;
  name: string;
  opening: number;
  kind: AccKind;
  color: string;
  /** Credit limit, only for credit cards. */
  limit?: number;
  /** Id of another card whose credit limit this card shares (same bank / supplementary card). */
  limitShare?: string;
  /** When the opening balance was entered. On a credit card it isn't billed until the first cut-off after this. */
  openingAt?: number;
  /** Statement balance typed from the bank for one statement ("2026-10" key), overriding the estimate. */
  stmtFix?: { key: string; amount: number };
  /** Institution id from lib/institutions.ts (bank, e-wallet, card issuer). */
  inst?: string;
  /** A logo the user uploaded, as a small data URL. Overrides the institution logo. */
  logo?: string;
  /** Credit cards: which card it is (picture id from lib/cards.generated.ts), e.g. "mb-world". */
  card?: string;
  /** ISO currency code, e.g. "USD". Missing means the main currency. */
  currency?: string;
  /** When the balance was last checked against the real bank or wallet (see lib/reconcile.ts). */
  checkedAt?: number;
  /** Kept but hidden from lists and pickers (and from totals). */
  archived?: boolean;
  /** Shown, but not counted in net worth or the forecast. */
  excludeFromTotal?: boolean;
  /** Maintaining balance: money a bank wants kept in the account. Kept aside when working out what you can spend (account currency). */
  maintaining?: number;
  /** Yearly interest rate in %, e.g. 3.5. Only used to estimate the interest you earn. */
  rate?: number;
  /** Withholding tax on that interest in % (20 in the Philippines). */
  tax?: number;
  /** How often interest is credited (default monthly). Interest is posted automatically while a rate is set. */
  interestFreq?: InterestFreq;
  /** Start of the first day interest hasn't been posted for yet. Set when interest tracking starts; moves forward as it's posted. */
  interestFrom?: number;
  /** Interest earned but not yet posted because it's under a centavo; carried into the next period (like banks do). */
  interestCarry?: number;
  /** Some banks pay a higher rate on big balances: the rate (%) above `tierAt`. */
  rate2?: number;
  /** The balance (account currency) above which `rate2` applies. */
  tierAt?: number;
  /** The name the account is under (e.g. "Jose Vincent B."), shown on reminder cards. */
  payName?: string;
  /** The account (or mobile wallet) number people can pay to. Digits, spaces and dashes only. */
  payNumber?: string;
  /** Payment details for getting paid into this account (e.g. "MariBank 0917 123 4567"), shown on reminder cards. */
  payInfo?: string;
  /** This account's own payment QR, as a small data URL. */
  payQr?: string;
  /** Whether `rate2` applies to the whole balance, or only the part above `tierAt` (the default). */
  tierMode?: "whole" | "excess";
  /** Time deposit details, for "locked" accounts. */
  deposit?: Deposit;
  /** Credit cards: day of the month the statement closes (cut-off). */
  statementDay?: number;
  /** Credit cards: day of the month payment is due. */
  dueDay?: number;
  /** Credit cards: minimum due as % of the statement (default 3). */
  minPct?: number;
  /** Credit cards: minimum due is at least this much (default ₱500). */
  minFloor?: number;
  /** Credit cards: statements marked paid outside Kwenta, as "YYYY-M". */
  paidCycles?: string[];
}

/** Locked savings / time deposit (see lib/deposits.ts). */
export interface Deposit {
  principal: number;
  /** Yearly interest rate in %, e.g. 6 = 6%. Always yearly, even when entered per month. */
  rate: number;
  /** How the user entered the rate (shown back the same way). Default "year". */
  rateUnit?: "year" | "month";
  /** Old booster field (now unused; `rate` already includes it). */
  boost?: number;
  months: number;
  start: number;
  /** Withholding tax on interest in % (20% in the Philippines). */
  tax: number;
  status: "locked" | "matured" | "withdrawn";
  /** What you actually got back when it ended. */
  received?: number;
}

export interface Tx {
  id: string;
  type: TxType;
  amount: number;
  cat: string;
  note: string;
  acc: string;
  to?: string;
  /** For transfers between different currencies: the amount that arrived, in the receiving account's currency. */
  toAmount?: number;
  date: number;
  /** Id of an attached receipt photo (stored separately, see lib/photos.ts). */
  photo?: string;
  /** Added by Kwenta itself (e.g. savings interest), not logged by the user. Doesn't count toward the logging streak. */
  auto?: boolean;
  /** "Track only": the entry keeps its account for reference, but never changes that account's balance (or card statement, or interest). */
  track?: boolean;
  /** The recurring bill (or income) this entry pays, and which month it counts for ("YYYY-M"). */
  bill?: { id: string; key: string };
}

export interface DebtPayment {
  id: string;
  amount: number;
  date: number;
  /** Entry logged for this payment, if any. */
  txId?: string;
}

/** Money between you and someone else: "owe" = you owe them, "owed" = they owe you. */
export interface Debt {
  id: string;
  person: string;
  direction: "owe" | "owed";
  amount: number;
  note: string;
  due?: number;
  created: number;
  payments: DebtPayment[];
  /** Account the money moved through, if it was logged. */
  acc?: string;
  txId?: string;
  /** Set when this debt came from a split bill. */
  splitId?: string;
  /** Track only: the account is remembered, but the debt's entries (and its payments) don't change that account's balance. */
  track?: boolean;
}

/** A shared bill you paid; each friend's share becomes an "owed" debt. */
export interface Split {
  id: string;
  title: string;
  total: number;
  myShare: number;
  date: number;
  acc?: string;
  people: { name: string; share: number; debtId: string }[];
  txIds: string[];
}

/** Optional details about someone you share money with; matched to debts by name. */
export interface PersonProfile {
  id: string;
  name: string;
  /** Shown in the avatar instead of initials. */
  emoji?: string;
  color?: string;
  /** Where they can send money, e.g. "GCash 0917 123 4567". */
  payHandle?: string;
  note?: string;
}

export type ParsedTx = Omit<Tx, "id">;

export interface Goal {
  id: string;
  name: string;
  emoji: string;
  target: number;
  saved: number;
  created: number;
}

/** A bill or income that repeats every month on the same day. */
export interface Planned {
  id: string;
  name: string;
  type: "expense" | "income";
  amount: number;
  cat: string;
  acc: string;
  day: number;
  /** Months already logged, as "YYYY-M". */
  done: string[];
  /** What was actually paid for a month (key as in `done`), and the entry that records it. */
  paid?: Record<string, { txId: string; amount: number; date: number; /** Kwenta logged the entry when you marked it paid (so undoing deletes it). */ created: boolean }>;
}

/** A credit card purchase, cash loan or balance paid in monthly installments. */
export interface Installment {
  id: string;
  /** Credit card account. */
  acc: string;
  name: string;
  kind: "purchase" | "cash" | "conversion";
  principal: number;
  /** Monthly add-on rate in %, e.g. 1 = 1%. */
  rate: number;
  months: number;
  fee: number;
  /** Date of the first monthly bill. */
  start: number;
  /** Monthly bills already posted. */
  paid: number;
  cat: string;
  program: string;
  created: number;
  /** Entries this plan logged, so edits can correct them. */
  txIds?: { principal?: string; fee?: string; interest: string[] };
}

export type PayFreq = "monthly" | "semimonthly" | "weekly" | "biweekly";

export type Theme = "system" | "light" | "dark" | "amoled";

/** One entry in Settings → Notifications. */
export interface Notice {
  id: string;
  kind: "badge";
  icon: string;
  title: string;
  text: string;
  /** When it happened (ms). */
  at: number;
  read: boolean;
  /** For badges: the badge's tier, so the list can show its coin. */
  tier?: "bronze" | "silver" | "gold";
}

export interface Settings {
  name: string;
  /** Days of the month you get paid, e.g. [15, 30] (monthly / twice a month). */
  payday: number[];
  /** How often you get paid. Missing: inferred from `payday`. */
  payFreq?: PayFreq;
  /** Weekday of payday for weekly / every-2-weeks pay (0 = Sunday). */
  payWeekday?: number;
  /** A known payday, to line up every-2-weeks pay. */
  payAnchor?: number;
  /** Last month whose recap was dismissed on Home, as "YYYY-M". */
  recapSeen?: string;
  theme: Theme;
  /** Color palette id from lib/themes.ts. */
  palette: string;
  /** Categories you corrected: payee (lowercase) → category, so typing it again files it there. */
  payeeCats?: Record<string, string>;
  /** Your own color (#rrggbb), used when the palette is "custom". */
  customColor?: string;
  /** Main currency for totals, e.g. "PHP". */
  currency: string;
  /** Old single outfit (kept for older data); `look` replaces it. */
  outfit: string;
  /** Alki's accessories by slot, e.g. { head: "santa", eyes: "round" }. */
  look?: import("./closet").Look;
  /** How big Alki appears on Home and Wallet. */
  alkiSize: "small" | "medium" | "large";
  /** Whether Alki bobs, blinks and waves. */
  alkiMotion: boolean;
  /** Daily background reminders (Android). */
  reminders?: { enabled: boolean; names: boolean; logNudge: boolean; /** Days ahead to start warning about a credit card payment (default 3). */ cardLead?: number };
  /** Badge ids already announced (toast + Notifications list), so each one is announced once. Missing: nothing announced yet. */
  badgesSeen?: string[];
  /** In-app notifications, newest first (capped). */
  notices?: Notice[];
  /** Due-soon items hidden for now: item id → the day (start of day) they come back. Expired entries are pruned when saving. */
  snoozed?: Record<string, number>;
  /** True once the get-started flow was finished. */
  onboarded?: boolean;
  /** True once the old sample accounts were cleaned up (or never created). */
  defaultsCleared?: boolean;
  /** Wallet layout: compact list or card grid. */
  walletView?: "list" | "grid";
  /** Your payment details (e.g. "GCash 0917 123 4567"), shown on reminder cards so people know where to pay. */
  payInfo?: string;
  /** Your own payment QR (a GCash, Maya or bank QR picture) as a small data URL, included on a reminder card only when you choose. */
  payQr?: string;
  /** Which bank or app the QR belongs to (an institution id), so its logo and name can sit above the QR on a card. */
  payQrBank?: string;
  /** Privacy mode: show ₱••••• instead of amounts. */
  hideAmounts: boolean;
  /** Minutes in the background before the PIN is asked again (0 = right away). */
  autoLock: number;
}

export interface State {
  version: 2;
  accounts: Account[];
  txs: Tx[];
  /** Spending limit per category (in the main currency). */
  budgets: Record<string, number>;
  /** Period of each budget; missing means monthly. */
  budgetPeriods?: Record<string, import("./budgets").BudgetPeriod>;
  /** Categories the user created, e.g. "Milk tea". */
  customCats?: import("./categories").CustomCat[];
  goals: Goal[];
  planned: Planned[];
  installments: Installment[];
  debts: Debt[];
  splits: Split[];
  /** Profiles of people you split bills with. */
  people?: PersonProfile[];
  /** Key for encrypting receipt photos; protected by the PIN when the lock is on. */
  photoKey?: string;
  fx: FxState;
  settings: Settings;
  defAcc: string;
}

export const CATS: Record<string, string> = {
  Food: "🍜",
  Transport: "🚌",
  Bills: "💡",
  Shopping: "🛍️",
  Health: "💊",
  Fun: "🎬",
  Fees: "🧾",
  Other: "📦",
};
export const CAT_NAMES = Object.keys(CATS);
export const CAT_COLORS: Record<string, string> = {
  Food: "#f59e0b",
  Transport: "#0ea5e9",
  Bills: "#6366f1",
  Shopping: "#ec4899",
  Health: "#10b981",
  Fun: "#a855f7",
  Fees: "#64748b",
  Other: "#94a3b8",
};

export const KIND_LABEL: Record<AccKind, string> = {
  cash: "Cash",
  ewallet: "E-wallets",
  bank: "Bank accounts",
  credit: "Credit cards",
  locked: "Locked savings",
};

export const CARD_COLORS = ["#4338ca", "#0ea5e9", "#0f766e", "#e11d48", "#ea580c", "#7c3aed", "#334155", "#ca8a04"];
