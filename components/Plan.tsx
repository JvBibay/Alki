"use client";

import { FormEvent, useState } from "react";
import { catColor, catEmoji, catNames } from "@/lib/categories";
import type { Ctx, PlanTab } from "@/lib/ui";
import { accCurrency, monthKey, monthRange, sumRange, toBase, upcoming, type UpcomingItem } from "@/lib/stats";
import { billMatch, paidAmount } from "@/lib/bills";
import BillPay from "./BillPay";
import { accountName, fmt, fmtIn, shortDate } from "@/lib/format";
import { Modal } from "./Sheet";
import PlanTabs from "./PlanTabs";
import { billEmoji } from "@/lib/billicons";
import Icon from "./Icon";
import Installments from "./Installments";
import Budgets from "./Budgets";
import Debts from "./Debts";
import MoneyInput from "./MoneyInput";
import Emoji from "./Emoji";
import ProGate from "./ProGate";
import { hasPaid, PAID_PLAN_TABS } from "@/lib/plans";

const GOAL_EMOJI = ["🎯", "🏝️", "🏠", "🚗", "💻", "🎓", "🛟", "💍", "✈️", "📱"];

export default function Plan({ ctx, tab, setTab }: { ctx: Ctx; tab: PlanTab; setTab: (t: PlanTab) => void }) {
  const paid = hasPaid(ctx.access);
  const gated = (id: PlanTab) => !paid && (PAID_PLAN_TABS as readonly string[]).includes(id);
  return (
    <>
      <header className="band">
        <h1 className="hello">Plan</h1>
        <div className="eyebrow">Budgets, goals, cash flow, installments and debts</div>
        <PlanTabs>
          {(
            [
              ["budgets", "Budgets"],
              ["goals", "Goals"],
              ["upcoming", "Cash flow"],
              ["installments", "Installments"],
              ["debts", "Debts"],
            ] as [PlanTab, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
              {gated(id) && " 🔒"}
            </button>
          ))}
        </PlanTabs>
      </header>
      {gated(tab) ? (
        <ProGate ctx={ctx} what={tab === "installments" ? "Installments" : "Debts"} />
      ) : tab === "budgets" ? (
        <Budgets ctx={ctx} />
      ) : tab === "goals" ? (
        <Goals ctx={ctx} />
      ) : tab === "installments" ? (
        <Installments ctx={ctx} />
      ) : tab === "debts" ? (
        <Debts ctx={ctx} />
      ) : (
        <Upcoming ctx={ctx} />
      )}
    </>
  );
}

function Goals({ ctx }: { ctx: Ctx }) {
  const { k, toast } = ctx;
  const { state } = k;
  const [adding, setAdding] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const saved = state.goals.reduce((a, g) => a + Math.min(g.saved, g.target), 0);
  const target = state.goals.reduce((a, g) => a + g.target, 0);

  function contribute(id: string, sign: 1 | -1) {
    const v = parseFloat(amounts[id] ?? "");
    if (!v || v <= 0) return;
    k.contributeGoal(id, sign * v);
    setAmounts((a) => ({ ...a, [id]: "" }));
    const g = state.goals.find((x) => x.id === id);
    if (g && sign > 0 && g.saved < g.target && g.saved + v >= g.target) toast(`🎉 You reached “${g.name}”!`);
    else toast(sign > 0 ? `Added ${fmt(v)} to ${g?.name}` : `Took ${fmt(v)} from ${g?.name}`);
  }

  return (
    <>
      <div className="card summary">
        <div className="eyebrow">Total saved across goals</div>
        <div className="big num">
          {fmt(saved)} <span className="sub">/ {fmt(target)}</span>
        </div>
        <div className="formrow">
          <span className="sub">
            {state.goals.length} active · {state.goals.filter((g) => g.saved >= g.target).length} completed
          </span>
          <button className="btn sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> New goal
          </button>
        </div>
      </div>

      {state.goals.length === 0 && (
        <div className="card empty">Save for an emergency fund, a trip, or a new laptop. Create your first goal above.</div>
      )}

      {state.goals.map((g) => {
        const pct = Math.min(100, (g.saved / g.target) * 100);
        const done = g.saved >= g.target;
        return (
          <div className="card goal" key={g.id}>
            <div className="goaltop">
              <div className="ring" style={{ background: `conic-gradient(var(--accent) ${pct}%, var(--track) 0)` }}>
                <span><Emoji e={g.emoji} /></span>
              </div>
              <div className="main">
                <div className="t">{g.name}</div>
                <div className="s num">
                  {fmt(g.saved)} of {fmt(g.target)} · {done ? "Completed 🎉" : `${fmt(g.target - g.saved)} to go`}
                </div>
              </div>
              <button className="x" aria-label={`Delete ${g.name}`} onClick={() => { k.removeGoal(g.id); toast(`Deleted ${g.name}`); }}>
                <Icon name="trash" size={18} />
              </button>
            </div>
            <div className="bar">
              <i style={{ width: `${pct}%`, background: "var(--accent)" }} />
            </div>
            <div className="formrow">
              <MoneyInput
                placeholder="Amount"
                aria-label={`Amount for ${g.name}`}
                value={amounts[g.id] ?? ""}
                onChange={(raw) => setAmounts((a) => ({ ...a, [g.id]: raw }))}
              />
              <button className="btn sm" onClick={() => contribute(g.id, 1)}>
                Add
              </button>
              <button className="btn ghost sm" onClick={() => contribute(g.id, -1)}>
                Withdraw
              </button>
            </div>
          </div>
        );
      })}

      {adding && <GoalForm ctx={ctx} onClose={() => setAdding(false)} />}
    </>
  );
}

function GoalForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [emoji, setEmoji] = useState(GOAL_EMOJI[0]);
  function save(e: FormEvent) {
    e.preventDefault();
    const t = parseFloat(target);
    if (!name.trim() || !t) return;
    ctx.k.addGoal({ name: name.trim(), target: t, emoji });
    ctx.toast(`Goal “${name.trim()}” created`);
    onClose();
  }
  return (
    <Modal title="New savings goal" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          What are you saving for?
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund" required autoFocus />
        </label>
        <label>
          Target amount
          <MoneyInput value={target} onChange={setTarget} placeholder="20,000" required />
        </label>
        <fieldset className="emojis">
          <legend>Icon</legend>
          {GOAL_EMOJI.map((em) => (
            <button type="button" key={em} aria-pressed={emoji === em} onClick={() => setEmoji(em)} aria-label={em}>
              <Emoji e={em} />
            </button>
          ))}
        </fieldset>
        <button className="btn" type="submit">
          Create goal
        </button>
      </form>
    </Modal>
  );
}

/** Common monthly bills for a quick start: name, category. */
const BILL_PRESETS: [string, string][] = [
  ["Rent", "Bills"],
  ["Electricity", "Bills"],
  ["Water", "Bills"],
  ["Internet", "Bills"],
  ["Phone plan", "Bills"],
  ["Netflix", "Fun"],
  ["Spotify", "Fun"],
  ["Gym", "Health"],
  ["Insurance", "Bills"],
];

type PlannedDraft = { type: "expense" | "income"; name?: string; cat?: string };

/**
 * Bills: monthly bills first (this month's total, what's paid, what's left, what's next),
 * then regular income (salary) at the bottom, since that's used for payday reminders and the forecast.
 */
