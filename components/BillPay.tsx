"use client";

import { FormEvent, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { UpcomingItem } from "@/lib/stats";
import { accCurrency, activeAccounts } from "@/lib/stats";
import { billMatch } from "@/lib/bills";
import { fmtIn, shortDate } from "@/lib/format";
import { Modal } from "./Sheet";
import MoneyInput from "./MoneyInput";

/**
 * "Mark paid" / "Mark received": confirm what was really paid (amount, account, date) before it's logged.
 * If an entry you already logged looks like this bill, offers to link it instead of adding a second one.
 */
export default function BillPay({ ctx, u, onClose }: { ctx: Ctx; u: UpcomingItem; onClose: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const p = u.item;
  const income = p.type === "income";
  const cur = accCurrency(state, p.acc);
  const match = billMatch(state, u);
  const accounts = activeAccounts(state);
  const [amount, setAmount] = useState(String(p.amount));
  const [acc, setAcc] = useState(accounts.some((a) => a.id === p.acc) ? p.acc : accounts[0]?.id ?? "");
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const [day, setDay] = useState(todayStr);
  const month = u.due.toLocaleDateString("en-PH", { month: "long" });
  const verb = income ? "received" : "paid";

  const logged = () => {
    const [y, m, d] = day.split("-").map(Number);
    const now = new Date();
    return new Date(y, m - 1, d, now.getHours(), now.getMinutes()).getTime();
  };

  function undoer() {
    return () => k.undoPlannedDone(p.id, u.key);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount) || 0;
    if (!(value > 0) || !acc) return;
    k.markPlannedDone(p.id, u.key, { amount: value, acc, date: logged() });
    toast(`${p.name} ${verb} for ${month}`, undoer());
    onClose();
  }

  function link() {
    if (!match) return;
    k.markPlannedDone(p.id, u.key, { link: match.id });
    toast(`Linked your ${fmtIn(match.amount, accCurrency(state, match.acc))} ${p.name} to the bill`, undoer());
    onClose();
  }

  return (
    <Modal title={income ? "Mark received" : "Mark paid"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div>
          <b>{p.name}</b>
          <div className="sub">
            For {month} · expected {fmtIn(p.amount, cur)}
          </div>
        </div>

        {match && (
          <div className="card" style={{ background: "var(--accent-soft)", padding: 12 }}>
            <b>Is this your {p.name} {income ? "income" : "bill"}?</b>
            <p className="sub" style={{ margin: "4px 0 8px" }}>
              You logged {fmtIn(match.amount, accCurrency(state, match.acc))} on {shortDate(match.date)}. Link it instead of adding it again.
            </p>
            <button type="button" className="btn sm" onClick={link}>
              Yes, link it
            </button>
          </div>
        )}

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {income ? "How much came in?" : "How much did you pay?"}
          </div>
          <MoneyInput value={amount} onChange={setAmount} placeholder="0" currency={cur} required />
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {income ? "Into which account?" : "Paid from"}
          </div>
          <div className="chips wrap" role="radiogroup" aria-label="Account">
            {accounts.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={acc === a.id} className="chip" aria-pressed={acc === a.id} onClick={() => setAcc(a.id)}>
                {a.name}
              </button>
            ))}
          </div>
        </div>

        <label>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Date
          </div>
          <input type="date" value={day} max={todayStr} required onChange={(e) => setDay(e.target.value)} />
        </label>

        <button className="btn wide" type="submit">
          {income ? "Mark received" : "Mark paid"}
        </button>
      </form>
    </Modal>
  );
}
