import type { AccKind } from "./types";

/**
 * Philippine banks, e-wallets and credit providers people commonly track.
 * `logo` is the file name in /public/logos (fetched by `npm run logos`); if missing, a
 * monogram in the brand color is shown instead. Credit cards reuse their bank's logo.
 */
export type InstGroup = "ewallet" | "digital" | "bank" | "gov" | "credit" | "bnpl";

export interface Institution {
  id: string;
  name: string;
  short: string;
  group: InstGroup;
  color: string;
  /** Text color on top of `color`. */
  ink?: string;
  logo: string;
  domain: string;
}

export const GROUP_LABEL: Record<InstGroup, string> = {
  ewallet: "E-wallets",
  digital: "Digital banks",
  bank: "Banks",
  gov: "Government savings",
  credit: "Credit cards",
  bnpl: "Pay later & credit lines",
};

export const GROUP_KIND: Record<InstGroup, AccKind> = {
  ewallet: "ewallet",
  digital: "bank",
  bank: "bank",
  // SSS / Pag-IBIG: tracked like a savings account (time deposits use the Locked savings form).
  gov: "bank",
  credit: "credit",
  bnpl: "credit",
};

type Row = [id: string, name: string, short: string, color: string, domain: string, ink?: string];

const EWALLETS: Row[] = [
  ["gcash", "GCash", "G", "#007dfe", "gcash.com"],
  ["maya", "Maya", "maya", "#0b0b0b", "maya.ph", "#3df5a7"],
  ["grabpay", "GrabPay", "GP", "#00b14f", "grab.com"],
  ["shopeepay", "ShopeePay", "SP", "#ee4d2d", "shopee.ph"],
  ["coinsph", "Coins.ph", "C", "#1c5cff", "coins.ph"],
  ["lazadawallet", "Lazada Wallet", "LZ", "#0f146d", "lazada.com.ph"],
  ["paypal", "PayPal", "PP", "#003087", "paypal.com"],
  ["wise", "Wise", "W", "#9fe870", "wise.com", "#163300"],
  ["palawanpay", "PalawanPay", "PP", "#e4202b", "palawanpay.com"],
  ["diskartech", "DiskarTech", "DT", "#f7931e", "diskartech.ph"],
  ["tayocash", "TayoCash", "TC", "#1d4ed8", "tayocash.com"],
  ["mlwallet", "ML Wallet", "ML", "#d71920", "mlhuillier.com"],
  ["starpay", "StarPay", "S", "#f59e0b", "starpay.com.ph", "#1a1a1a"],
  ["bdopay", "BDO Pay", "BP", "#0033a0", "bdo.com.ph"],
  ["bayad", "Bayad", "B", "#f26522", "bayad.com"],
];

const DIGITAL: Row[] = [
  ["gotyme", "GoTyme Bank", "GT", "#00b5ad", "gotyme.com.ph"],
  ["mayabank", "Maya Savings", "maya", "#0b0b0b", "maya.ph", "#3df5a7"],
  ["tonik", "Tonik", "T", "#6c2bd9", "tonikbank.com"],
  ["cimb", "CIMB Bank PH", "CB", "#ec1c24", "cimbbank.com.ph"],
  ["maribank", "MariBank (formerly SeaBank)", "MB", "#ff5722", "maribank.ph"],
  ["uniondigital", "UnionDigital Bank", "UD", "#ff7a00", "uniondigitalbank.io"],
  ["uno", "UNO Digital Bank", "UNO", "#2148c0", "uno.bank"],
  ["ofbank", "OFBank", "OF", "#003b71", "ofbank.com.ph"],
  ["gsave", "GCash GSave", "GS", "#005ce6", "gcash.com"],
  ["ownbank", "OwnBank", "OWN", "#111111", "ownbank.com"],
];

const GOV: Row[] = [
  ["sss", "SSS", "SSS", "#0b4ea2", "sss.gov.ph"],
  ["pagibig", "Pag-IBIG Fund (MP2)", "PI", "#1d3f8f", "pagibigfund.gov.ph"],
];

const BANKS: Row[] = [
  ["bdo", "BDO Unibank", "BDO", "#0033a0", "bdo.com.ph"],
  ["bpi", "BPI", "BPI", "#b11116", "bpi.com.ph"],
  ["metrobank", "Metrobank", "MB", "#003f87", "metrobank.com.ph"],
  ["landbank", "Landbank", "LB", "#00843d", "landbank.com"],
  ["pnb", "PNB", "PNB", "#0b3d91", "pnb.com.ph"],
  ["securitybank", "Security Bank", "SB", "#0098d8", "securitybank.com"],
  ["unionbank", "UnionBank", "UB", "#ff8000", "unionbankph.com"],
  ["rcbc", "RCBC", "RC", "#0054a6", "rcbc.com"],
  ["chinabank", "China Bank", "CB", "#c8102e", "chinabank.ph"],
  ["eastwest", "EastWest Bank", "EW", "#7a1f7a", "eastwestbanker.com"],
  ["psbank", "PSBank", "PS", "#005ba9", "psbank.com.ph"],
  ["dbp", "DBP", "DBP", "#0a3d8f", "dbp.ph"],
  ["aub", "AUB", "AUB", "#8b1e3f", "aub.com.ph"],
  ["maybank", "Maybank PH", "MB", "#ffc72c", "maybank.com.ph", "#1a1a1a"],
  ["hsbc", "HSBC", "HS", "#db0011", "hsbc.com.ph"],
  ["bankcom", "Bank of Commerce", "BC", "#00529b", "bankcom.com.ph"],
  ["pbcom", "PBCOM", "PB", "#003e7e", "pbcom.com.ph"],
  ["veterans", "Veterans Bank", "PVB", "#00563f", "veteransbank.com.ph"],
  ["ctbc", "CTBC Bank", "CT", "#00704a", "ctbcbank.com.ph"],
  ["sterling", "Sterling Bank of Asia", "SBA", "#005bac", "sterlingbankasia.com"],
  ["chinabanksavings", "China Bank Savings", "CBS", "#a3192e", "cbs.com.ph"],
  ["citystate", "Citystate Savings", "CS", "#1e3a8a", "citystatesavings.com"],
];

