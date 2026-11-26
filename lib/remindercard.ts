import type { Account, Debt, State } from "./types";
import { debtLeft } from "./debts";
import { greetingName, type PersonSummary } from "./people";

/**
 * A shareable payment-reminder card: what someone still owes you, a short message, and (optionally)
 * your payment details and your own payment QR. It's drawn on a canvas so it can be shared as a
 * picture. Nothing is uploaded: the image is made on this device and handed to the share sheet.
 */

export interface CardItem {
  label: string;
  sub?: string;
  amount: string;
  /** A line that reduces the total (something you owe them). */
  negative?: boolean;
}

export interface CardContent {
  items: CardItem[];
  /** How many more items didn't fit on the card. */
  more: number;
  total: string;
}

export const MAX_ITEMS = 5;

/**
 * The lines for a card, or null when the person doesn't owe you overall (then there's nothing to
 * ask for, so a card makes no sense).
 */
export function reminderContent(
  p: PersonSummary,
  fmt: (n: number) => string,
  dateText: (ts: number) => string,
  splitTitle?: (d: Debt) => string | undefined,
): CardContent | null {
  if (!(p.net > 0)) return null;
  // What they owe first, then anything you owe them (shown as a reduction).
  const open = [...p.open].sort((a, b) => Number(b.direction === "owed") - Number(a.direction === "owed") || a.created - b.created);
  const rows: CardItem[] = open.map((d) => {
    const left = debtLeft(d);
    const owed = d.direction === "owed";
    return {
      label: d.note || splitTitle?.(d) || (owed ? "Utang" : "What I owe you"),
      sub: owed ? (d.due ? `Due ${dateText(d.due)}` : dateText(d.created)) : "Taken off your total",
      amount: `${owed ? "" : "−"}${fmt(left)}`,
      negative: !owed,
    };
  });
  return { items: rows.slice(0, MAX_ITEMS), more: Math.max(0, rows.length - MAX_ITEMS), total: fmt(p.net) };
}

