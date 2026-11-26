"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { Account, Tx, TxType } from "@/lib/types";
import { KIND_LABEL } from "@/lib/types";
import { balance, balanceBase, baseCurrency, monthRange, startOfDay, DAY } from "@/lib/stats";
import { dayLabel, fmt, fmtIn } from "@/lib/format";
import { cardCycle, creditInfo, hasCycle, type CardCycle } from "@/lib/cards";
import { accountCard } from "@/lib/cardart";
import { getInst } from "@/lib/institutions";
import { nextInterestDate, yearlyInterestOn } from "@/lib/interest";
import { prettyNumber } from "@/lib/remindercard";
import Sheet, { Modal } from "./Sheet";
import MoneyInput from "./MoneyInput";
import Icon from "./Icon";
import BankLogo from "./BankLogo";
import CardPic from "./CardPic";
import TxRow from "./TxRow";
import { TrendLine } from "./Charts";
import PayCard from "./PayCard";
import PayEditor from "./PayEditor";
import { payStatus } from "@/lib/remindercard";
import { daysSinceChecked, reconcileHints } from "@/lib/reconcile";

type TypeFilter = "all" | TxType;
type Span = "month" | "last" | "all";

const PAGE = 40;

/** Income, spending and transfers that touch this account in a time range, in the account's own currency. */
function flows(a: Account, txs: Tx[], from: number, to: number) {
  let inn = 0;
  let out = 0;
  let count = 0;
  for (const t of txs) {
    if (t.date < from || t.date >= to) continue;
    if (t.cat === "Adjustment" || t.track) continue; // balance adjustments just match the real balance; they aren't money in or out
    if (t.acc === a.id) {
      if (t.type === "income") inn += t.amount;
      else out += t.amount; // expense, or a transfer going out
      count++;
    } else if (t.to === a.id && t.type === "transfer") {
      inn += t.toAmount ?? t.amount;
      count++;
    }
  }
  return { inn, out, count };
}

