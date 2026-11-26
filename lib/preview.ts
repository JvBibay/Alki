import type { Account, State, Tx, TxType } from "./types";
import { balance } from "./stats";
import { effectOn } from "./reconcile";

export interface PreviewLine {
  acc: Account;
  /** What the account shows now (a card shows what you owe), without the entry being edited. */
  before: number;
  after: number;
  /** "out" lowers what you have (or raises what you owe on a card); "in" is the reverse. */
  dir: "in" | "out";
}

export interface PreviewInput {
  type: TxType;
  amount: number;
  acc: string;
  to?: string;
  /** Cross-currency transfers: what arrives in the receiving account. */
  toAmount?: number;
  track?: boolean;
  /** A transfer fee, charged to the account the money leaves. */
  fee?: number;
}

const round = (n: number) => Math.round(n * 100) / 100;
const shown = (a: Account, bal: number) => round(a.kind === "credit" ? -bal : bal);

/**
 * Before and after for every account an entry would touch, so From → To and the effect are clear before saving.
 * Pass `edit` (the entry being corrected) so its old effect isn't counted twice. Track-only entries return nothing.
 */
export function previewEffect(state: State, input: PreviewInput, edit?: Tx): PreviewLine[] {
  if (input.track && input.type !== "transfer") return [];
  if (!(input.amount > 0)) return [];
  const draft: Tx = { id: "draft", cat: "", note: "", date: 0, type: input.type, amount: input.amount, acc: input.acc, to: input.to, toAmount: input.toAmount };
  const ids = input.type === "transfer" ? [input.acc, input.to] : [input.acc];
  const lines: PreviewLine[] = [];
  for (const id of ids) {
    const a = state.accounts.find((x) => x.id === id);
    if (!a || lines.some((l) => l.acc.id === a.id)) continue;
    const base = balance(state, a) - (edit ? effectOn(edit, a.id) : 0);
    const delta = effectOn(draft, a.id) - (input.type === "transfer" && a.id === input.acc ? Math.max(0, input.fee ?? 0) : 0);
    lines.push({ acc: a, before: shown(a, base), after: shown(a, base + delta), dir: delta >= 0 ? "in" : "out" });
  }
  return lines;
}
