"use client";

import { FormEvent, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { Account } from "@/lib/types";
import { cardCycle } from "@/lib/cards";
import { baseCurrency } from "@/lib/stats";
import { fmtIn } from "@/lib/format";
import { Modal } from "./Sheet";
import MoneyInput from "./MoneyInput";

const shortDate = (ts: number) => new Date(ts).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

/**
 * "Your statement is out": compare Kwenta's estimate with the bank's statement and keep the bank's figure, so the
 * amount to pay (and the minimum) is exact instead of estimated.
 */
export default function StatementFix({ ctx, card, onClose }: { ctx: Ctx; card: Account; onClose: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const cur = card.currency || baseCurrency(state);
  // The estimate without any figure typed earlier, and the cycle as it stands.
  const est = cardCycle(state, { ...card, stmtFix: undefined });
  const [value, setValue] = useState(est ? String(est.statementBalance) : "");
  if (!est) return null;
  const typed = parseFloat(value);
  const valid = Number.isFinite(typed) && typed >= 0;
  const diff = valid ? Math.round((typed - est.statementBalance) * 100) / 100 : 0;
  // What the minimum and the amount still to pay would be with this figure.
  const preview = valid ? cardCycle(state, { ...card, stmtFix: { key: est.key, amount: typed } }) : null;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    k.updateAccount(card.id, { stmtFix: { key: est!.key, amount: typed } });
    toast(diff === 0 ? "Statement confirmed" : `Statement set to ${fmtIn(typed, cur)}`);
    onClose();
  }

  return (
    <Modal title={`${card.name} statement`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="sub">
          Statement date <b>{shortDate(est.statementDate)}</b> · payment due <b>{shortDate(est.dueDate)}</b>
        </p>
        <p className="sub">
          Kwenta estimates <b>{fmtIn(est.statementBalance, cur, true)}</b> from what you logged. Check it against your bank’s statement.
        </p>
        <label>
          Statement balance from your bank
          <MoneyInput value={value} onChange={setValue} currency={cur} placeholder="0" />
        </label>
        {valid && diff !== 0 && (
          <p className="sub">
            {diff > 0 ? "Your bank shows more than Kwenta" : "Your bank shows less than Kwenta"} by <b>{fmtIn(Math.abs(diff), cur, true)}</b>. Something may be missing or wrong in your entries. This only sets the amount to pay; it doesn’t change the balance or add an entry.
          </p>
        )}
        {preview && (
          <p className="sub">
            Minimum due <b>{fmtIn(preview.minDue, cur, true)}</b> · still to pay <b>{fmtIn(preview.left, cur, true)}</b>
          </p>
        )}
        <button className="btn" type="submit" disabled={!valid}>
          {diff === 0 ? "Looks right, confirm" : "Use my bank’s figure"}
        </button>
      </form>
    </Modal>
  );
}