/** Credit cards issued by the banks above: [bank id, card name]. */
const CARDS: [string, string][] = [
  ["bdo", "BDO Credit Card"],
  ["bpi", "BPI Credit Card"],
  ["metrobank", "Metrobank Credit Card"],
  ["securitybank", "Security Bank Credit Card"],
  ["unionbank", "UnionBank Credit Card"],
  ["rcbc", "RCBC Credit Card"],
  ["eastwest", "EastWest Credit Card"],
  ["chinabank", "China Bank Credit Card"],
  ["pnb", "PNB Credit Card"],
  ["aub", "AUB Credit Card"],
  ["hsbc", "HSBC Credit Card"],
  ["maybank", "Maybank Credit Card"],
  ["landbank", "Landbank Credit Card"],
  ["psbank", "PSBank Credit Card"],
  ["bankcom", "Bank of Commerce Credit Card"],
  ["cimb", "CIMB Credit Card"],
];

const BNPL: Row[] = [
  ["ggives", "GCash GGives / GCredit", "GG", "#007dfe", "gcash.com"],
  ["mayacredit", "Maya Credit", "maya", "#0b0b0b", "maya.ph", "#3df5a7"],
  ["spaylater", "SPayLater", "SPL", "#ee4d2d", "shopee.ph"],
  ["lazpaylater", "Lazada PayLater", "LPL", "#0f146d", "lazada.com.ph"],
  ["billease", "BillEase", "BE", "#1f5cff", "billease.ph"],
  ["atome", "Atome", "A", "#f0ff5f", "atome.ph", "#1a1a1a"],
  ["homecredit", "Home Credit", "HC", "#e11b22", "homecredit.ph"],
  ["tendopay", "TendoPay", "TP", "#3b82f6", "tendopay.ph"],
  ["cashalo", "Cashalo", "CA", "#00a79d", "cashalo.com"],
  ["salmon", "Salmon", "S", "#f05a5a", "salmon.ph"],
  ["skyro", "Skyro", "SK", "#1f2937", "skyro.ph"],
  ["tala", "Tala", "T", "#00a99d", "tala.ph"],
];

const mk = (group: InstGroup) => ([id, name, short, color, domain, ink]: Row): Institution => ({
  id,
  name,
  short,
  group,
  color,
  ink,
  logo: id,
  domain,
});

const byId = new Map<string, Institution>();
for (const r of [...EWALLETS.map(mk("ewallet")), ...DIGITAL.map(mk("digital")), ...BANKS.map(mk("bank")), ...GOV.map(mk("gov")), ...BNPL.map(mk("bnpl"))]) {
  byId.set(r.id, r);
}
for (const [bankId, name] of CARDS) {
  const b = byId.get(bankId)!;
  byId.set(`${bankId}-cc`, { ...b, id: `${bankId}-cc`, name, group: "credit" });
}

/** Logos that are reused by more than one entry share a file. */
const SHARED_LOGO: Record<string, string> = { mayabank: "maya", gsave: "gcash", ggives: "gcash", mayacredit: "maya", spaylater: "shopeepay", lazpaylater: "lazadawallet" };
for (const [id, logo] of Object.entries(SHARED_LOGO)) {
  const i = byId.get(id);
  if (i) i.logo = logo;
}

export const INSTITUTIONS: Institution[] = [...byId.values()];
/** Renamed institutions, so accounts saved under an old id keep their logo. */
const RENAMED: Record<string, string> = { seabank: "maribank" };
export const getInst = (id?: string) => (id ? byId.get(RENAMED[id] ?? id) : undefined);

/** Best guess for an account typed by name, e.g. "BPI Savings" → BPI. */
export function guessInst(name: string, kind?: AccKind): Institution | undefined {
  const low = name.toLowerCase();
  const wantCredit = kind === "credit" || /credit|visa|mastercard|card/.test(low);
  const pool = INSTITUTIONS.filter((i) => (wantCredit ? i.group === "credit" || i.group === "bnpl" : i.group !== "credit" && i.group !== "bnpl"));
  if (/seabank/.test(low)) return getInst("maribank");
  return (
    pool.find((i) => low === i.name.toLowerCase()) ??
    pool.find((i) => new RegExp(`\\b${i.id.replace(/-cc$/, "")}\\b`).test(low)) ??
    pool.find((i) => {
      const first = i.name.toLowerCase().split(" ")[0];
      return first !== "bank" && first.length > 2 && low.includes(first);
    })
  );
}
