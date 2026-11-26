"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { Account } from "@/lib/types";
import { payOptions } from "@/lib/cards";
import { activeAccounts, balance, baseCurrency } from "@/lib/stats";
import { fmtIn } from "@/lib/format";
import { Modal } from "./Sheet";
import BankLogo from "./BankLogo";
import CardPic from "./CardPic";
import MoneyInput from "./MoneyInput";
import Icon from "./Icon";
import { accountCard } from "@/lib/cardart";

const shortDate = (ts: number) => new Date(ts).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pay a credit card: how much, and which of your accounts the money comes out of. Every account shows its balance,
 * and a summary shows what each side will look like afterwards, so you can see the money move before you confirm.
 */
export default function PayCard({ ctx, card, onClose }: { ctx: Ctx; card: Account; onClose: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const cur = card.currency || baseCurrency(state);
  const o = payOptions(state, card);
  const c = o.cycle;
  const sources = activeAccounts(state).filter((a) => a.kind !== "credit");
  const [amount, setAmount] = useState(o.suggested > 0 ? String(o.suggested) : "");

  // Start from the account you last paid a card with, then your default account, rather than whichever is first in the list.
  const lastSource = [...state.txs]
    .sort((a, b) => b.date - a.date)
    .find((t) => t.type === "transfer" && state.accounts.find((a) => a.id === t.to)?.kind === "credit" && sources.some((s) => s.id === t.acc))?.acc;
  const first = lastSource ?? sources.find((s) => s.id === state.defAcc)?.id ?? sources[0]?.id ?? "";
  const [from, setFrom] = useState(first);
  // When it was paid: usually today, but people often log it a day later or after the fact.
  const [day, setDay] = useState<"today" | "yesterday" | "other">("today");
  const [other, setOther] = useState("");
  const paidOn = () => {
    const now = new Date();
    if (day === "yesterday") return now.getTime() - 86_400_000;
    if (day === "other" && other) {
      const [y, m, d] = other.split("-").map(Number);
      return new Date(y, m - 1, d, now.getHours(), now.getMinutes()).getTime();
    }
    return now.getTime();
  };
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  // Accounts in a sensible order: the suggested one first.
  const ordered = useMemo(() => [...sources].sort((a, b) => Number(b.id === first) - Number(a.id === first)), [sources, first]);

  const value = parseFloat(amount) || 0;
  const src = sources.find((a) => a.id === from);
  const srcCur = src?.currency || baseCurrency(state);
  const srcBal = src ? balance(state, src) : 0;
  const srcAfter = r2(srcBal - value);
  const owedAfter = Math.max(0, r2(o.used - value));
  const over = value > o.used + 0.005;

  function pay(e: FormEvent) {
    e.preventDefault();
    if (!(value > 0) || !from) return;
    k.addTx({ type: "transfer", amount: value, cat: "Transfer", note: `Payment · ${card.name}`, acc: from, to: card.id, date: paidOn() });
    const from_ = src?.name ?? "your account";
    toast(
      value >= o.used - 0.005 && o.used > 0
        ? `💳 ${card.name} paid off from ${from_} ✅`
        : c && c.left > 0 && value >= c.left - 0.005
          ? `💳 Statement paid from ${from_} ✅`
          : `💳 Paid ${fmtIn(value, srcCur)} from ${from_} to ${card.name}`,
    );
    onClose();
  }

  const chip = (label: string, n: number) => (
    <button type="button" className="chip" aria-pressed={Math.abs(value - n) < 0.005} onClick={() => setAmount(String(n))}>
      {label} {fmtIn(n, cur)}
    </button>
  );

  const art = accountCard(card);

  return (
    <Modal title="Pay card" onClose={onClose}>
      <form className="form" onSubmit={pay}>
        {/* ---- the card, and what it owes ---- */}
        <div className="pc-hero" style={{ ["--account-color" as string]: card.color }}>
          <div className="pc-top">
            {art ? <CardPic art={art} w={72} className="rowcard" /> : <BankLogo account={card} size={44} />}
            <div className="pc-name">
              <b>{card.name}</b>
              <small>{c ? `${c.status === "overdue" ? "Overdue since" : "Due"} ${shortDate(c.dueDate)}` : "Set the statement and due days to see what’s due"}</small>
            </div>
          </div>
          <div className="pc-owes">
            <span>Owes right now</span>
            <b className="num">{fmtIn(o.used, cur)}</b>
          </div>
          {c && (
            <div className="pc-meta">
              <span>
                Statement of {shortDate(c.statementDate)}: <b className="num">{fmtIn(c.statementBalance, cur)}</b>
              </span>
              {c.paidSince > 0 && (
                <span>
                  Paid since: <b className="num">{fmtIn(c.paidSince, cur)}</b>
                </span>
              )}
            </div>
          )}
        </div>
        {c && c.statementBalance <= 0 && o.used > 0 && (
          <p className="hint" style={{ marginTop: -4 }}>
            Nothing is due on the last statement. The {fmtIn(o.used, cur)} is new spending that will be on your next one, and you can pay it now.
          </p>
        )}

        {/* ---- how much ---- */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            How much?
          </div>
          <div className="pc-amount">
            <MoneyInput value={amount} onChange={setAmount} placeholder="0" currency={cur} required />
          </div>
          <div className="chips" style={{ marginTop: 10 }}>
            {o.used > 0 && chip("Everything", o.used)}
            {o.left > 0 && Math.abs(o.left - o.used) > 0.005 && chip("Statement", o.left)}
            {o.minLeft > 0 && o.minLeft < o.left && chip("Minimum", o.minLeft)}
          </div>
          {over && (
            <p className="warnt" style={{ marginTop: 8 }}>
              That’s more than the card owes ({fmtIn(o.used, cur)}). The extra stays as credit on the card.
            </p>
          )}
        </div>

        {/* ---- which account ---- */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Pay from
          </div>
          <div className="pc-accs" role="radiogroup" aria-label="Pay from">
            {ordered.map((a) => {
              const bal = balance(state, a);
              const acur = a.currency || baseCurrency(state);
              const picked = from === a.id;
              return (
                <button key={a.id} type="button" className="pc-acc" role="radio" aria-checked={picked} aria-pressed={picked} onClick={() => setFrom(a.id)}>
                  <BankLogo account={a} size={36} />
                  <span className="main">
                    <b>{a.name}</b>
                    <small className={bal < value && picked ? "warnt" : undefined}>{fmtIn(bal, acur)} balance</small>
                  </span>
                  <span className="pc-radio" aria-hidden="true">
                    {picked && <Icon name="check" size={14} stroke={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pc-dock">
          {/* ---- when ---- */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Paid on
          </div>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={day === "today"} onClick={() => setDay("today")}>
              Today
            </button>
            <button type="button" className="chip" aria-pressed={day === "yesterday"} onClick={() => setDay("yesterday")}>
              Yesterday
            </button>
            <button type="button" className="chip" aria-pressed={day === "other"} onClick={() => setDay("other")}>
              Another day
            </button>
          </div>
          {day === "other" && (
            <input type="date" value={other} max={todayStr} onChange={(e) => setOther(e.target.value)} aria-label="Date you paid" style={{ marginTop: 8 }} />
          )}
        </div>

        {/* ---- what will happen ---- */}
          {value > 0 && src && (
            <div className="pc-sum" role="status" aria-live="polite">
              <div className="pc-line">
                <span>{src.name}</span>
                <span className="num">
                  {fmtIn(srcBal, srcCur)} <Icon name="send" size={14} /> <b className={srcAfter < 0 ? "warnt" : undefined}>{fmtIn(srcAfter, srcCur)}</b>
                </span>
              </div>
              <div className="pc-line">
                <span>{card.name}</span>
                <span className="num">
                  owes {fmtIn(o.used, cur)} <Icon name="send" size={14} /> <b>{fmtIn(owedAfter, cur)}</b>
                </span>
              </div>
              {srcAfter < 0 && <p className="warnt">This takes {src.name} below zero. Check you picked the right account, or add money to it first.</p>}
            </div>
          )}

          <button className="btn" type="submit" disabled={!from || !(value > 0)}>
            <Icon name="check" size={18} /> {value > 0 ? `Pay ${fmtIn(value, srcCur)}${src ? ` from ${src.name}` : ""}` : "Enter an amount"}
          </button>
        </div>
        {c && c.left > 0 && (
          <div>
            <button
              type="button"
              className="link"
              onClick={() => {
                k.markCardPaid(card.id, c.key);
                toast(`Marked ${card.name} as paid for this statement`);
                onClose();
              }}
            >
              Paid from an account that isn’t in Kwenta? Mark as paid
            </button>
            <p className="hint" style={{ marginTop: 4 }}>
              This clears the statement but doesn’t change any of your balances. If you paid from one of your accounts here, use the Pay button above so its balance stays right.
            </p>
          </div>
        )}
        <p className="hint">Paying the full statement balance avoids interest (up to 3% a month). The minimum avoids late fees but interest still applies. Check your bank’s statement for exact amounts.</p>
      </form>
    </Modal>
  );
}
