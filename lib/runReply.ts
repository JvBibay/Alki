import type { Ctx } from "./ui";
import type { Reply } from "./assistant";
import type { Intent } from "./intents";
import type { ParsedTx, Tx } from "./types";
import { uid } from "./store";
import { fmt, fmtIn, shortDate } from "./format";
import { accCurrency } from "./stats";

type K = Ctx["k"];

/** What was done, so the screen can show it and offer Undo. */
export interface Card {
  title: string;
  amount: string;
  rows: string[];
  undo: () => void;
  undone?: boolean;
}

const dayText = (ts: number) => (new Date(ts).toDateString() === new Date().toDateString() ? "today" : shortDate(ts));

/**
 * Does what Alki understood (log an entry, pay a bill, split, settle, several entries) and returns a card
 * for each thing done. `getK` is read when undoing, so Undo always sees the latest state.
 */
export function runReply(getK: () => K, r: { tx?: ParsedTx; intent?: Intent; hint?: string }): Card[] {
  const k = getK();
  const name = (id?: string) => k.state.accounts.find((a) => a.id === id)?.name ?? "";

  const txCard = (tx: Tx, hint?: string): Card => ({
    title: tx.note,
    amount: fmtIn(tx.amount, accCurrency(k.state, tx.acc)),
    rows:
      tx.type === "transfer"
        ? [`Transfer · ${name(tx.acc)} → ${name(tx.to)} · ${dayText(tx.date)}`]
        : [`${tx.cat} · ${tx.type === "income" ? "into" : "from"} ${name(tx.acc)}${hint ? ` (${hint})` : ""} · ${dayText(tx.date)}`],
    undo: () => getK().removeTx(tx.id),
  });

  if (r.tx) return [txCard(k.addTx(r.tx), r.hint)];
  const i = r.intent;
  if (!i || i.kind === "say") return [];
  if (i.kind === "multi") return i.txs.map((p, n) => txCard(k.addTx(p), i.hints[n]));
  if (i.kind === "bill") {
    const { item } = i.item;
    k.markPlannedDone(item.id, i.item.key, { amount: i.amount, acc: i.acc, date: i.date });
    const month = i.item.due.toLocaleDateString("en-PH", { month: "long" });
    return [
      {
        title: item.name,
        amount: fmtIn(i.amount, accCurrency(k.state, i.acc)),
        rows: [`${item.type === "income" ? "Received" : "Paid"} for ${month} · ${item.type === "income" ? "into" : "from"} ${name(i.acc)} · ${dayText(i.date)}`],
        undo: () => getK().undoPlannedDone(item.id, i.item.key),
      },
    ];
  }
  if (i.kind === "split") {
    const id = k.addSplit({ title: i.title, total: i.total, myShare: i.myShare, cat: i.cat, acc: i.acc, people: i.people }, true);
    return [
      {
        title: `Split · ${i.title}`,
        amount: fmtIn(i.total, accCurrency(k.state, i.acc)),
        rows: [`Your share ${fmt(i.myShare)} (${i.cat}) · paid from ${name(i.acc)}`, `Owed to you: ${i.people.map((p) => `${p.name} ${fmt(p.share)}`).join(", ")}`],
        undo: () => getK().undoSplit(id),
      },
    ];
  }
  // settle
  const paid = i.pays.map((p) => ({ ...p, payId: uid() }));
  for (const p of paid) k.payDebt(p.debtId, p.amount, i.acc, p.payId);
  const total = paid.reduce((s, p) => s + p.amount, 0);
  return [
    {
      title: i.direction === "owe" ? `Paid ${i.person}` : `${i.person} paid you`,
      amount: fmt(total),
      rows: [`${i.direction === "owe" ? "From" : "Into"} ${name(i.acc)} · counts as a settlement, not spending`],
      undo: () => paid.forEach((p) => getK().removeDebtPayment(p.debtId, p.payId)),
    },
  ];
}

export type { Reply };