/** "Due Dec 5 · in 12 days", "Overdue by 2 days", "Paid for this statement"… */
function dueText(c: CardCycle): string {
  if (c.status === "paid") return "Paid for this statement";
  if (c.status === "none") return "No payment due";
  if (c.status === "min") return "Minimum paid";
  if (c.status === "overdue") return `Overdue by ${-c.daysLeft} day${c.daysLeft === -1 ? "" : "s"}`;
  if (c.daysLeft === 0) return "Due today";
  if (c.daysLeft === 1) return "Due tomorrow";
  const date = new Date(c.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  return `Due ${date} · in ${c.daysLeft} days`;
}

const dateText = (n: number) => new Date(n).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

/**
 * One account on a full screen: balance, what happened this month, a 30-day trend, the account's
 * details, and its own transaction history. Editing the account opens the existing edit form.
 */
export default function AccountDetail({ ctx, accountId, onClose, onEdit }: { ctx: Ctx; accountId: string; onClose: () => void; onEdit: (a: Account) => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const a = state.accounts.find((x) => x.id === accountId);
  const [type, setType] = useState<TypeFilter>("all");
  const [span, setSpan] = useState<Span>("month");
  const [limit, setLimit] = useState(PAGE);
  const [paying, setPaying] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [payEdit, setPayEdit] = useState(false);

  // If the account is deleted from the edit form, there's nothing left to show.
  useEffect(() => {
    if (!a) onClose();
  }, [a, onClose]);

  const now = Date.now();
  const [thisFrom, thisTo] = useMemo(() => monthRange(new Date(now).getFullYear(), new Date(now).getMonth()), [now]);
  const [lastFrom, lastTo] = useMemo(() => monthRange(new Date(now).getFullYear(), new Date(now).getMonth() - 1), [now]);

  const trend = useMemo(() => {
    if (!a) return [];
    const today = startOfDay(Date.now());
    return Array.from({ length: 30 }, (_, i) => {
      const b = balance(state, a, today - (29 - i) * DAY + DAY - 1);
      return a.kind === "credit" ? Math.max(0, -b) : b;
    });
  }, [state, a]);

  const mine = useMemo(() => (a ? state.txs.filter((t) => t.acc === a.id || t.to === a.id).sort((x, y) => y.date - x.date) : []), [state.txs, a]);

  if (!a) return null;

  const cur = a.currency || baseCurrency(state);
  const credit = a.kind === "credit";
  const bal = balance(state, a);
  const shown = credit ? Math.max(0, -bal) : bal;
  const art = accountCard(a);
  const inst = getInst(a.inst);
  const ci = credit ? creditInfo(state, a) : null;
  const cycle = credit ? cardCycle(state, a) : null;
  const isDefault = state.defAcc === a.id;
  const kept = !credit ? a.maintaining ?? 0 : 0;
  // A rough monthly interest figure from the yearly rate, after withholding tax. Display only.
  const nextInterest = nextInterestDate(a);
  const earned = mine.filter((t) => t.cat === "Interest" && t.acc === a.id).reduce((sum, t) => sum + t.amount, 0);
  const interest = !credit && a.rate && bal > 0 ? Math.round((yearlyInterestOn(a, bal) / 12) * (1 - (a.tax ?? 0) / 100) * 100) / 100 : 0;
  const kindLabel = KIND_LABEL[a.kind].replace(/s$/, "");
  const instPart = inst && inst.name !== a.name ? inst.name : null;
  const kindPart = instPart && instPart.toLowerCase().includes(kindLabel.toLowerCase()) ? null : kindLabel;
  const heroKind = [instPart, kindPart, cur].filter(Boolean).join(" · ");

  const month = flows(a, state.txs, thisFrom, thisTo);
  const inLabel = credit ? "Paid" : "In";
  const outLabel = credit ? "Spent" : "Out";
  const net = credit ? month.out - month.inn : month.inn - month.out;
  const netLabel = credit ? "Change in owed" : "Net";
  const netGood = credit ? net <= 0 : net >= 0;

  const range: [number, number] = span === "month" ? [thisFrom, thisTo] : span === "last" ? [lastFrom, lastTo] : [-Infinity, Infinity];
  const list = mine.filter((t) => (type === "all" || t.type === type) && t.date >= range[0] && t.date < range[1]);
  const visible = list.slice(0, limit);
  const groups: { label: string; items: Tx[] }[] = [];
  for (const t of visible) {
    const label = dayLabel(t.date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(t);
    else groups.push({ label, items: [t] });
  }

  const toggleArchive = () => {
    const next = !a.archived;
    k.updateAccount(a.id, { archived: next || undefined });
    toast(next ? `${a.name} archived` : `${a.name} restored`);
    if (next) onClose();
  };

  function remove(t: Tx) {
    k.removeTx(t.id);
    toast(`Deleted ${fmtIn(t.amount, cur)}`, () => k.restoreTx(t));
  }

  const urgent = cycle && (cycle.status === "overdue" || (cycle.status === "due" && cycle.daysLeft <= 3));
  const firstTx = mine.length ? mine[mine.length - 1].date : null;

  return (
    <Sheet
      title={a.name}
      onClose={onClose}
      right={
        <button className="iconbtn" onClick={() => onEdit(a)} aria-label={`Edit ${a.name}`}>
          <Icon name="edit" size={18} />
        </button>
      }
    >
      {/* ---- Hero ---- */}
      <div className="ad-hero" style={{ ["--account-color" as string]: a.color }}>
        <div className="ad-top">
          {art ? (
            <CardPic art={art} w={86} className="rowcard" />
          ) : (
            <span className="ad-logo">
              <BankLogo account={a} size={44} />
            </span>
          )}
          <div className="ad-meta">
            <div className="ad-kind">
              {heroKind}
            </div>
            <div className="ad-tags">
              {isDefault && <span className="ad-tag">Default</span>}
              {a.archived && <span className="ad-tag">Archived</span>}
              {a.excludeFromTotal && <span className="ad-tag">Not in total</span>}
            </div>
          </div>
        </div>
        <div className="ad-label">{credit ? "Used credit" : "Balance"}</div>
        <div className="ad-amount num">{fmtIn(shown, cur, true)}</div>
        {kept > 0 && (
          <div className="ad-sub">
            Spendable {fmtIn(Math.max(0, bal - kept), cur)} · {fmtIn(kept, cur)} kept aside
          </div>
        )}
        {credit && ci && ci.limit > 0 && (
          <>
            <div className="ad-bar" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (ci.used / ci.limit) * 100)}%` }} />
            </div>
            <div className="ad-sub">
              {ci.available < 0 ? `${fmtIn(-ci.available, ci.holder.currency || baseCurrency(state))} over your limit` : `${fmtIn(ci.available, ci.holder.currency || baseCurrency(state))} available`} of{" "}
              {fmtIn(ci.limit, ci.holder.currency || baseCurrency(state))}
            </div>
          </>
        )}
        {credit && hasCycle(a) && cycle && (
          <div className={`ad-due${urgent ? " urgent" : ""}`}>
            <Icon name="bell" size={15} />
            <span>
              {dueText(cycle)}
              {cycle.status !== "paid" && cycle.status !== "none" && ` · ${fmtIn(cycle.left, cur)} to pay`}
            </span>
          </div>
        )}
        {cur !== baseCurrency(state) && <div className="ad-sub">≈ {fmt(Math.abs(balanceBase(state, a)))} in {baseCurrency(state)}</div>}
      </div>

      {/* ---- Quick actions ---- */}
      <div className={`ad-actions${credit ? " four" : ""}`}>
        <button onClick={() => ctx.open({ kind: "add", type: "expense", acc: a.id })}>
          <span className="ico">
            <Icon name="send" size={18} />
          </span>
          Expense
        </button>
        <button onClick={() => ctx.open({ kind: "add", type: "income", acc: a.id })}>
          <span className="ico">
            <Icon name="plus" size={18} />
          </span>
          {a.kind === "credit" ? "Refund / credit" : "Income"}
        </button>
        <button onClick={() => ctx.open({ kind: "add", type: "transfer", acc: a.id })}>
          <span className="ico">
            <Icon name="transfer" size={18} />
          </span>
          Transfer
        </button>
        {credit && (
          <button onClick={() => setPaying(true)}>
            <span className="ico">
              <Icon name="check" size={18} />
            </span>
            Pay card
          </button>
        )}
      </div>

      {/* ---- This month ---- */}
      <div className="sectionhead">
        <h2>This month</h2>
        <span className="sub">{new Date(now).toLocaleDateString("en-PH", { month: "long" })}</span>
      </div>
      <div className="ad-stats">
        <div className="card">
          <div className="eyebrow">{inLabel}</div>
          <b className="num in">{fmtIn(month.inn, cur)}</b>
        </div>
        <div className="card">
          <div className="eyebrow">{outLabel}</div>
          <b className="num out">{fmtIn(month.out, cur)}</b>
        </div>
        <div className="card">
          <div className="eyebrow">{netLabel}</div>
          <b className={`num ${netGood ? "in" : "out"}`}>
            {net >= 0 ? "+" : "−"}
            {fmtIn(Math.abs(net), cur)}
          </b>
        </div>
      </div>

      {/* ---- Trend ---- */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="eyebrow" style={{ marginTop: 10 }}>
          {credit ? "Used credit" : "Balance"} · last 30 days
        </div>
        {mine.length === 0 && a.opening === 0 ? <p className="sub" style={{ padding: "10px 0 14px" }}>Your balance trend appears here once you log something.</p> : <TrendLine values={trend} height={96} />}
      </div>

      {/* ---- Details ---- */}
      <div className="sectionhead">
        <h2>Account info</h2>
      </div>
      <div className="card ad-info">
        <Info label="Type" value={KIND_LABEL[a.kind].replace(/s$/, "")} />
        {inst && <Info label="Provider" value={inst.name} />}
        {a.payName && <Info label="Account name" value={a.payName} />}
        {a.payNumber && <Info label="Account no." value={prettyNumber(a.payNumber)} />}
        <Info label="Currency" value={cur} />
        {(!credit || a.opening !== 0) && <Info label={credit ? "Owed at start" : "Opening balance"} value={fmtIn(credit ? Math.abs(a.opening) : a.opening, cur)} />}
        {credit && ci && ci.limit > 0 && <Info label="Credit limit" value={fmtIn(ci.limit, ci.holder.currency || baseCurrency(state))} />}
        {credit && ci && ci.shared.length > 0 && <Info label="Shares limit with" value={ci.shared.map((x) => x.name).join(", ")} />}
        {credit && a.statementDay && <Info label="Statement closes" value={`Day ${a.statementDay} of the month`} />}
        {credit && a.dueDay && <Info label="Payment due" value={`Day ${a.dueDay} of the month`} />}
        {credit && cycle && cycle.statementBalance > 0 && <Info label="Last statement" value={fmtIn(cycle.statementBalance, cur)} />}
        {credit && cycle && cycle.minDue > 0 && <Info label="Minimum due" value={fmtIn(cycle.minDue, cur)} />}
        {firstTx && <Info label="First activity" value={dateText(firstTx)} />}
        <Info label="Transactions" value={String(mine.length)} />
        <Info label="Counts in net worth" value={a.excludeFromTotal || a.archived ? "No" : "Yes"} />
        {kept > 0 && <Info label="Maintaining balance" value={fmtIn(kept, cur)} />}
        {!credit && a.rate ? <Info label="Interest rate" value={`${a.rate}% a year`} /> : null}
        {!credit && a.rate && a.rate2 && a.tierAt ? <Info label="Higher rate" value={`${a.rate2}% ${a.tierMode === "whole" ? "on the whole balance" : "on the part"} above ${fmtIn(a.tierAt, cur)}`} /> : null}
        {!credit && a.rate && a.interestFrom ? <Info label="Credited" value={`${(a.interestFreq ?? "monthly").replace(/^./, (c) => c.toUpperCase())} · ${a.tax ?? 0}% tax`} /> : null}
        {nextInterest && <Info label="Next interest credit" value={dateText(nextInterest)} />}
        {earned > 0 && <Info label="Interest earned so far" value={fmtIn(earned, cur)} />}
        {interest > 0 && <Info label="Estimated per month" value={`≈ ${fmtIn(interest, cur)} after tax`} />}
        <div className="row" style={{ borderBottom: 0 }}>
          <div className="main">
            <div className="t">Default account</div>
            <div className="s">New entries use it unless you pick another</div>
          </div>
          {isDefault ? (
            <span className="chip">Default</span>
          ) : (
            <button
              className="btn ghost sm"
              disabled={a.archived}
              onClick={() => {
                k.setDefAcc(a.id);
                toast(`${a.name} is now your default account.`);
              }}
            >
              Make default
            </button>
          )}
        </div>
      </div>

      {/* ---- Tools ---- */}
      <div className="sectionhead">
        <h2>Tools</h2>
      </div>
      <div className="card">
        <button className="row rowbtn" onClick={() => setAdjusting(true)}>
          <div className="ico">
            <Icon name="sliders" size={20} />
          </div>
          <div className="main">
            <div className="t">Check balance</div>
            <div className="s">
              {checkedLabel(a)} Match what your bank or wallet really shows. It won’t count as income or spending.
            </div>
          </div>
        </button>
        {!credit && a.kind !== "locked" && (
          <button className="row rowbtn" onClick={() => setPayEdit(true)}>
            <div className="ico">
              <Icon name="send" size={20} />
            </div>
            <div className="main">
              <div className="t">Payment QR and details</div>
              <div className="s">{payStatus(a)}. Shown on reminder cards when you pick this account.</div>
            </div>
          </button>
        )}
        <button className="row rowbtn" onClick={toggleArchive}>
          <div className="ico">
            <Icon name="history" size={20} />
          </div>
          <div className="main">
            <div className="t">{a.archived ? "Restore account" : "Archive account"}</div>
            <div className="s">{a.archived ? "Bring it back to your lists and totals." : "Hide a closed or old account. Its history stays."}</div>
          </div>
        </button>
      </div>

      {/* ---- History ---- */}
      <div className="sectionhead">
        <h2>Transactions</h2>
        <span className="sub">
          {list.length} {list.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div className="seg" role="tablist" aria-label="Period" style={{ marginBottom: 8 }}>
        {(
          [
            ["month", "This month"],
            ["last", "Last month"],
            ["all", "All time"],
          ] as [Span, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={span === id}
            onClick={() => {
              setSpan(id);
              setLimit(PAGE);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="seg small" role="tablist" aria-label="Type" style={{ marginBottom: 10 }}>
        {(
          [
            ["all", "All"],
            ["expense", "Expenses"],
            ["income", "Income"],
            ["transfer", "Transfers"],
          ] as [TypeFilter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={type === id}
            onClick={() => {
              setType(id);
              setLimit(PAGE);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card empty">
          {mine.length === 0 ? "Nothing logged on this account yet." : "No entries for this filter. Try another period or type."}
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.label}>
              <div className="day">
                <span>{g.label}</span>
              </div>
              <div className="card">
                {g.items.map((t) => (
                  <TxRow key={t.id} tx={t} accounts={state.accounts} onDelete={() => remove(t)} onEdit={() => ctx.open({ kind: "add", edit: t })} />
                ))}
              </div>
            </section>
          ))}
          {list.length > visible.length && (
            <button className="btn ghost wide" style={{ marginTop: 12 }} onClick={() => setLimit((n) => n + PAGE)}>
              Show more ({list.length - visible.length} left)
            </button>
          )}
        </>
      )}

      <button className="btn ghost wide" style={{ marginTop: 18 }} onClick={() => onEdit(a)}>
        <Icon name="edit" size={18} /> Edit account
      </button>

      {paying && <PayCard ctx={ctx} card={a} onClose={() => setPaying(false)} />}
      {adjusting && <AdjustModal ctx={ctx} a={a} onClose={() => setAdjusting(false)} />}
      {payEdit && <PayEditor ctx={ctx} account={a} onClose={() => setPayEdit(false)} />}
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <div className="main">
        <div className="s">{label}</div>
      </div>
      <b style={{ textAlign: "right", overflowWrap: "anywhere" }}>{value}</b>
    </div>
  );
}

function checkedLabel(a: Account): string {
  const d = daysSinceChecked(a);
  if (d === null) return "Never checked.";
  return d === 0 ? "Checked today." : d === 1 ? "Checked yesterday." : `Last checked ${d} days ago.`;
}

/**
 * "My real balance is X": records the difference as a balance adjustment, so the account matches what
 * the bank shows. Adjustments are kept out of income and spending totals.
 */
function AdjustModal({ ctx, a, onClose }: { ctx: Ctx; a: Account; onClose: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const cur = a.currency || baseCurrency(state);
  const credit = a.kind === "credit";
  const bal = balance(state, a);
  const current = Math.round((credit ? Math.max(0, -bal) : bal) * 100) / 100;
  const [value, setValue] = useState(String(current));
  const target = parseFloat(value);
  const valid = Number.isFinite(target) && (!credit || target >= 0);
  const diff = valid ? Math.round((target - current) * 100) / 100 : 0;
  // A card's "balance" is what you owe: owing more is like spending; owing less is like a payment.
  const type: TxType = credit ? (diff > 0 ? "expense" : "income") : diff > 0 ? "income" : "expense";

  // In balance terms (a card's balance is negative when you owe) so the hints can compare with each entry's effect.
  const hints = valid ? reconcileHints(state, a, credit ? -diff : diff) : [];

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return onClose();
    k.updateAccount(a.id, { checkedAt: Date.now() });
    if (diff === 0) {
      toast("Matches. Marked as checked");
      return onClose();
    }
    k.addTx({ type, amount: Math.abs(diff), cat: "Adjustment", note: "Balance adjustment", acc: a.id, date: Date.now() });
    toast(`Balance adjusted by ${diff > 0 ? "+" : "−"}${fmtIn(Math.abs(diff), cur)}`);
    onClose();
  }

  return (
    <Modal title="Check balance" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="sub">
          {credit ? "Used credit" : "Balance"} in Kwenta right now: <b>{fmtIn(current, cur, true)}</b>
        </p>
        <label>
          {credit ? "What your bank says you owe" : "What your account really has"}
          <MoneyInput value={value} onChange={setValue} currency={cur} placeholder="0" />
        </label>
        {valid && diff !== 0 ? (
          <p className="sub">
            Kwenta will add a <b>{fmtIn(Math.abs(diff), cur, true)}</b> {diff > 0 ? (credit ? "increase" : "credit") : credit ? "decrease" : "deduction"} labelled “Balance adjustment”. It won’t show up
            as income or spending.
          </p>
        ) : (
          <p className="sub">It already matches. Change the number if your bank shows something different.</p>
        )}
        {hints.length > 0 && (
          <div className="card">
            <p className="sub" style={{ margin: "8px 12px 0" }}>
              <b>Before you adjust, a recorded entry may explain it:</b>
            </p>
            {hints.map((h, i) =>
              h.tx ? (
                <div className="row" key={h.tx.id}>
                  <div className="main">
                    <div className="t">
                      {h.tx.note || h.tx.cat} · {fmtIn(h.tx.amount, cur, true)}
                    </div>
                    <div className="s">
                      {dayLabel(h.tx.date)} ·{" "}
                      {h.kind === "flipped"
                        ? `Logged as ${h.tx.type}, but maybe it was ${h.tx.type === "income" ? "spending" : "income"}. Flipping it closes the gap exactly.`
                        : "Your bank may not have this one (a duplicate, or on another account). Removing it closes the gap exactly."}
                    </div>
                  </div>
                  {h.kind === "flipped" && (
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        const tx = h.tx!;
                        k.updateTx({ ...tx, type: tx.type === "income" ? "expense" : "income" });
                        k.updateAccount(a.id, { checkedAt: Date.now() });
                        toast("Entry flipped. Balance now matches");
                        onClose();
                      }}
                    >
                      Flip it
                    </button>
                  )}
                </div>
              ) : (
                <div className="row" key={`m${i}`}>
                  <div className="main">
                    <div className="t">Something wasn’t logged</div>
                    <div className="s">
                      Add the missing {diff > 0 === !credit ? "income" : "expense"} in Home or History so it has a real category. Saving the adjustment below hides the cause.
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
        <button className="btn" type="submit" disabled={!valid}>
          {diff === 0 ? "Matches, mark as checked" : "Save as adjustment"}
        </button>
      </form>
    </Modal>
  );
}
