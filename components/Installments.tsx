"use client";

import { FormEvent, useMemo, useState } from "react";
import { catColor, catEmoji, catNames } from "@/lib/categories";
import type { Ctx } from "@/lib/ui";
import type { Account, Installment } from "@/lib/types";
import { BSP_CAP, KIND_TEXT, programsFor, quote, rateFor, RATES_AS_OF, type Program } from "@/lib/installments";
import { dueDate } from "@/lib/installments";
import { accountName, fmt, fmtIn, shortDate } from "@/lib/format";
import { accCurrency, toBase } from "@/lib/stats";
import { getInst } from "@/lib/institutions";
import BankLogo from "./BankLogo";
import { Modal } from "./Sheet";
import Icon from "./Icon";
import MoneyInput from "./MoneyInput";
import Emoji from "./Emoji";

export default function Installments({ ctx }: { ctx: Ctx }) {
  const { k, toast, goTab } = ctx;
  const { state } = k;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Installment | null>(null);
  const [showDone, setShowDone] = useState(false);
  const cards = state.accounts.filter((a) => a.kind === "credit" && !a.archived);
  const plans = state.installments ?? [];
  const active = plans.filter((p) => p.paid < p.months);
  const done = plans.filter((p) => p.paid >= p.months);
  const monthlyTotal = active.reduce((s, p) => s + toBase(state, quote(p.principal, p.rate, p.months).monthly, p.acc), 0);
  const remaining = active.reduce((s, p) => s + toBase(state, quote(p.principal, p.rate, p.months).monthly * (p.months - p.paid), p.acc), 0);

  return (
    <>
      <div className="tiles two">
        <div className="tile">
          <span>Monthly installments</span>
          <b className="num">{fmt(monthlyTotal)}</b>
          <small>{active.length} active</small>
        </div>
        <div className="tile">
          <span>Still to pay</span>
          <b className="num" style={{ color: "var(--expense)" }}>
            {fmt(remaining)}
          </b>
          <small>including interest</small>
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="card empty" style={{ marginTop: 12 }}>
          Add a credit card first, then you can track its installments here.
          <br />
          <button className="btn ghost sm" onClick={() => goTab("wallet")}>
            Go to Wallet
          </button>
        </div>
      ) : (
        <button className="btn wide" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Add installment
        </button>
      )}

      {active.length === 0 && cards.length > 0 && (
        <div className="card empty" style={{ marginTop: 12 }}>
          Bought a phone on 12 months? Converted a balance? Add it to see your monthly payment, the real interest, and when it ends.
        </div>
      )}

      {active.map((p) => {
        const acc = state.accounts.find((a) => a.id === p.acc);
        const q = quote(p.principal, p.rate, p.months);
        const next = dueDate(p.start, p.paid);
        const end = dueDate(p.start, p.months - 1);
        const overdue = next.getTime() < Date.now() - 86_400_000;
        return (
          <div className="card instcard" key={p.id}>
            <div className="insttop">
              {acc ? <BankLogo account={acc} size={38} /> : <div className="ico"><Emoji e="💳" /></div>}
              <div className="main">
                <div className="t">{p.name}</div>
                <div className="s">
                  {accountName(state.accounts, p.acc)} · {p.rate > 0 ? `${p.rate}%/mo add-on` : "0% interest"} · {KIND_TEXT[p.kind].label}
                </div>
              </div>
              <div className="amt num">
                {fmtIn(q.monthly, accCurrency(state, p.acc))}
                <small>/mo</small>
              </div>
            </div>
            <div className="bar">
              <i style={{ width: `${(p.paid / p.months) * 100}%`, background: "var(--accent)" }} />
            </div>
            <div className="instmeta">
              <span>
                {p.paid} of {p.months} paid
              </span>
              <span className={overdue ? "warnt" : ""}>
                Next bill {shortDate(next)}
                {overdue ? " (due)" : ""}
              </span>
              <span>Ends {next.getFullYear() === end.getFullYear() ? shortDate(end) : end.toLocaleDateString("en-PH", { month: "short", year: "numeric" })}</span>
            </div>
            <div className="formrow">
              <button
                className="btn sm"
                onClick={() => {
                  k.postInstallment(p.id);
                  toast(p.rate > 0 ? `Bill ${p.paid + 1}/${p.months} posted · ${fmtIn(q.interestPart, accCurrency(state, p.acc))} interest added to ${accountName(state.accounts, p.acc)}` : `Bill ${p.paid + 1}/${p.months} posted`);
                }}
              >
                <Icon name="check" size={16} /> Post bill
              </button>
              <span className="sub num">{fmtIn(q.monthly * (p.months - p.paid), accCurrency(state, p.acc))} left</span>
              <button className="x" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                <Icon name="edit" size={18} />
              </button>
              <button className="x" aria-label={`Delete ${p.name}`} onClick={() => { k.removeInstallment(p.id); toast(`Removed ${p.name}`); }}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          </div>
        );
      })}

      {done.length > 0 && (
        <>
          <button className="link" style={{ marginTop: 16 }} onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide" : "Show"} paid off ({done.length})
          </button>
          {showDone &&
            done.map((p) => (
              <div className="card row" key={p.id} style={{ marginTop: 8 }}>
                <div className="ico"><Emoji e="✅" /></div>
                <div className="main">
                  <div className="t">{p.name}</div>
                  <div className="s">
                    {fmtIn(p.principal, accCurrency(state, p.acc))} over {p.months} months · {accountName(state.accounts, p.acc)}
                  </div>
                </div>
                <button className="x" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                  <Icon name="edit" size={18} />
                </button>
                <button className="x" aria-label={`Delete ${p.name}`} onClick={() => k.removeInstallment(p.id)}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
        </>
      )}

      <p className="hint">
        “Post bill” adds that month’s interest to the card so its balance stays right. Tap <Emoji e="✏️" /> to fix typos; entries it logged are corrected too. Pay the card itself as usual with a transfer.
      </p>

      {adding && <InstallmentForm ctx={ctx} cards={cards} onClose={() => setAdding(false)} />}
      {editing && cards.length > 0 && <InstallmentForm ctx={ctx} cards={cards} plan={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const nextMonth = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return dueDate(d.getTime(), 1);
};
const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function InstallmentForm({ ctx, cards, plan, onClose }: { ctx: Ctx; cards: Account[]; plan?: Installment; onClose: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const editing = !!plan;
  const [accId, setAccId] = useState(plan && cards.some((c) => c.id === plan.acc) ? plan.acc : cards[0].id);
  const acc = cards.find((c) => c.id === accId) ?? cards[0];
  const programs = useMemo(() => programsFor(acc.inst), [acc.inst]);
  // When editing, select the saved program by name, or "Custom" if it no longer matches.
  const initialProg = plan ? (programs.find((p) => p.name === plan.program)?.id ?? (plan.rate === 0 ? "zero" : "custom")) : (programs[1]?.id ?? "zero");
  const [progId, setProgId] = useState(initialProg);
  const program: Program = programs.find((p) => p.id === progId) ?? programs.find((p) => p.id === "custom") ?? programs[0];
  // The kind of plan (purchase / cash / conversion) can't change after saving, since entries were logged that way.
  const kind = plan ? plan.kind : program.kind;
  const cur = accCurrency(state, acc.id);

  const [name, setName] = useState(plan?.name ?? "");
  const [amount, setAmount] = useState(plan ? String(plan.principal) : "");
  const [months, setMonths] = useState(plan?.months ?? (program.terms.includes(12) ? 12 : program.terms[0]));
  const [rate, setRate] = useState(String(plan ? plan.rate : rateFor(program, months)));
  const [fee, setFee] = useState(plan ? String(plan.fee) : "");
  const [feeEdited, setFeeEdited] = useState(!!plan);
  const [start, setStart] = useState(toInput(plan ? new Date(plan.start) : nextMonth()));
  const [cat, setCat] = useState(plan?.cat && plan.kind === "purchase" ? plan.cat : "Shopping");
  const [paid, setPaid] = useState(String(plan?.paid ?? 0));
  const [logNow, setLogNow] = useState(true);
  const debit = state.accounts.filter((a) => a.kind !== "credit" && !a.archived);
  const [toAcc, setToAcc] = useState(debit[0]?.id ?? "");

  const principal = parseFloat(amount) || 0;
  const r = Math.max(0, parseFloat(rate) || 0);
  const feeNum = feeEdited ? parseFloat(fee) || 0 : program.fee(principal);
  const q = quote(principal, r, months, feeNum);
  const termChoices = [...new Set([...program.terms, months])].sort((a, b) => a - b);

  function choose(p: Program) {
    setProgId(p.id);
    const m = p.terms.includes(months) ? months : p.terms.includes(12) ? 12 : p.terms[0];
    setMonths(m);
    setRate(String(rateFor(p, m)));
    setFeeEdited(false);
    if (!editing) setLogNow(p.kind !== "conversion");
  }

  function pickCard(id: string) {
    setAccId(id);
    const next = programsFor(cards.find((c) => c.id === id)?.inst);
    if (editing) {
      // Fixing the card shouldn't wipe the rate and fee you already entered.
      setProgId(next.find((p) => p.name === program.name)?.id ?? "custom");
      setFee(String(feeNum));
      setFeeEdited(true);
    } else choose(next[1] ?? next[0]);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!principal || !name.trim()) return;
    const [y, m, d] = start.split("-").map(Number);
    const data = {
      acc: acc.id,
      name: name.trim(),
      kind,
      principal,
      rate: r,
      months,
      fee: feeNum,
      start: new Date(y, m - 1, d, 12).getTime(),
      cat: kind === "purchase" ? cat : "Bills",
      program: program.id === "custom" && plan ? plan.program : program.name,
    };
    if (plan) {
      k.updateInstallment(plan.id, { ...data, paid: Math.max(0, Math.min(months, parseInt(paid) || 0)) });
      toast(`Saved changes to ${data.name}`);
    } else {
      k.addInstallment(data, { logNow, toAcc });
      toast(`Added ${data.name} · ${fmtIn(q.monthly, cur)}/mo for ${months} months`);
    }
    onClose();
  }

  const overCap = r > BSP_CAP.rate;

  return (
    <Modal title={editing ? "Edit installment" : "New installment"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Card
          </div>
          <div className="accchips">
            {cards.map((c) => (
              <button key={c.id} type="button" className="accchip" aria-pressed={c.id === accId} onClick={() => pickCard(c.id)}>
                <BankLogo account={c} size={26} />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {getInst(acc.inst) ? `${getInst(acc.inst)!.name.replace(/ Credit Card$/, "")} programs` : "Program"}
          </div>
          <div className="programs" role="radiogroup">
            {programs.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={p.id === progId} className="program" onClick={() => choose(p)}>
                <b>{p.name}</b>
                <span>
                  {p.id === "custom" ? "Your own rate" : p.rate === 0 ? "0% interest" : `${p.rate.toFixed(2)}%/mo`} · {p.feeText}
                </span>
              </button>
            ))}
          </div>
          {program.note && <p className="hint">{program.note}</p>}
        </div>

        <label>
          {kind === "cash" ? "What’s the cash for?" : kind === "conversion" ? "Name" : "What did you buy?"}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "purchase" ? "e.g. iPhone, laptop, ref" : "e.g. Cash2Go, Balance convert"} required />
        </label>
        <div className="formrow">
          <label>
            Amount
            <MoneyInput value={amount} onChange={setAmount} placeholder="25,000" required currency={cur} />
          </label>
          <label>
            Add-on rate (%/mo)
            <input type="number" inputMode="decimal" min={0} max={5} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Months
          </div>
          <div className="chips scroll">
            {termChoices.map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                aria-pressed={months === t}
                onClick={() => {
                  setMonths(t);
                  if (program.rateByTerm || program.id !== "custom") setRate(String(rateFor(program, t)));
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="formrow">
          <label>
            One-time fee
            <MoneyInput currency={cur} value={feeEdited ? fee : String(feeNum)} onChange={(raw) => { setFee(raw); setFeeEdited(true); }} />
          </label>
          <label>
            First bill
            <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </label>
        </div>

        {kind === "purchase" && (
          <label>
            Category
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {catNames().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className={`quote${overCap ? " warnbox" : ""}`} aria-live="polite">
          <div className="qmain">
            <span>Monthly payment</span>
            <b className="num">{fmtIn(q.monthly, cur)}</b>
          </div>
          <div className="frow">
            <span>Principal + interest</span>
            <span className="num">
              {fmtIn(q.principalPart, cur)} + {fmtIn(q.interestPart, cur)}
            </span>
          </div>
          <div className="frow">
            <span>Total interest ({months} months)</span>
            <span className="num">{fmtIn(q.totalInterest, cur)}</span>
          </div>
          <div className="frow">
            <span>Total cost incl. fee</span>
            <b className="num">{fmtIn(q.totalCost, cur)}</b>
          </div>
          {(r > 0 || feeNum > 0) && (
            <div className="frow">
              <span>True (effective) rate{feeNum > 0 ? " incl. fee" : ""}</span>
              <span className="num">
                ≈ {q.effMonthly}%/mo · {q.effAnnual}%/yr
              </span>
            </div>
          )}
          {overCap && <p className="warnt">This is above the BSP cap of {BSP_CAP.rate}% a month. Double-check the rate.</p>}
        </div>

        {editing && (
          <label>
            Bills already posted (of {months})
            <input type="number" inputMode="numeric" min={0} max={months} value={paid} onChange={(e) => setPaid(e.target.value)} />
          </label>
        )}

        {editing ? (
          <p className="sub">Entries this installment logged earlier (purchase, fee, posted interest) will be updated to match your changes.</p>
        ) : (
        <label className="check">
          <input type="checkbox" checked={logNow} onChange={(e) => setLogNow(e.target.checked)} />
          <span>
            {kind === "purchase"
              ? `Log the ${principal ? fmtIn(principal, cur) : ""} purchase on ${acc.name} now`
              : kind === "cash"
                ? `Log the cash going from ${acc.name} to my account`
                : "Log the fee now"}
            {feeNum > 0 && kind !== "conversion" ? ` (plus the ${fmtIn(feeNum, cur)} fee)` : ""}
          </span>
        </label>
        )}
        {!editing && kind === "cash" && logNow && debit.length > 0 && (
          <label>
            Cash goes to
            <select value={toAcc} onChange={(e) => setToAcc(e.target.value)}>
              {debit.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button className="btn" type="submit" disabled={!principal || !name.trim()}>
          {editing ? "Save changes" : "Save installment"}
        </button>
        <p className="hint">
          Rates from each bank’s website ({RATES_AS_OF}); promos and offers vary, so check your SMS or statement. {BSP_CAP.note}
        </p>
      </form>
    </Modal>
  );
}
