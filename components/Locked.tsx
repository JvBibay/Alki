"use client";

import { FormEvent, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { Account } from "@/lib/types";
import { INSTITUTIONS, getInst } from "@/lib/institutions";
import { DEFAULT_TAX, TERM_CHOICES, addMonths, depositMath, depositStatus } from "@/lib/deposits";
import { activeAccounts, balance } from "@/lib/stats";
import { fmt, shortDate } from "@/lib/format";
import { Modal } from "./Sheet";
import BankLogo from "./BankLogo";
import MoneyInput from "./MoneyInput";
import Emoji, { EmojiText } from "./Emoji";

const toInput = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};
const longDate = (ts: number) => new Date(ts).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

// Banks and apps that offer time deposits or locked savings.
const DEPOSIT_INSTS = INSTITUTIONS.filter((i) => i.group === "digital" || i.group === "bank" || ["maya", "gcash", "coinsph", "pagibig"].includes(i.id));

/** "Lock savings": put money in a time deposit for a fixed term. */
export function LockForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const sources = activeAccounts(state).filter((a) => a.kind !== "credit");
  const [inst, setInst] = useState("mayabank");
  const [custom, setCustom] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [unit, setUnit] = useState<RateUnit>("year");
  const [months, setMonths] = useState(6);
  const [customMonths, setCustomMonths] = useState("");
  const [start, setStart] = useState(toInput(Date.now()));
  const [tax, setTax] = useState(String(DEFAULT_TAX));
  const [from, setFrom] = useState(sources[0]?.id ?? "");

  const info = inst === "other" ? undefined : getInst(inst);
  const term = months === -1 ? Math.max(1, parseInt(customMonths, 10) || 0) : months;
  const principal = parseFloat(amount) || 0;
  const r = toYearly(rate, unit);
  const m = depositMath(principal, r, term, parseFloat(tax) || 0);
  const maturity = addMonths(fromInput(start), term);
  const fromBal = from ? balance(state, state.accounts.find((a) => a.id === from)!) : 0;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!principal || !term) return;
    const base = info ? info.name.replace(/ \(formerly .*\)$/, "") : custom.trim() || "Time deposit";
    const name = `${base} · ${term}-month lock`;
    k.lockSavings({ name, inst: info?.id, color: info?.color ?? "#334155", principal, rate: r, rateUnit: unit, months: term, start: fromInput(start), tax: parseFloat(tax) || 0, fromAcc: from || undefined });
    toast(`🔒 Locked ${fmt(principal)} until ${longDate(maturity)}`);
    onClose();
  }

  return (
    <Modal title="Lock savings" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="sub">Track a time deposit or locked savings: money you can’t touch until a set date, usually at a higher rate.</p>
        <label>
          Bank or app
          <select value={inst} onChange={(e) => setInst(e.target.value)}>
            {DEPOSIT_INSTS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
            <option value="other">Other…</option>
          </select>
        </label>
        {inst === "other" && <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Name, e.g. Pag-IBIG MP2" maxLength={40} />}
        <div className="formrow">
          <label>
            Amount
            <MoneyInput value={amount} onChange={setAmount} placeholder="50,000" required />
          </label>
          <RateField rate={rate} setRate={setRate} unit={unit} setUnit={setUnit} />
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Lock for
          </div>
          <div className="chips">
            {TERM_CHOICES.map((t) => (
              <button type="button" key={t} className="chip" aria-pressed={months === t} onClick={() => setMonths(t)}>
                {t} mo
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={months === -1} onClick={() => setMonths(-1)}>
              Custom
            </button>
          </div>
          {months === -1 && (
            <input style={{ marginTop: 8 }} type="number" inputMode="numeric" min={1} max={120} value={customMonths} onChange={(e) => setCustomMonths(e.target.value)} placeholder="Number of months" />
          )}
        </div>
        <div className="formrow">
          <label>
            Start date
            <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </label>
          <label>
            Tax on interest (%)
            <input type="number" inputMode="decimal" min={0} max={100} value={tax} onChange={(e) => setTax(e.target.value)} />
          </label>
        </div>
        <label>
          Move the money from
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {sources.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="">It’s already locked (don’t move money)</option>
          </select>
        </label>
        {from && principal > fromBal && <p className="warnt">That’s more than what’s in this account ({fmt(fromBal)}).</p>}

        {principal > 0 && (
          <div className="quote">
            <div className="qmain">
              <span>At maturity</span>
              <b className="num">{fmt(m.atMaturity)}</b>
            </div>
            <div className="frow">
              <span><Emoji e="🔒" /> Locked until</span>
              <b>{longDate(maturity)}</b>
            </div>
            <div className="frow">
              <span>Interest (gross)</span>
              <span className="num">{fmt(m.gross)}</span>
            </div>
            <div className="frow">
              <span>Tax withheld ({parseFloat(tax) || 0}%)</span>
              <span className="num">−{fmt(m.tax)}</span>
            </div>
            <div className="frow">
              <span>You earn</span>
              <b className="num in">+{fmt(m.net)}</b>
            </div>
          </div>
        )}
        <button className="btn" type="submit" disabled={!principal || !term}>
          <Emoji e="🔒" /> Lock {principal ? fmt(principal) : "savings"}
        </button>
        <p className="hint">Use the rate and term from your bank’s app; rates change often. The estimate uses simple interest, so your bank’s exact figure can differ slightly.</p>
      </form>
    </Modal>
  );
}

/** Details of one deposit, with collect / withdraw early. */
export function DepositModal({ ctx, acc, onClose }: { ctx: Ctx; acc: Account; onClose: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const d = acc.deposit!;
  const st = depositStatus(acc)!;
  const m = depositMath(d.principal, d.rate, d.months, d.tax);
  const targets = activeAccounts(state).filter((a) => a.kind !== "credit");
  const [mode, setMode] = useState<"view" | "collect" | "early" | "edit">("view");
  const [received, setReceived] = useState(String(st.matured ? m.atMaturity : d.principal));
  const [to, setTo] = useState(targets[0]?.id ?? "");
  const [unit, setUnit] = useState<RateUnit>(d.rateUnit ?? "year");
  const inUnit = (yearly: number) => round4(d.rateUnit === "month" ? yearly / 12 : yearly);
  const [rate, setRate] = useState(String(inUnit(d.rate)));
  const [months, setMonths] = useState(String(d.months));
  const [start, setStart] = useState(toInput(d.start));
  const ended = d.status !== "locked";

  function collect(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(received) || 0;
    if (!to) return toast("Add a regular account first to receive the money.");
    k.collectDeposit(acc.id, amt, to, mode === "early");
    toast(mode === "early" ? `Withdrew ${fmt(amt)} early` : `🎉 Collected ${fmt(amt)} from ${acc.name}`);
    onClose();
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    k.updateDeposit(acc.id, { deposit: { rate: toYearly(rate, unit), rateUnit: unit, boost: undefined, months: Math.max(1, parseInt(months, 10) || 1), start: fromInput(start) } });
    toast("Deposit updated");
    onClose();
  }

  return (
    <Modal title={acc.name} onClose={onClose}>
      <div className="form">
        <div className="picked">
          <BankLogo account={acc} size={44} />
          <div className="main">
            <div className="t">{fmt(d.principal)} locked</div>
            <div className="s">
              {rateText(d)} · {d.months} months · started {shortDate(d.start)}
            </div>
          </div>
        </div>

        {ended ? (
          <p className="sub">
            {d.status === "matured" ? "Matured" : "Withdrawn early"} · you received {fmt(d.received ?? 0)}. It’s archived in Wallet.
          </p>
        ) : mode === "view" ? (
          <>
            <div className="quote">
              <div className="qmain">
                <span>{st.matured ? "Ready to collect 🎉" : "🔒 Locked until"}</span>
                <b>{longDate(st.maturity)}</b>
              </div>
              {!st.matured && (
                <>
                  <div className="bar">
                    <i style={{ width: `${st.progress * 100}%`, background: "var(--accent)" }} />
                  </div>
                  <div className="s" style={{ marginTop: 4 }}>
                    {st.left}
                  </div>
                </>
              )}
              <div className="frow">
                <span>Interest after {d.tax}% tax</span>
                <b className="num in">+{fmt(m.net)}</b>
              </div>
              <div className="frow">
                <span>At maturity</span>
                <b className="num">{fmt(m.atMaturity)}</b>
              </div>
            </div>
            {st.matured ? (
              <button className="btn" onClick={() => setMode("collect")}>
                Collect {fmt(m.atMaturity)}
              </button>
            ) : (
              <button className="btn ghost" onClick={() => setMode("early")}>
                Withdraw early
              </button>
            )}
            <button className="link" onClick={() => setMode("edit")}>
              Fix rate, term or start date
            </button>
          </>
        ) : mode === "edit" ? (
          <form className="form" style={{ padding: 0 }} onSubmit={saveEdit}>
            <div className="formrow">
              <RateField rate={rate} setRate={setRate} unit={unit} setUnit={setUnit} />
              <label>
                Months
                <input type="number" inputMode="numeric" min={1} value={months} onChange={(e) => setMonths(e.target.value)} />
              </label>
            </div>
            <label>
              Start date
              <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
            </label>
            <button className="btn" type="submit">
              Save
            </button>
          </form>
        ) : (
          <form className="form" style={{ padding: 0 }} onSubmit={collect}>
            {mode === "early" && <p className="warnt">Withdrawing before {longDate(st.maturity)} usually means losing some or all interest. Enter what the bank actually gave you.</p>}
            <label>
              Amount received
              <MoneyInput value={received} onChange={setReceived} required />
            </label>
            <label>
              Put it in
              <select value={to} onChange={(e) => setTo(e.target.value)}>
                {targets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="sub">The interest ({fmt(Math.max(0, (parseFloat(received) || 0) - d.principal))}) is logged as income.</p>
            <button className={`btn${mode === "early" ? " danger" : ""}`} type="submit">
              {mode === "early" ? "Withdraw early" : "Collect"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}

/** One row for a deposit in Wallet. */
export function DepositRow({ acc, onOpen }: { acc: Account; onOpen: () => void }) {
  const d = acc.deposit!;
  const st = depositStatus(acc)!;
  const m = depositMath(d.principal, d.rate, d.months, d.tax);
  return (
    <button className={`accrow lockrow${st.matured && d.status === "locked" ? " ready" : ""}`} style={{ background: acc.color }} onClick={onOpen} aria-label={`Open ${acc.name}`}>
      <span className="abadge">
        <BankLogo account={acc} size={36} />
      </span>
      <span className="main">
        <b>
          <span className="accname">{acc.name}</span>
        </b>
        <small><EmojiText text={d.status !== "locked" ? (d.status === "matured" ? "Matured ✅" : "Withdrawn") : st.matured ? "Ready to collect 🎉" : `🔒 Until ${shortDate(st.maturity)} · ${st.left}`} /></small>
        {d.status === "locked" && !st.matured && (
          <span className="lockbar">
            <i style={{ width: `${st.progress * 100}%` }} />
          </span>
        )}
      </span>
      <span className="accamt">
        <b className="num">{fmt(d.principal)}</b>
        <small>+{fmt(m.net)} at maturity</small>
      </span>
    </button>
  );
}

type RateUnit = "year" | "month";
const round4 = (n: number) => Math.round(n * 10000) / 10000;
/** The yearly rate (what the math uses) from what was typed per year or per month. */
const toYearly = (typed: string, unit: RateUnit) => round4((parseFloat(typed) || 0) * (unit === "month" ? 12 : 1));
const pct = (n: number) => `${round4(n)}%`;
/** "6% a year" or "0.5% a month (6% a year)". */
function rateText(d: { rate: number; rateUnit?: RateUnit }) {
  return d.rateUnit === "month" ? `${pct(d.rate / 12)} a month (${pct(d.rate)} a year)` : `${pct(d.rate)} a year`;
}

/** Interest rate input with a p.a. / per month switch. */
function RateField({ rate, setRate, unit, setUnit }: { rate: string; setRate: (v: string) => void; unit: RateUnit; setUnit: (u: RateUnit) => void }) {
  const n = parseFloat(rate) || 0;
  const yearly = unit === "month" ? n * 12 : n;
  return (
    <div className="ratefield">
      <label>
        <span className="ratehead">
          Interest
          <span className="rateunit" role="tablist" aria-label="Rate per">
            {(["year", "month"] as const).map((u) => (
              <button key={u} type="button" role="tab" aria-selected={unit === u} onClick={() => setUnit(u)}>
                {u === "year" ? "p.a." : "/mo"}
              </button>
            ))}
          </span>
        </span>
        <input type="number" inputMode="decimal" min={0} step="any" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={unit === "month" ? "e.g. 0.5" : "e.g. 6"} />
      </label>
      {n > 0 && <span className="ratehint">{unit === "month" ? `${pct(n)} a month = ${pct(yearly)} a year` : `${pct(n)} a year = ${pct(n / 12)} a month`}</span>}
      {unit === "month" && n > 2 && (
        <span className="ratewarn">That’s {pct(yearly)} a year, which is unusually high. Most banks show rates per year (“p.a.”). If yours says p.a., switch to p.a.</span>
      )}
    </div>
  );
}