/** Keeps only what belongs in an account number: digits, spaces and dashes. Returns undefined if there aren't at least 4 digits. */
export function cleanNumber(n: string): string | undefined {
  const t = n.replace(/[^\d\s-]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
  return t.replace(/\D/g, "").length >= 4 ? t : undefined;
}

/** Easier to read and copy: "09171234567" → "0917 123 4567", "012345678901" → "0123 4567 8901". Numbers typed with spaces or dashes are left as typed. */
export function prettyNumber(n: string): string {
  const t = n.trim();
  if (/[\s-]/.test(t)) return t.replace(/\s+/g, " ");
  if (/^09\d{9}$/.test(t)) return `${t.slice(0, 4)} ${t.slice(4, 7)} ${t.slice(7)}`;
  if (/^\d{9,}$/.test(t)) return t.replace(/(\d{4})(?=\d)/g, "$1 ");
  return t;
}

/** Hides all but the last 4 digits, keeping the spacing: "0123 4567 8901" → "•••• •••• 8901". */
export function maskNumber(n: string): string {
  const total = n.replace(/\D/g, "").length;
  if (total <= 4) return n;
  let seen = 0;
  return n.replace(/\d/g, (c) => (++seen <= total - 4 ? "•" : c));
}

/** Accounts someone could be asked to pay into: not cards, not locked savings, not archived. */
export const payableAccounts = (state: State): Account[] => state.accounts.filter((a) => !a.archived && a.kind !== "credit" && a.kind !== "locked");

/** What an account already has saved for getting paid ("QR · number saved"), or "Not set up". */
export function payStatus(a: Account): string {
  const parts: string[] = [];
  if (a.payQr) parts.push("QR");
  if (a.payNumber) parts.push("number");
  if (a.payName) parts.push("name");
  if (a.payInfo?.trim()) parts.push("details");
  return parts.length ? `${parts.join(" · ")} saved` : "Not set up";
}

/** One way to get paid: an account's payment details and QR, or the default ones from Settings. */
export interface PayMethod {
  id: string;
  label: string;
  /** The name on the account. */
  name?: string;
  /** The account number. */
  number?: string;
  info?: string;
  qr?: string;
  /** The bank or app, for the logo above the QR. */
  instId?: string;
  /** The account, when it's an account's own details (for its logo in the picker). */
  account?: Account;
}

/** Everything someone could be asked to pay into: accounts that have details or a QR, then the default ones. */
export function payMethods(state: State): PayMethod[] {
  const out: PayMethod[] = state.accounts
    .filter((a) => !a.archived && (a.payInfo?.trim() || a.payQr || a.payNumber || a.payName))
    .map((a) => ({ id: a.id, label: a.name, name: a.payName, number: a.payNumber, info: a.payInfo?.trim() || undefined, qr: a.payQr, instId: a.inst, account: a }));
  const s = state.settings;
  if (s.payInfo?.trim() || s.payQr) out.push({ id: "default", label: "Other details", info: s.payInfo?.trim() || undefined, qr: s.payQr, instId: s.payQrBank });
  return out;
}

/** Which method to pre-select: the account the money was lent from if it has details, else the first one. "" if none. */
export function defaultMethod(methods: PayMethod[], p: PersonSummary): string {
  for (const d of p.open) {
    if (d.direction !== "owed" || !d.acc) continue;
    const m = methods.find((x) => x.id === d.acc);
    if (m) return m.id;
  }
  return methods[0]?.id ?? "";
}

/** What the text version says about where to pay. */
export interface PayText {
  bank?: string;
  name?: string;
  number?: string;
  info?: string;
}

/** The plain-text version, for chats where a picture isn't wanted. */
export function reminderText(to: string, c: CardContent, message: string, pay?: PayText): string {
  const lines = [`Hi ${greetingName(to)}!`, message.trim()].filter(Boolean);
  for (const it of c.items) lines.push(`• ${it.label}: ${it.amount}`);
  if (c.more > 0) lines.push(`• …and ${c.more} more`);
  lines.push(`Total: ${c.total}`);
  const where: string[] = [];
  if (pay?.bank) where.push(`Bank/app: ${pay.bank}`);
  if (pay?.name) where.push(`Account name: ${pay.name}`);
  if (pay?.number) where.push(`Account no.: ${pay.number}`);
  if (pay?.info?.trim()) where.push(pay.info.trim());
  if (where.length) lines.push("You can send it here:", ...where, "Salamat!");
  lines.push("— sent from Kwenta");
  return lines.join("\n");
}

// ---------------------------------------------------------------- drawing (browser only)

export interface CardStyle {
  /** Header color and accent, from the chosen palette (light-mode values, so the card always reads well). */
  band: string;
  accent: string;
  /** Alki as SVG markup, or empty to leave him out. */
  alki?: string;
}

/** The bank or app a QR belongs to, shown above it like on the bank's own screen. */
export interface CardBank {
  name: string;
  short: string;
  color: string;
  /** A logo picture on this site, if there is one. */
  logoUrl?: string;
}

export interface CardInput extends CardContent {
  to: string;
  from: string;
  message: string;
  /** The name on the account and its number (already formatted or hidden as the user chose). */
  payName?: string;
  payNumber?: string;
  payInfo?: string;
  /** The user's own payment QR, as a data URL. */
  qr?: string;
  bank?: CardBank;
  style: CardStyle;
}

const W = 1080;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const INK = "#16191a";
const MUTED = "#5b6670";
const LINE = "#e6ebe8";

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]) {
  const [tl, tr, br, bl] = typeof r === "number" ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The bank's logo and name, centred on (cx, cy) like the header of a bank's own QR screen. */
async function drawBank(ctx: CanvasRenderingContext2D, b: CardBank, cx: number, cy: number, maxW: number, left = false) {
  const LOGO = 56;
  const img = b.logoUrl ? await loadImage(b.logoUrl) : null;
  ctx.font = `800 32px ${FONT}`;
  let name = b.name;
  const room = maxW - LOGO - 16;
  while (ctx.measureText(name).width > room && name.length > 4) name = name.slice(0, -2);
  if (name !== b.name) name += "…";
  const textW = ctx.measureText(name).width;
  const total = LOGO + 16 + textW;
  const x = left ? cx : cx - total / 2;
  if (img) {
    // Keep the logo's shape inside a rounded square.
    ctx.save();
    rr(ctx, x, cy - LOGO / 2, LOGO, LOGO, 14);
    ctx.clip();
    const s = Math.max(LOGO / img.width, LOGO / img.height);
    ctx.drawImage(img, x + (LOGO - img.width * s) / 2, cy - LOGO / 2 + (LOGO - img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  } else {
    ctx.fillStyle = b.color;
    rr(ctx, x, cy - LOGO / 2, LOGO, LOGO, 14);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `800 24px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(b.short.slice(0, 3), x + LOGO / 2, cy + 9);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = INK;
  ctx.font = `800 32px ${FONT}`;
  ctx.fillText(name, x + LOGO + 16, cy + 11);
}

/** Draws the card and returns its canvas. The height fits the content. */
export async function drawReminderCard(d: CardInput): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const probe = canvas.getContext("2d")!;
  const M = 54; // outer margin
  const PAD = 54; // inside the white card
  const innerW = W - 2 * M - 2 * PAD;
  const HEADER = 380;
  const cardY = 330;

  // ---- measure
  probe.font = `500 36px ${FONT}`;
  const msgLines = wrap(probe, d.message, innerW);
  const hasQr = !!d.qr;
  const rows: { label: string; value: string }[] = [];
  if (d.payName?.trim()) rows.push({ label: "Account name", value: d.payName.trim() });
  if (d.payNumber?.trim()) rows.push({ label: "Account no.", value: d.payNumber.trim() });
  const info = d.payInfo?.trim() ?? "";
  const hasPay = hasQr || !!info || rows.length > 0;
  // With a QR the bank's logo and name sit on the QR panel; without one they get a row of their own.
  const bankRow = !!d.bank && !hasQr && hasPay;
  const QR = 700; // the QR panel is wide, so a dense bank code stays easy to scan from a chat picture
  const HH = d.bank && hasQr ? 90 : 0;
  probe.font = `700 40px ${FONT}`;
  const payLines = info ? wrap(probe, info, innerW) : [];
  probe.font = `500 32px ${FONT}`;
  const hint = hasQr && !payLines.length && !rows.length ? wrap(probe, "Open your bank or e-wallet app and scan the QR.", innerW) : [];
  const BANKROW = 84;
  const ACCROW = 98;
  const textBottom = 40 + (bankRow ? BANKROW : 0) + rows.length * ACCROW + payLines.length * 52 + hint.length * 44 + 14;
  const payH = hasPay ? 50 + textBottom + (hasQr ? 28 + HH + QR : 0) : 0;

  const ROW = 96;
  let h = PAD + 76; // greeting
  h += msgLines.length * 50 + 24;
  h += d.items.length * ROW + (d.more > 0 ? 56 : 0) + 20;
  h += 200 + 30; // total
  h += payH;
  h += PAD;
  const cardH = h;
  const H = cardY + cardH + 150;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";

  // ---- background and header
  ctx.fillStyle = "#f3f6f4";
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, HEADER);
  g.addColorStop(0, d.style.accent);
  g.addColorStop(1, d.style.band);
  ctx.fillStyle = g;
  rr(ctx, 0, 0, W, HEADER + 40, [0, 0, 64, 64]);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.beginPath();
  ctx.arc(W - 90, 40, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(90, HEADER + 10, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `800 74px ${FONT}`;
  ctx.fillText("Friendly reminder", 72, 150);
  ctx.font = `600 36px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,.88)";
  ctx.fillText(d.from.trim() ? `from ${d.from.trim()}` : "sent with Kwenta", 72, 214);

  // ---- the white card
  ctx.save();
  ctx.shadowColor = "rgba(16,24,20,.16)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#fff";
  rr(ctx, M, cardY, W - 2 * M, cardH, 44);
  ctx.fill();
  ctx.restore();

  // Alki peeks over the card's top edge
  if (d.style.alki) {
    const url = URL.createObjectURL(new Blob([d.style.alki], { type: "image/svg+xml" }));
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    if (img) {
      const size = 232;
      const ih = (size * 140) / 120;
      ctx.drawImage(img, W - M - 40 - size, cardY - ih + 40, size, ih);
    }
  }

  const x0 = M + PAD;
  let y = cardY + PAD + 56;
  ctx.fillStyle = INK;
  const hi = `Hi ${greetingName(d.to)}!`;
  let hiSize = 60;
  ctx.font = `800 ${hiSize}px ${FONT}`;
  while (ctx.measureText(hi).width > innerW && hiSize > 34) {
    hiSize -= 2;
    ctx.font = `800 ${hiSize}px ${FONT}`;
  }
  ctx.fillText(hi, x0, y);
  y += 20;
  ctx.fillStyle = MUTED;
  ctx.font = `500 36px ${FONT}`;
  for (const line of msgLines) {
    y += 50;
    ctx.fillText(line, x0, y);
  }
  y += 24;

  // ---- the items
  const xr = x0 + innerW;
  d.items.forEach((it, i) => {
    const top = y + i * ROW;
    ctx.fillStyle = INK;
    ctx.font = `700 40px ${FONT}`;
    ctx.textAlign = "left";
    let label = it.label;
    while (ctx.measureText(label).width > innerW - 280 && label.length > 4) label = label.slice(0, -2);
    if (label !== it.label) label += "…";
    ctx.fillText(label, x0, top + 40);
    if (it.sub) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 29px ${FONT}`;
      ctx.fillText(it.sub, x0, top + 78);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = it.negative ? "#c2410c" : INK;
    ctx.font = `800 42px ${FONT}`;
    ctx.fillText(it.amount, xr, top + 50);
    ctx.textAlign = "left";
    ctx.fillStyle = LINE;
    ctx.fillRect(x0, top + ROW - 4, innerW, 2);
  });
  y += d.items.length * ROW;
  if (d.more > 0) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 31px ${FONT}`;
    ctx.fillText(`+ ${d.more} more item${d.more === 1 ? "" : "s"} included in the total`, x0, y + 40);
    y += 56;
  }
  y += 20;

  // ---- the total
  ctx.fillStyle = d.style.accent + "1f";
  rr(ctx, x0, y, innerW, 200, 32);
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.font = `700 31px ${FONT}`;
  ctx.fillText("TOTAL TO PAY", x0 + 40, y + 62);
  ctx.fillStyle = d.style.accent;
  ctx.font = `900 100px ${FONT}`;
  let size = 100;
  while (ctx.measureText(d.total).width > innerW - 80 && size > 50) {
    size -= 4;
    ctx.font = `900 ${size}px ${FONT}`;
  }
  ctx.fillText(d.total, x0 + 40, y + 160);
  y += 200 + 30;

  // ---- how to pay
  if (hasPay) {
    ctx.fillStyle = LINE;
    ctx.fillRect(x0, y, innerW, 2);
    y += 50;
    ctx.fillStyle = INK;
    ctx.font = `800 38px ${FONT}`;
    ctx.fillText(hasQr ? "Scan to pay" : "How to pay", x0, y + 16);
    let cy = y + 40;
    if (bankRow) {
      await drawBank(ctx, d.bank!, x0, cy + 36, innerW, true);
      cy += BANKROW;
    }
    for (const r of rows) {
      ctx.fillStyle = MUTED;
      ctx.font = `600 28px ${FONT}`;
      ctx.fillText(r.label, x0, cy + 26);
      ctx.fillStyle = INK;
      let size = 46;
      ctx.font = `800 ${size}px ${FONT}`;
      while (ctx.measureText(r.value).width > innerW && size > 28) {
        size -= 2;
        ctx.font = `800 ${size}px ${FONT}`;
      }
      ctx.fillText(r.value, x0, cy + 76);
      cy += ACCROW;
    }
    ctx.fillStyle = INK;
    ctx.font = `700 40px ${FONT}`;
    payLines.forEach((line, i) => ctx.fillText(line, x0, cy + 42 + i * 52));
    cy += payLines.length * 52;
    if (hint.length) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 32px ${FONT}`;
      hint.forEach((l, i) => ctx.fillText(l, x0, cy + 34 + i * 44));
    }
    if (hasQr) {
      // The QR gets its own wide panel under the text, with the bank's logo and name on top.
      const top = y + textBottom + 28;
      const qx = x0 + (innerW - QR) / 2;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 4;
      rr(ctx, qx, top, QR, QR + HH, 32);
      ctx.fill();
      ctx.stroke();
      if (d.bank) await drawBank(ctx, d.bank, qx + QR / 2, top + HH / 2 + 8, QR - 60);
      const img = await loadImage(d.qr!);
      if (img) {
        const box = QR - 44;
        const s = Math.min(box / img.width, box / img.height);
        const w = img.width * s;
        const hh = img.height * s;
        ctx.drawImage(img, qx + (QR - w) / 2, top + HH + (QR - hh) / 2, w, hh);
      }
    }
  }

  // ---- footer
  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = `600 32px ${FONT}`;
  ctx.fillText("Sent with Kwenta", W / 2, H - 70);
  ctx.textAlign = "left";
  return canvas;
}
