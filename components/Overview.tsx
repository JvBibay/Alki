"use client";

import type { Ctx, PlanTab, Tab } from "@/lib/ui";
import { accCurrency, balance, balanceBase, countedAccounts, netWorth, upcoming } from "@/lib/stats";
import { debtLeft, debtTotals, isSettled } from "@/lib/debts";
import { fmt, fmtIn, shortDate } from "@/lib/format";
import { KIND_LABEL } from "@/lib/types";
import { accountCard } from "@/lib/cardart";
import Sheet from "./Sheet";
import Icon from "./Icon";
import BankLogo from "./BankLogo";
import CardPic from "./CardPic";
import Emoji from "./Emoji";

/**
 * Account overview: all your money on one screen. Money in your accounts, what you owe
 * (card balances and people), what people owe you, your net position, the next bill and
 * payday, and short lists that open the full pages.
 */
export default function Overview({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { state } = ctx.k;
  const nw = netWorth(state);
  const dt = debtTotals(state);
  const accounts = countedAccounts(state);
  const cash = accounts.filter((a) => a.kind !== "credit").reduce((s, a) => s + Math.max(0, balanceBase(state, a)), 0);
  const cards = accounts.filter((a) => a.kind === "credit").reduce((s, a) => s + Math.max(0, -balanceBase(state, a)), 0);
  const debt = cards + dt.owe;
  const net = nw.net; // already includes what you're owed and what you owe

  const list = upcoming(state);
  const nextBill = list.find((u) => u.item.type === "expense");
  const nextPay = list.find((u) => u.item.type === "income");
  const when = (d: number, due: Date) => (d < 0 ? `overdue ${-d}d` : d === 0 ? "today" : d === 1 ? "tomorrow" : d <= 7 ? `in ${d} days` : shortDate(due));

  const open = state.debts.filter((d) => !isSettled(d));
  const owe = open.filter((d) => d.direction === "owe").sort((a, b) => debtLeft(b) - debtLeft(a));
  const owed = open.filter((d) => d.direction === "owed").sort((a, b) => debtLeft(b) - debtLeft(a));
  const goals = state.goals ?? [];
  const shown = [...accounts].sort((a, b) => Math.abs(balanceBase(state, b)) - Math.abs(balanceBase(state, a)));

  const go = (t: Tab, p?: PlanTab) => {
    onClose();
    ctx.goTab(t, p);
  };
  const head = (title: string, sub: string, t: Tab, p?: PlanTab) => (
    <button className="ovhead" onClick={() => go(t, p)}>
      <span>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      <span className="ovmore">
        View <Icon name="chevron" size={16} />
      </span>
    </button>
  );
  const MAX = 4;

  return (
    <Sheet title="Overview" onClose={onClose} className="overview">

      <div className="card ovsummary">
        <div className="ovtiles">
          <div className="ovtile">
            <span>In accounts</span>
            <b className="num">{fmt(cash)}</b>
          </div>
          <div className="ovtile">
            <span>You owe</span>
            <b className={`num${debt > 0 ? " neg" : ""}`}>{fmt(debt)}</b>
          </div>
          <div className="ovtile">
            <span>Owed to you</span>
            <b className={`num${dt.owed > 0 ? " pos" : ""}`}>{fmt(dt.owed)}</b>
          </div>
          <div className="ovtile">
            <span>Net position</span>
            <b className={`num${net < 0 ? " neg" : ""}`}>{fmt(net)}</b>
          </div>
        </div>
        {debt > 0 && (cards > 0 && dt.owe > 0) && (
          <p className="ovnote">
            You owe = {fmt(cards)} on cards + {fmt(dt.owe)} to people.
          </p>
        )}
        <div className="ovnext">
          <button onClick={() => go("plan", "upcoming")}>
            <span className="ovnextlbl">
              <Icon name="plan" size={15} /> Next bill
            </span>
            {nextBill ? (
              <>
                <b>{nextBill.item.name}</b>
                <small>
                  {fmtIn(nextBill.item.amount, accCurrency(state, nextBill.item.acc))} · {when(nextBill.daysLeft, nextBill.due)}
                </small>
              </>
            ) : (
              <small>None added</small>
            )}
          </button>
          <button onClick={() => go("plan", "upcoming")}>
            <span className="ovnextlbl">
              <Icon name="plan" size={15} /> Next payday
            </span>
            {nextPay ? (
              <>
                <b>{nextPay.item.name}</b>
                <small>
                  {fmtIn(nextPay.item.amount, accCurrency(state, nextPay.item.acc))} · {when(nextPay.daysLeft, nextPay.due)}
                </small>
              </>
            ) : (
              <small>None added</small>
            )}
          </button>
        </div>
      </div>

      <div className="card ovsection">
        {head("Accounts", `${accounts.length} counted in your total`, "wallet")}
        {shown.length === 0 ? (
          <p className="ovempty">No accounts yet.</p>
        ) : (
          shown.slice(0, MAX + 2).map((a) => {
            const b = balance(state, a);
            const art = accountCard(a);
            return (
              <div className="ovrow" key={a.id}>
                {art ? <CardPic art={art} w={46} /> : <BankLogo account={a} size={34} />}
                <span className="main">
                  <b>{a.name}</b>
                  <small>{KIND_LABEL[a.kind].replace(/s$/, "")}</small>
                </span>
                <b className={`num${a.kind === "credit" && b < 0 ? " neg" : ""}`}>{fmtIn(a.kind === "credit" ? -b : b, accCurrency(state, a.id))}</b>
              </div>
            );
          })
        )}
        {shown.length > MAX + 2 && <p className="ovempty">+ {shown.length - MAX - 2} more in Wallet</p>}
      </div>

      <div className="card ovsection">
        {head("You owe", owe.length ? `${owe.length} to pay back` : "Nothing to pay back", "plan", "debts")}
        {owe.length === 0 ? (
          <p className="ovempty">You don’t owe anyone. {cards > 0 ? "Card balances are listed under Accounts." : ""}</p>
        ) : (
          owe.slice(0, MAX).map((d) => (
            <div className="ovrow" key={d.id}>
              <span className="ovico neg"><Emoji e="🤝" /></span>
              <span className="main">
                <b>{d.person}</b>
                <small>{d.note || (d.due ? `Due ${shortDate(d.due)}` : "Debt")}</small>
              </span>
              <b className="num neg">{fmt(debtLeft(d))}</b>
            </div>
          ))
        )}
      </div>

      <div className="card ovsection">
        {head("Owed to you", owed.length ? `${owed.length} still to collect` : "Nothing to collect", "plan", "debts")}
        {owed.length === 0 ? (
          <p className="ovempty">Nobody owes you right now.</p>
        ) : (
          owed.slice(0, MAX).map((d) => (
            <div className="ovrow" key={d.id}>
              <span className="ovico pos"><Emoji e="🤝" /></span>
              <span className="main">
                <b>{d.person}</b>
                <small>{d.note || "Owes you"}</small>
              </span>
              <b className="num pos">{fmt(debtLeft(d))}</b>
            </div>
          ))
        )}
      </div>

      <div className="card ovsection">
        {head("Goals", goals.length ? `${goals.length} active` : "No goals yet", "plan", "goals")}
        {goals.length === 0 ? (
          <p className="ovempty">Set a goal to start saving toward something.</p>
        ) : (
          goals.slice(0, MAX).map((g) => {
            const pct = g.target ? Math.min(100, (g.saved / g.target) * 100) : 0;
            return (
              <div className="ovrow ovgoal" key={g.id}>
                <span className="ovico"><Emoji e={g.emoji} /></span>
                <span className="main">
                  <b>{g.name}</b>
                  <span className="bar" aria-hidden="true">
                    <i style={{ width: `${pct}%`, background: "var(--accent)" }} />
                  </span>
                </span>
                <span className="ovgoalamt">
                  <b className="num">{fmt(g.saved)}</b>
                  <small>of {fmt(g.target)}</small>
                </span>
              </div>
            );
          })
        )}
      </div>
    </Sheet>
  );
}
