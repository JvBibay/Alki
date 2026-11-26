"use client";

import { FormEvent, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { Debt, Split } from "@/lib/types";
import { debtLeft, debtTotals, equalShares, isSettled, splitSummary } from "@/lib/debts";
import { findProfile, peopleSummary, personKey, type PersonSummary } from "@/lib/people";
import { PersonAvatar, PersonCard, PersonSheet } from "./People";
import { activeAccounts, balance } from "@/lib/stats";
import { catEmoji, catNames } from "@/lib/categories";
import { fmt, fmtIn, getBaseCurrency, shortDate } from "@/lib/format";
import { formatMoney } from "@/lib/currency";
import { Modal } from "./Sheet";
import Icon from "./Icon";
import MoneyInput from "./MoneyInput";
import SplitFields, { useSplitState } from "./SplitFields";
import Emoji from "./Emoji";

const toInput = (ts?: number) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromInput = (v: string) => {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};

/** Plan → Debts: people you share money with, their balances, and split bills. */
export default function Debts({ ctx }: { ctx: Ctx }) {
  const { k } = ctx;
  const { state } = k;
  const splits = state.splits ?? [];
  const t = debtTotals(state);
  const people = peopleSummary(state);
  const active = people.filter((p) => p.open.length > 0);
  const quiet = people.filter((p) => p.open.length === 0);
  const [adding, setAdding] = useState<{ person?: string; direction?: "owe" | "owed" } | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [personKeyOpen, setPersonKeyOpen] = useState<string | null>(null);
  const [settling, setSettling] = useState<PersonSummary | null>(null);
  const [showQuiet, setShowQuiet] = useState(false);
  const openPerson = personKeyOpen ? people.find((p) => p.key === personKeyOpen) : undefined;
  const byKey = new Map(people.map((p) => [p.key, p]));
  // Newest first, with fully paid bills after the ones still being collected.
  const splitDone = (sp: Split) => sp.people.every((x) => {
    const d = (state.debts ?? []).find((y) => y.id === x.debtId);
    return !d || isSettled(d);
  });
  const orderedSplits = [...splits].reverse().sort((a, b) => Number(splitDone(a)) - Number(splitDone(b)));

  return (
    <>
      <div className="card splithero">
        <div className="tiles two">
          <div className="tile">
            <span>Owed to you</span>
            <b className="num" style={{ color: "var(--income)" }}>
              {fmt(t.owed, true)}
            </b>
          </div>
          <div className="tile">
            <span>You owe</span>
            <b className="num" style={{ color: "var(--expense)" }}>
              {fmt(t.owe, true)}
            </b>
          </div>
        </div>
        <div className="formrow" style={{ marginTop: 12 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => setSplitting(true)}>
            <Icon name="plus" size={18} /> Split a bill
          </button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => setAdding({})}>
            Add debt
          </button>
        </div>
        {active.length > 0 && (
          <div className="facepile" aria-label={`${active.length} people with open items`}>
            {active.slice(0, 6).map((p) => (
              <button key={p.key} onClick={() => setPersonKeyOpen(p.key)} aria-label={`Open ${p.name}`}>
                <PersonAvatar name={p.name} emoji={p.profile?.emoji} color={p.color} label={p.label} size={34} />
              </button>
            ))}
            {active.length > 6 && <span className="more">+{active.length - 6}</span>}
          </div>
        )}
      </div>

      {active.length === 0 && splits.length === 0 && (
        <div className="card empty" style={{ marginTop: 12 }}>
          Track money between you and friends or family: “I owe Ate {formatMoney(2000, getBaseCurrency())}” or “Ben owes me {formatMoney(500, getBaseCurrency())}”. Or split a dinner bill and see who has paid.
        </div>
      )}

      {active.length > 0 && (
        <>
          <div className="sectionhead">
            <h2>People</h2>
            <span className="sub">{active.length} with open items</span>
          </div>
          {active.map((p) => (
            <PersonCard key={p.key} p={p} onOpen={() => setPersonKeyOpen(p.key)} />
          ))}
        </>
      )}

      {splits.length > 0 && (
        <>
          <div className="sectionhead">
            <h2>Split bills</h2>
          </div>
          {orderedSplits.map((sp) => (
            <SplitCard key={sp.id} ctx={ctx} split={sp} byKey={byKey} onPay={setPaying} onOpenPerson={(n) => setPersonKeyOpen(personKey(n))} />
          ))}
        </>
      )}

      {quiet.length > 0 && (
        <>
          <button className="link" style={{ marginTop: 16 }} onClick={() => setShowQuiet((v) => !v)}>
            {showQuiet ? "Hide" : "Show"} all settled ({quiet.length})
          </button>
          {showQuiet && (
            <div className="chips wrap">
              {quiet.map((p) => (
                <button key={p.key} className="chip pchipbtn" onClick={() => setPersonKeyOpen(p.key)}>
                  <PersonAvatar name={p.name} emoji={p.profile?.emoji} color={p.color} label={p.label} size={22} /> {p.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <p className="hint">Money you lend, borrow or pay back is logged under <Emoji e="🤝" /> Debt, so it changes your account balance but doesn’t count as income or spending. Prefer to just remember the account? Tick “Track only” on the debt and its balance is left alone.</p>

      {openPerson && (
        <PersonSheet
          ctx={ctx}
          p={openPerson}
          onClose={() => setPersonKeyOpen(null)}
          onPay={setPaying}
          onEdit={setEditing}
          onAdd={(direction) => setAdding({ person: openPerson.name, direction })}
          onSettle={() => setSettling(openPerson)}
          onRenamed={(n) => setPersonKeyOpen(personKey(n))}
        />
      )}
      {adding && <DebtForm ctx={ctx} preset={adding} onClose={() => setAdding(null)} />}
      {editing && <DebtForm ctx={ctx} debt={editing} onClose={() => setEditing(null)} />}
      {paying && <PayForm ctx={ctx} debt={paying} onClose={() => setPaying(null)} />}
      {settling && <SettleForm ctx={ctx} p={settling} onClose={() => setSettling(null)} />}
      {splitting && <SplitForm ctx={ctx} onClose={() => setSplitting(false)} />}
    </>
  );
}

/** Pays off every open item with one person in one go. */
function SettleForm({ ctx, p, onClose }: { ctx: Ctx; p: PersonSummary; onClose: () => void }) {
  const { k, toast } = ctx;
  const [acc, setAcc] = useState(k.state.defAcc);

  function save(e: FormEvent) {
    e.preventDefault();
    for (const d of p.open) {
      const left = debtLeft(d);
      if (left > 0) k.payDebt(d.id, left, acc || undefined);
    }
    toast(`All settled with ${p.name} 🎉`);
    onClose();
  }

  return (
    <Modal title={`Settle up with ${p.name}`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="quote">
          <div className="qmain">
            <span>{p.net > 0 ? `${p.name} pays you` : p.net < 0 ? `You pay ${p.name}` : "You’re even"}</span>
            <b className="num">{fmt(Math.abs(p.net), true)}</b>
          </div>
          <div className="frow">
            <span>They owe you</span>
            <b className="num">{fmt(p.owedLeft, true)}</b>
          </div>
          <div className="frow">
            <span>You owe them</span>
            <b className="num">−{fmt(p.oweLeft, true)}</b>
          </div>
        </div>
        <AccountSelect ctx={ctx} value={acc} onChange={setAcc} label={p.net >= 0 ? "Received in" : "Paid from"} />
        <button className="btn" type="submit">
          <Icon name="check" size={18} /> Mark {p.open.length} item{p.open.length === 1 ? "" : "s"} paid
        </button>
        <p className="hint">Each item is recorded as fully paid, so the money in and out nets to the amount above.</p>
      </form>
    </Modal>
  );
}

/** A split bill as a receipt: who's in, each share, and who has paid you back. */
function SplitCard({
  ctx,
  split,
  byKey,
  onPay,
  onOpenPerson,
}: {
  ctx: Ctx;
  split: Split;
  byKey: Map<string, PersonSummary>;
  onPay: (d: Debt) => void;
  onOpenPerson: (name: string) => void;
}) {
  const { k, toast } = ctx;
  const debts = k.state.debts ?? [];
  const people = split.people.map((p) => {
    const d = debts.find((x) => x.id === p.debtId);
    const left = d ? debtLeft(d) : 0;
    const who = byKey.get(personKey(p.name));
    return { ...p, debt: d, left, paid: !d || isSettled(d), who };
  });
  const paidCount = people.filter((p) => p.paid).length;
  const friendsTotal = people.reduce((s, p) => s + p.share, 0);
  const back = Math.round(people.reduce((s, p) => s + (p.share - p.left), 0) * 100) / 100;
  const pct = friendsTotal > 0 ? Math.min(100, Math.round((back / friendsTotal) * 100)) : 100;
  const done = paidCount === people.length;
  const [open, setOpen] = useState(!done);

  async function share() {
    const text = splitSummary(split.title, split.total, people.map((p) => ({ name: p.name, share: p.share, paid: p.paid })), split.myShare, fmt);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Summary copied. Paste it in your group chat.");
      }
    } catch {
      /* share sheet closed */
    }
  }

  return (
    <div className={`card billcard${done ? " done" : ""}`}>
      <button className="billhead" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="billicon" aria-hidden="true">
          <Emoji e="🧾" />
        </span>
        <span className="main">
          <span className="t">{split.title}</span>
          <span className="s">
            {shortDate(split.date)} · {people.length + (split.myShare > 0 ? 1 : 0)} people
          </span>
        </span>
        <span className="billtotal">
          <b className="num">{fmt(split.total, true)}</b>
          {done ? <span className="bstat paid">All paid</span> : <small>total</small>}
        </span>
      </button>

      <div className="billprog">
        <div className="facepile sm" aria-hidden="true">
          {people.slice(0, 5).map((p) => (
            <span key={p.debtId} className={`fp${p.paid ? " ok" : ""}`}>
              <PersonAvatar name={p.name} emoji={p.who?.profile?.emoji} color={p.who?.color} label={p.who?.label} size={26} />
            </span>
          ))}
          {people.length > 5 && <span className="more">+{people.length - 5}</span>}
        </div>
        <span className="num">
          <b>{fmt(back, true)}</b> of {fmt(friendsTotal, true)} back
        </span>
      </div>
      <div className="bar">
        <i style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>

      {open && (
        <>
          <div className="billtear" aria-hidden="true" />
          <ul className="billrows">
            {split.myShare > 0 && (
              <li className="billrow">
                <PersonAvatar name="Me" label="Me" color="#2e7d4f" size={36} />
                <span className="main">
                  <span className="t">You</span>
                  <span className="s">Your share</span>
                </span>
                <b className="num">{fmt(split.myShare, true)}</b>
                <span className="bstat mine" role="img" aria-label="Your share" title="Your share">
                  <Icon name="check" size={16} />
                </span>
              </li>
            )}
            {people.map((p) => (
              <li className={`billrow${p.paid ? " paid" : ""}`} key={p.debtId}>
                <button className="who" onClick={() => onOpenPerson(p.name)} aria-label={`Open ${p.name}'s profile`}>
                  <PersonAvatar name={p.name} emoji={p.who?.profile?.emoji} color={p.who?.color} label={p.who?.label} size={36} />
                  <span className="main">
                    <span className="t">{p.name}</span>
                    <span className="s">{p.paid ? "Paid you back" : p.left < p.share ? `${fmt(p.left, true)} left` : "Waiting"}</span>
                  </span>
                </button>
                <b className="num">{fmt(p.share, true)}</b>
                {p.paid ? (
                  <span className="bstat paid" role="img" aria-label="Paid" title="Paid">
                    <Icon name="check" size={16} stroke={2.6} />
                  </span>
                ) : (
                  <button className="bstat todo" onClick={() => p.debt && onPay(p.debt)}>
                    Mark paid
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="billfoot">
            <button className="btn ghost sm" onClick={() => void share()}>
              <Icon name="send" size={16} /> {done ? "Share receipt" : "Remind the group"}
            </button>
            <span className="sub">
              {paidCount} of {people.length} paid
            </span>
            <button
              className="x"
              aria-label={`Delete split ${split.title}`}
              onClick={() => {
                k.removeSplit(split.id);
                toast(`Removed split “${split.title}”`);
              }}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AccountSelect({ ctx, value, onChange, label, noneLabel = "No account (balances won’t change)" }: { ctx: Ctx; value: string; onChange: (v: string) => void; label: string; noneLabel?: string }) {
  const accounts = activeAccounts(ctx.k.state);
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
        <option value="">{noneLabel}</option>
      </select>
    </label>
  );
}

function DebtForm({ ctx, debt, preset, onClose }: { ctx: Ctx; debt?: Debt; preset?: { person?: string; direction?: "owe" | "owed" }; onClose: () => void }) {
  const { k, toast } = ctx;
  const [direction, setDirection] = useState<"owe" | "owed">(debt?.direction ?? preset?.direction ?? "owed");
  const [person, setPerson] = useState(debt?.person ?? preset?.person ?? "");
  // People you've used before; typing narrows the list, and the one you picked stays highlighted.
  const typed = personKey(person);
  const knownPeople = peopleSummary(k.state).filter((p) => !typed || p.key.includes(typed));
  const [amount, setAmount] = useState(debt ? String(debt.amount) : "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [due, setDue] = useState(toInput(debt?.due));
  const linkedAcc = debt ? (debt.txId ? k.state.txs.find((t) => t.id === debt.txId)?.acc ?? "" : debt.splitId ? debt.acc ?? "" : "") : direction === "owe" ? "" : k.state.defAcc;
  const [acc, setAcc] = useState(linkedAcc);
  const [track, setTrack] = useState(!!debt?.track);
  // Read the live debt so the payments list updates as you edit it.
  const live = debt ? (k.state.debts ?? []).find((d) => d.id === debt.id) ?? debt : undefined;

  function save(e: FormEvent) {
    e.preventDefault();
    const a = parseFloat(amount);
    if (!person.trim() || !a) return;
    if (debt) {
      k.updateDebt(debt.id, { person: person.trim(), amount: a, note: note.trim(), due: fromInput(due), direction, ...(debt.splitId ? {} : { acc, track }) });
      toast("Debt updated");
    } else {
      k.addDebt({ person: person.trim(), direction, amount: a, note: note.trim(), due: fromInput(due), acc: acc || undefined, track: acc && track ? true : undefined }, !!acc);
      toast(direction === "owe" ? `Noted: you owe ${person.trim()} ${fmt(a)}` : `Noted: ${person.trim()} owes you ${fmt(a)}`);
    }
    onClose();
  }

  return (
    <Modal title={debt ? "Edit debt" : "New debt"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={direction === "owed"}
            onClick={() => {
              if (!debt && direction === "owe") setAcc(k.state.defAcc);
              setDirection("owed");
            }}
          >
            Someone owes me
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={direction === "owe"}
            onClick={() => {
              // Borrowed money often never touches your accounts (someone paid for you), so start with none.
              if (!debt && direction === "owed") setAcc("");
              setDirection("owe");
            }}
          >
            I owe someone
          </button>
        </div>
        <label>
          {direction === "owe" ? "Who do you owe?" : "Who owes you?"}
          <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Type a name or pick below" required autoFocus={!preset?.person && knownPeople.length === 0} maxLength={40} autoComplete="off" />
        </label>
        {knownPeople.length > 0 && (
          <div className="quickpeople" style={{ marginTop: -4 }}>
            <div className="chips scroll">
              {knownPeople.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  className={`qperson${personKey(person) === p.key ? " on" : ""}`}
                  aria-pressed={personKey(person) === p.key}
                  onClick={() => setPerson(p.name)}
                >
                  <PersonAvatar name={p.name} emoji={p.profile?.emoji} color={p.color} label={p.label} size={44} />
                  <span>{p.name.split(" ").slice(0, 2).join(" ")}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <label>
          Amount
          <MoneyInput value={amount} onChange={setAmount} placeholder="2,000" required />
        </label>
        <label>
          What for? (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Grab ride, concert ticket" maxLength={60} />
        </label>
        <label>
          Pay back by (optional)
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        {debt?.splitId ? (
          <p className="hint">This came from a split bill. To change its account, edit the bill’s entries in History.</p>
        ) : direction === "owe" && !linkedAcc ? null : (
          // Borrowing is not your money, so there's nothing to pick. Only older debts that already
          // have an account keep the choice, so it can still be changed.
          <AccountSelect
            ctx={ctx}
            value={acc}
            onChange={setAcc}
            label={direction === "owe" ? "Account the borrowed money went into" : "Which account did you lend from?"}
            noneLabel={direction === "owe" ? "None (don’t change any balance)" : undefined}
          />
        )}
        {acc && !debt?.splitId && (
          <>
            <label className="check">
              <input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)} />
              <span>Track only: remember this account, but don’t change its balance</span>
            </label>
            {track ? (
              <p className="hint" style={{ marginTop: -4 }}>
                The account stays on the entry so you can see where it came from, but its balance, card statement and interest are left alone. Payments follow the same rule.
              </p>
            ) : (
              <p className="hint" style={{ marginTop: -4 }}>
                {(() => {
                  const target = k.state.accounts.find((a) => a.id === acc);
                  const amt = parseFloat(amount) || 0;
                  if (!target) return null;
                  const cur = target.currency || undefined;
                  const lowers = direction === "owed";
                  if (!amt) return `${lowers ? "Lowers" : "Adds to"} ${target.name} by the amount you enter.`;
                  if (debt) return `${lowers ? "Lowers" : "Adds to"} ${target.name} by ${fmtIn(amt, cur)}.`;
                  const before = balance(k.state, target);
                  return `${target.name}: ${fmtIn(before, cur)} → ${fmtIn(lowers ? before - amt : before + amt, cur)}. Tick “Track only” if the money didn’t really move through it.`;
                })()}
              </p>
            )}
          </>
        )}
        {!acc && !debt?.splitId && (
          <p className="hint" style={{ marginTop: -4 }}>
            {direction === "owe"
              ? "Just a record of what you owe, so no balance changes. When you pay them back, you’ll pick the account the payment comes from."
              : "Not recorded in any account, so no balance changes. You’ll still see the debt under this person."}
          </p>
        )}
        {live && live.payments.length > 0 && (
          <div className="paylist">
            <div className="eyebrow">Payments</div>
            {live.payments.map((p) => {
              const pAcc = p.txId ? k.state.txs.find((t) => t.id === p.txId)?.acc ?? "" : "";
              return (
                <div className="payrow" key={p.id}>
                  <div className="main">
                    <b className="num">{fmt(p.amount)}</b>
                    <small>{shortDate(p.date)}</small>
                  </div>
                  <select
                    aria-label={`Account for the ${fmt(p.amount)} payment`}
                    value={pAcc}
                    onChange={(e) => {
                      k.updateDebtPayment(live.id, p.id, { acc: e.target.value });
                      toast("Payment updated");
                    }}
                  >
                    {activeAccounts(k.state).map((a) => (
                      <option key={a.id} value={a.id}>
                        {direction === "owe" ? "From " : "Into "}
                        {a.name}
                      </option>
                    ))}
                    <option value="">Not logged</option>
                  </select>
                  <button
                    type="button"
                    className="x"
                    aria-label={`Remove the ${fmt(p.amount)} payment`}
                    onClick={() => {
                      k.removeDebtPayment(live.id, p.id);
                      toast("Payment removed");
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <button className="btn" type="submit">
          {debt ? "Save" : "Add debt"}
        </button>
        {due && <p className="hint">You’ll see it in “Due soon” on Home, and in daily reminders if they’re on.</p>}
      </form>
    </Modal>
  );
}

function PayForm({ ctx, debt, onClose }: { ctx: Ctx; debt: Debt; onClose: () => void }) {
  const { k, toast } = ctx;
  const left = debtLeft(debt);
  const [amount, setAmount] = useState(String(left));
  const [acc, setAcc] = useState(debt.acc && k.state.accounts.some((a) => a.id === debt.acc && !a.archived) ? debt.acc : k.state.defAcc);

  function save(e: FormEvent) {
    e.preventDefault();
    const a = Math.min(left, parseFloat(amount) || 0);
    if (!a) return;
    k.payDebt(debt.id, a, acc || undefined);
    toast(a >= left ? `${debt.direction === "owe" ? `Paid ${debt.person} in full` : `${debt.person} paid in full`} 🎉` : `Recorded ${fmt(a)}; ${fmt(left - a)} left`);
    onClose();
  }

  return (
    <Modal title={debt.direction === "owe" ? `Pay ${debt.person}` : `${debt.person} paid you`} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="sub">
          {fmt(left)} left{debt.note ? ` for ${debt.note}` : ""}.
        </p>
        <label>
          Amount
          <MoneyInput value={amount} onChange={setAmount} required />
        </label>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={parseFloat(amount) === left} onClick={() => setAmount(String(left))}>
            Full {fmt(left)}
          </button>
          <button type="button" className="chip" onClick={() => setAmount(String(Math.round(left * 50) / 100))}>
            Half
          </button>
        </div>
        <AccountSelect ctx={ctx} value={acc} onChange={setAcc} label={debt.direction === "owe" ? "Paid from" : "Received in"} />
        <button className="btn" type="submit">
          Record payment
        </button>
      </form>
    </Modal>
  );
}

function SplitForm({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { k, toast } = ctx;
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [cat, setCat] = useState("Food");
  const [acc, setAcc] = useState(k.state.defAcc);
  const totalNum = parseFloat(total) || 0;
  const s = useSplitState(ctx, totalNum);

  function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !s.ready) return;
    k.addSplit({ title: title.trim(), total: totalNum, myShare: s.myShare, cat, acc: acc || undefined, people: s.shares.filter((p) => p.share > 0) }, !!acc);
    toast(`Split “${title.trim()}” · ${s.names.length} friend${s.names.length === 1 ? "" : "s"} owe you ${fmt(s.friendsTotal)}`);
    onClose();
  }

  return (
    <Modal title="Split a bill" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          What was it?
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Samgyup night" required autoFocus maxLength={50} />
        </label>
        <label>
          Total you paid
          <MoneyInput value={total} onChange={setTotal} placeholder="3,000" required />
        </label>
        <SplitFields s={s} />
        {s.includeMe && s.myShare > 0 && (
          <label>
            Category for my share
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {catNames().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
        <AccountSelect ctx={ctx} value={acc} onChange={setAcc} label="Paid from" />
        <button className="btn" type="submit" disabled={!title.trim() || !s.ready}>
          Split it
        </button>
        <p className="hint">Only your share counts as spending. Your friends’ shares become “owes you” until they pay.</p>
      </form>
    </Modal>
  );
}