function Upcoming({ ctx }: { ctx: Ctx }) {
  const { k, toast } = ctx;
  const { state } = k;
  const [adding, setAdding] = useState<PlannedDraft | null>(null);
  const [paying, setPaying] = useState<UpcomingItem | null>(null);
  const list = upcoming(state);
  const now = new Date();
  const thisKey = monthKey(now);
  const monthName = now.toLocaleDateString("en-PH", { month: "long" });

  const bills = state.planned.filter((p) => p.type === "expense");
  const paidNow = bills.filter((p) => p.done.includes(thisKey));
  const due = list.filter((u) => u.item.type === "expense" && u.key === thisKey);
  const later = list.filter((u) => u.item.type === "expense" && u.key !== thisKey && !paidNow.some((p) => p.id === u.item.id));
  const income = list.filter((u) => u.item.type === "income");
  const base = (p: { amount: number; acc: string }) => toBase(state, p.amount, p.acc);
  // What was really paid replaces the expected amount for that month.
  const total = bills.reduce((a, p) => a + base({ ...p, amount: p.done.includes(thisKey) ? paidAmount(p, thisKey) : p.amount }), 0);
  const paid = paidNow.reduce((a, p) => a + base({ ...p, amount: paidAmount(p, thisKey) }), 0);
  const left = Math.max(0, total - paid);
  const next = due[0];

  const pay = (u: (typeof list)[number]) => setPaying(u);
  // One tap when an entry you already logged looks like this bill.
  const linkMatch = (u: (typeof list)[number], t: { id: string; amount: number; acc: string }) => {
    k.markPlannedDone(u.item.id, u.key, { link: t.id });
    toast(`Linked your ${fmtIn(t.amount, accCurrency(state, t.acc))} ${u.item.name} to the bill`, () => k.undoPlannedDone(u.item.id, u.key));
  };
  const unpaid = (p: (typeof bills)[number]) => {
    const rec = p.paid?.[thisKey];
    k.undoPlannedDone(p.id, thisKey);
    toast(`${p.name} is unpaid again${rec && !rec.created ? "" : rec ? "" : ". The expense stays in History."}`, rec ? () => k.markPlannedDone(p.id, thisKey, rec.created ? { amount: rec.amount, acc: state.txs.find((t) => t.id === rec.txId)?.acc, date: rec.date } : { link: rec.txId }) : undefined);
  };
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  const when = (u: (typeof list)[number]) =>
    u.daysLeft < 0 ? `Overdue ${days(-u.daysLeft)}` : u.daysLeft === 0 ? "Due today" : u.daysLeft === 1 ? "Due tomorrow" : u.daysLeft <= 7 ? `Due in ${days(u.daysLeft)}` : `Due ${shortDate(u.due)}`;

  const row = (u: (typeof list)[number]) => {
    const match = u.key === thisKey || u.daysLeft <= 7 ? billMatch(state, u) : undefined;
    return (
    <div className={`row billitem${u.daysLeft < 0 ? " overdue" : u.daysLeft <= 3 ? " soon" : ""}`} key={u.item.id}>
      <div className="ico" style={{ color: catColor(u.item.cat) }}>
        <Emoji e={u.item.type === "income" ? "💰" : billEmoji(u.item.name, u.item.cat)} />
      </div>
      <div className="main">
        <div className="t" title={`Every ${ordinal(u.item.day)}`}>{u.item.name}</div>
        <div className="s">
          <span className="billwhen">{u.item.type === "income" ? (u.daysLeft === 0 ? "Today" : u.daysLeft <= 7 ? `In ${days(u.daysLeft)}` : shortDate(u.due)) : when(u)}</span>
          <span className="billacc">{accountName(state.accounts, u.item.acc)}</span>
        </div>
        {match && (
          <button className="link" onClick={() => linkMatch(u, match)}>
            Is this your {fmtIn(match.amount, accCurrency(state, match.acc))} on {shortDate(match.date)}? Link it ›
          </button>
        )}
      </div>
      <div className={`amt num ${u.item.type === "income" ? "in" : ""}`}>{fmtIn(u.item.amount, accCurrency(state, u.item.acc))}</div>
      <button className="chip" onClick={() => pay(u)} aria-label={`${u.item.type === "income" ? "Mark received" : "Mark paid"}: ${u.item.name}`}>
        {u.item.type === "income" ? "Mark received" : "Mark paid"}
      </button>
      <button className="x" aria-label={`Delete ${u.item.name}`} onClick={() => k.removePlanned(u.item.id)}>
        <Icon name="trash" size={18} />
      </button>
    </div>
    );
  };

  return (
    <>
      {bills.length > 0 ? (
        <div className="card billshero">
          <div className="eyebrow">{monthName} bills</div>
          <div className="billsnums">
            <div>
              <b className="num">{fmt(left)}</b>
              <small>{left > 0 ? "left to pay" : "all paid"}</small>
            </div>
            <div className="billstotal">
              <span className="num">{fmt(paid)}</span> of <span className="num">{fmt(total)}</span> paid
            </div>
          </div>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${total ? Math.min(100, (paid / total) * 100) : 0}%` }} />
          </div>
          <div className="billsnext">
            {next ? (
              <>
                Next: <b>{next.item.name}</b> {fmtIn(next.item.amount, accCurrency(state, next.item.acc))} · {when(next).replace(/^Due /, "").toLowerCase()}
              </>
            ) : (
              <>
                <Emoji e="🎉" /> Everything for {monthName} is paid.
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="card billsempty">
          <b>Never miss a bill</b>
          <p className="sub">Add the bills you pay every month. Kwenta reminds you before they're due and shows what's left to pay.</p>
          <div className="chips wrap">
            {BILL_PRESETS.map(([n, c]) => (
              <button key={n} className="chip" onClick={() => setAdding({ type: "expense", name: n, cat: c })}>
                <Emoji e={billEmoji(n, c)} /> {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {paying && <BillPay ctx={ctx} u={paying} onClose={() => setPaying(null)} />}

      <button className="btn wide" style={{ marginTop: 12 }} onClick={() => setAdding({ type: "expense" })}>
        <Icon name="plus" size={18} /> Add a bill
      </button>

      {due.length > 0 && (
        <>
          <div className="sectionhead">
            <h2>Still to pay</h2>
          </div>
          <div className="card">{due.map(row)}</div>
        </>
      )}
      {later.length > 0 && (
        <>
          <div className="sectionhead">
            <h2>Next month</h2>
          </div>
          <div className="card">{later.map(row)}</div>
        </>
      )}
      {paidNow.length > 0 && (
        <>
          <div className="sectionhead">
            <h2>Paid in {monthName}</h2>
          </div>
          <div className="card">
            {paidNow.map((p) => (
              <div className="row billitem paid" key={p.id}>
                <div className="ico" style={{ color: catColor(p.cat) }}>
                  <Emoji e={billEmoji(p.name, p.cat)} />
                </div>
                <div className="main">
                  <div className="t">{p.name}</div>
                  <div className="s">
                    <span className="billwhen">Next on the {ordinal(p.day)}</span>
                    <span className="billacc">{accountName(state.accounts, p.acc)}</span>
                  </div>
                </div>
                <div className="amt num">{fmtIn(paidAmount(p, thisKey), accCurrency(state, p.acc))}</div>
                <button className="chip" onClick={() => unpaid(p)} aria-label={`Paid${p.paid?.[thisKey] ? " " + shortDate(p.paid[thisKey].date) : ""}. Tap to undo: ${p.name}`} title="Tap to undo">
                  <Icon name="check" size={14} stroke={2.6} /> Paid{p.paid?.[thisKey] ? ` ${shortDate(p.paid[thisKey].date)}` : ""}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {bills.length > 0 && <p className="hint">Mark paid logs the bill as an expense for that month, with what you actually paid. Tap Paid to undo.</p>}

      <div className="sectionhead">
        <h2>Regular income</h2>
        <button className="link" onClick={() => setAdding({ type: "income", name: "Salary" })}>
          + Add
        </button>
      </div>
      {income.length > 0 ? (
        <div className="card">{income.map(row)}</div>
      ) : (
        <p className="hint" style={{ marginTop: 0 }}>Add your salary or other regular income for payday reminders and a better forecast.</p>
      )}

      {adding && <PlannedForm ctx={ctx} draft={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function PlannedForm({ ctx, draft, onClose }: { ctx: Ctx; draft: PlannedDraft; onClose: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const [type, setType] = useState<"expense" | "income">(draft.type);
  const [name, setName] = useState(draft.name ?? "");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(String(new Date().getDate()));
  const [cat, setCat] = useState(draft.cat ?? "Bills");
  const [acc, setAcc] = useState(state.defAcc);

  function save(e: FormEvent) {
    e.preventDefault();
    const a = parseFloat(amount);
    const d = Math.min(31, Math.max(1, parseInt(day) || 1));
    if (!name.trim() || !a) return;
    k.addPlanned({ name: name.trim(), type, amount: a, day: d, cat: type === "income" ? "Income" : cat, acc });
    toast(`Added ${name.trim()}`);
    onClose();
  }

  if (state.accounts.length === 0) {
    return (
      <Modal title={type === "income" ? "Regular income" : "Monthly bill"} onClose={onClose}>
        <p className="sub">Add an account in Wallet first, so Kwenta knows which account pays this.</p>
        <button className="btn wide" style={{ marginTop: 12 }} onClick={() => ctx.goTab("wallet")}>
          Go to Wallet
        </button>
      </Modal>
    );
  }

  return (
    <Modal title={type === "income" ? "Regular income" : "Monthly bill"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="seg" role="tablist">
          {(["expense", "income"] as const).map((t) => (
            <button type="button" key={t} role="tab" aria-selected={type === t} onClick={() => setType(t)}>
              {t === "expense" ? "Bill" : "Income (salary)"}
            </button>
          ))}
        </div>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "income" ? "Salary" : "Internet"} required autoFocus />
        </label>
        {type === "expense" && /\+|&|\band\b/i.test(name) && name.split(/\s*(?:\+|&|\band\b)\s*/i).filter(Boolean).length > 1 && (
          <p className="hint" role="status" style={{ margin: "-4px 2px 0" }}>
            Tip: add each service as its own bill (like Netflix and Spotify), so a price change or a cancellation only touches that one.
          </p>
        )}
        <div className="formrow">
          <label>
            Amount
            <MoneyInput value={amount} onChange={setAmount} placeholder="0" required currency={accCurrency(state, acc)} />
          </label>
          <label>
            {type === "income" ? "Payday (day of month)" : "Due day (day of month)"}
            <input type="number" inputMode="numeric" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} required />
          </label>
        </div>
        {type === "expense" && (
          <label>
            Category
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {catNames().map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Account
          <select value={acc} onChange={(e) => setAcc(e.target.value)}>
            {state.accounts.filter((a) => !a.archived || a.id === acc).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit">
          Save
        </button>
      </form>
    </Modal>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
