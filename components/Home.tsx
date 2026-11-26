"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { catColor, catEmoji, catNames } from "@/lib/categories";
import type { Ctx } from "@/lib/ui";
import { hasSpeech, listen, parseSentence } from "@/lib/ui";
import { accCurrency, forecast, installmentDues, Period, periodRange, streak, sumRange, upcoming, type UpcomingItem } from "@/lib/stats";
import { accountName, fmt, fmtIn, shortDate } from "@/lib/format";
import { greeting, insight } from "@/lib/insights";
import { ALKI_SIZES, LiveAlki } from "./Mascot";
import BandScene from "./BandScene";
import Icon from "./Icon";
import TxRow from "./TxRow";
import BankLogo from "./BankLogo";
import HomeMenu from "./HomeMenu";
import { lookOf } from "@/lib/closet";
import { pendingRecap } from "@/lib/recap";
import { dueSoon, snoozeChoices, statementText, whenText, withSnooze } from "@/lib/reminders";
import PayCard from "./PayCard";
import { billEmoji } from "@/lib/billicons";
import { detectIntent, namedAccount, usualAccount } from "@/lib/intents";
import { describeIntent } from "@/lib/assistant";
import { runReply } from "@/lib/runReply";
import BillPay from "./BillPay";
import TrialBanner from "./TrialBanner";
import StatementFix from "./StatementFix";
import type { Account } from "@/lib/types";
import { alkiMood, type Mood } from "@/lib/mood";
import { budgetList, paceOf, periodInfo } from "@/lib/budgets";
import Feedback from "./Feedback";
import { askDue, feedbackAvailable, feedbackMeta, flushFeedback, saveFeedbackMeta, snoozeFor } from "@/lib/feedback";

const MOOD_LABEL: Record<Mood, string> = {
  excited: "feeling excited",
  happy: "feeling happy",
  neutral: "feeling calm",
  sleepy: "feeling sleepy",
  worried: "feeling worried",
  sad: "feeling sad",
  angry: "feeling upset",
};
import Emoji, { EmojiText } from "./Emoji";
import Fire from "./Fire";

export default function Home({ ctx }: { ctx: Ctx }) {
  const { k, toast, open, goTab } = ctx;
  const { state } = k;
  // Undo buttons run later, so they read the app's latest state through this.
  const kRef = useRef(k);
  kRef.current = k;
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const [period, setPeriod] = useState<Period>("day");
  const recapDue = pendingRecap(state);
  const due = dueSoon(state);
  // Items hidden by "Snooze", so there's always a way to see (or undo) them.
  const snoozedCount = dueSoon({ ...state, settings: { ...state.settings, snoozed: undefined } }).length - due.length;
  const [moreActions, setMoreActions] = useState(false);
  const [billPay, setBillPay] = useState<UpcomingItem | null>(null);
  const [allowOpen, setAllowOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState<string | null>(null);
  const [payCard, setPayCard] = useState<Account | null>(null);
  const [stmtCard, setStmtCard] = useState<Account | null>(null);
  const mood = alkiMood(state);
  // Alki's check-in: once, after a week of real use
  const [ask, setAsk] = useState(false);
  const [fb, setFb] = useState<number | null>(null);
  useEffect(() => {
    if (!feedbackAvailable()) return;
    setAsk(askDue(feedbackMeta(), state.txs.length));
    void flushFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const answered = (done: boolean) => {
    saveFeedbackMeta(done ? { ...feedbackMeta(), done: true } : { ...feedbackMeta(), snooze: snoozeFor() });
    setAsk(false);
  };
  const alkiPx = ALKI_SIZES[state.settings.alkiSize ?? "medium"]?.home ?? 92;

  const now = new Date();
  const [pFrom, pTo] = periodRange(period);
  const per = sumRange(state, pFrom, pTo);
  const st = streak(state.txs);
  const f = forecast(state);
  // Upcoming shows what's further out; anything already in Due soon isn't listed twice.
  const dueIds = new Set(due.map((d) => d.id));
  const up = upcoming(state).filter((u) => !dueIds.has(`p-${u.item.id}`)).slice(0, 4);
  const instUp = installmentDues(state).filter((d) => d.daysLeft <= 31 && !dueIds.has(`i-${d.plan.id}`)).slice(0, 3);
  const recent = [...state.txs].sort((a, b) => b.date - a.date).slice(0, 5);
  const budgeted = budgetList(state);
  const atRisk = budgeted.filter((b) => paceOf(b) !== "ok").sort((a, b) => b.pct - a.pct);
  // Things Alki says when tapped on Home.
  const alkiLines = [
    st.count > 1 ? `${st.count}-day streak! Keep it going 🔥` : st.loggedToday ? "" : "Log something today to start a streak! 🔥",
    f.pay.daysLeft === 0 ? "Sweldo day! 🎉 Treat yourself a little, save a lot." : `${f.pay.daysLeft} day${f.pay.daysLeft === 1 ? "" : "s"} until sweldo. Kaya natin ’to! 💪`,
    f.safeDaily > 0 ? `Keep it under ${fmt(f.safeDaily)} a day and you’re good. 👍` : "",
    per.expense === 0 && period === "day" ? "No spending today yet. Nice! 😌" : "",
    state.settings.name ? `Hi ${state.settings.name}! 👋` : "",
  ].filter(Boolean);

  async function submit(input: string) {
    if (state.accounts.length === 0) {
      toast("Add an account first, like Cash or GCash.");
      goTab("wallet");
      return;
    }
    // Bigger intents first: paying a bill, splitting, settling a debt, several entries in one message.
    if (!input.includes("?")) {
      const intent = detectIntent(input.trim(), state);
      if (intent?.kind === "say") {
        toast(intent.text);
        return;
      }
      if (intent) {
        const cards = runReply(() => kRef.current, { intent });
        toast(describeIntent(intent, state), () => cards.forEach((c) => c.undo()));
        setText("");
        return;
      }
    }
    const parsed = await parseSentence(input, state);
    if (!parsed) {
      toast("Include an amount, like “lunch 180”.");
      return;
    }
    // No account named: use the one you usually use for this payee or category.
    if (parsed.type !== "transfer" && !namedAccount(state, input.toLowerCase())) {
      const u = usualAccount(state, parsed.type, parsed.cat, parsed.note);
      if (u) parsed.acc = u.acc;
    }
    const tx = k.addTx(parsed);
    // Say which day it went on when that is not today, so a date that was misread (or not understood) is easy to spot.
    const dateNote =
      new Date(tx.date).toDateString() === new Date().toDateString()
        ? ""
        : ` · ${new Date(tx.date).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}`;
    const msg =
      tx.type === "transfer"
        ? `Moved ${fmtIn(tx.amount, accCurrency(state, tx.acc))} ${accountName(state.accounts, tx.acc)} → ${accountName(state.accounts, tx.to)}`
        : `Logged ${fmtIn(tx.amount, accCurrency(state, tx.acc))} · ${tx.cat}${dateNote}`;
    toast(msg, () => k.removeTx(tx.id));
    setText("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit(text);
  }

  function toggleMic() {
    if (stopRef.current) {
      stopRef.current();
      return;
    }
    const stop = listen(
      (t) => void submit(t),
      () => {
        stopRef.current = null;
        setListening(false);
      },
      () => toast("Couldn’t use the microphone. Try typing instead."),
    );
    if (stop) {
      stopRef.current = stop;
      setListening(true);
    }
  }

  const quick: { icon: string; label: string; onClick: () => void }[] = [
    { icon: "−", label: "Expense", onClick: () => open({ kind: "add", type: "expense" }) },
    { icon: "+", label: "Income", onClick: () => open({ kind: "add", type: "income" }) },
    { icon: "📷", label: "Scan", onClick: () => open({ kind: "add", type: "expense", scan: true }) },
    { icon: "⇄", label: "Transfer", onClick: () => open({ kind: "add", type: "transfer" }) },
    { icon: "🧭", label: "Budgets", onClick: () => goTab("plan", "budgets") },
    { icon: "🎯", label: "Goals", onClick: () => goTab("plan", "goals") },
    { icon: "🗓️", label: "Bills", onClick: () => goTab("plan", "upcoming") },
    { icon: "💳", label: "Installments", onClick: () => goTab("plan", "installments") },
    { icon: "📊", label: "Stats", onClick: () => open({ kind: "stats" }) },
    { icon: "💬", label: "Ask Alki", onClick: () => open({ kind: "chat" }) },
  ];

  // Alki's scene fills the whole header as a landscape, so Alki itself stands in front without the circle.
  const { scene: bandScene, ...bandLook } = lookOf(state.settings);

  return (
    <>
      <header className={`band withalki homeband${bandScene ? " hasscene" : ""}`} style={{ ["--alki-w" as string]: `${alkiPx}px` }}>
        {bandScene && <BandScene id={bandScene} motion={state.settings.alkiMotion !== false} />}
        <LiveAlki
          size={alkiPx}
          look={bandLook}
          motion={state.settings.alkiMotion !== false}
          lines={alkiLines}
          mood={mood}
          className="bandalki"
        />
        <div className="bandtop">
          <button className="streakpill" onClick={() => open({ kind: "streak" })} aria-label={`${st.count} day streak. See badges`}>
            <Fire size={18} lit={st.loggedToday} /> {st.count}
          </button>
          <HomeMenu ctx={ctx} />
        </div>
        <div className="eyebrow" data-avoid>
          {now.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h1 className="hello withroom" data-avoid>
          {greeting()}
          {state.settings.name ? `, ${state.settings.name}` : ""}!
        </h1>
      </header>

      {/* One column on phones; two side by side on tablets (see .homecols in globals.css). */}
      <div className="homecols">
      <div className="homecol">
      <form className="qa" onSubmit={onSubmit} autoComplete="off">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell Alki: lunch 180 gcash"
          aria-label="Describe a transaction"
          enterKeyHint="done"
        />
        {hasSpeech() && (
          <button type="button" className={`roundbtn${listening ? " on" : ""}`} onClick={toggleMic} aria-label={listening ? "Stop listening" : "Speak"}>
            <Icon name="mic" />
          </button>
        )}
        <button className="roundbtn primary" type="submit" aria-label="Log it">
          <Icon name="send" />
        </button>
      </form>

      <button className="payday" onClick={() => setAllowOpen((v) => !v)} aria-expanded={allowOpen}>
        <div>
          <div className="eyebrow">Next sweldo</div>
          <div className="big">
            {f.pay.daysLeft === 0 ? "It’s payday! 🎉" : `${f.pay.daysLeft} day${f.pay.daysLeft === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="right">
          <div className="eyebrow">Safe to spend per day</div>
          {f.pay.daysLeft === 0 ? (
            <b className="num">Payday today</b>
          ) : f.over > 0 ? (
            <b className="num over">Over by {fmt(f.over)}</b>
          ) : (
            <b className="num">{fmt(f.safeDaily)}</b>
          )}
          <small>{shortDate(f.pay.date)} · tap for details</small>
        </div>
      </button>
      {allowOpen && (
        <div className="card allowbreak" role="region" aria-label="How the daily allowance is worked out">
          <div className="row"><span>Money you can spend now</span><b className="num">{fmt(f.liquid)}</b></div>
          <div className="row"><span>− Bills and installments before payday</span><b className="num">{fmt(f.bills)}</b></div>
          <div className="row"><span>− Credit card payments before payday</span><b className="num">{fmt(f.cards)}</b></div>
          <div className="row total"><span>= Left to spend</span><b className={`num${f.over > 0 ? " over" : ""}`}>{f.over > 0 ? `Over by ${fmt(f.over)}` : fmt(f.available)}</b></div>
          <div className="row"><span>÷ Days until payday</span><b className="num">{f.pay.daysLeft}</b></div>
          <button className="link" onClick={() => open({ kind: "stats" })}>See stats ›</button>
        </div>
      )}

      <section className="saycard card" style={{ ["--alki-w" as string]: `${alkiPx}px` }}>
        <b>
          Alki <Emoji e={mood.emoji} /> <span className="moodtag">{MOOD_LABEL[mood.mood]}</span>
        </b>
        <p>
          <EmojiText text={mood.mood === "neutral" || mood.mood === "happy" ? insight(state) : mood.line} />
        </p>
        <button className="link" onClick={() => open({ kind: "chat" })}>
          Chat with Alki ›
        </button>
      </section>

      {ask && (
        <section className="card askcard" aria-label="How is Kwenta">
          <b>How’s Kwenta so far?</b>
          <p className="sub">It takes 10 seconds and helps me get better.</p>
          <div className="askrow">
            {[
              { r: 1, e: "😕", l: "Not great" },
              { r: 2, e: "🙂", l: "It’s okay" },
              { r: 3, e: "😍", l: "Love it" },
            ].map((x) => (
              <button key={x.r} className="chip" onClick={() => setFb(x.r)}>
                <Emoji e={x.e} /> {x.l}
              </button>
            ))}
          </div>
          <button className="link" onClick={() => answered(false)}>
            Not now
          </button>
        </section>
      )}
      {fb !== null && <Feedback screen="home" name={state.settings.name} rating={fb} onClose={() => setFb(null)} onSent={() => answered(true)} toast={toast} />}

      <TrialBanner ctx={ctx} />

      {due.length > 0 && (
        <section className="duesoon card" aria-label="Due soon">
          <div className="duehead">
            <b><Emoji e="⏰" /> Due soon</b>
            <span className="sub">
              {due.length} item{due.length === 1 ? "" : "s"}
            </span>
          </div>
          {due.slice(0, 3).map((d) => (
            <div className={`dueitem${d.daysLeft < 0 && d.kind !== "statement" ? " overdue" : ""}`} key={d.id}>
              <div className="main">
                <div className="t">{d.title}</div>
                <div className="s">
                  {d.kind === "statement" ? statementText(-d.daysLeft) : d.kind === "deposit" ? (d.daysLeft <= 0 ? "Ready to collect 🎉" : whenText(d.daysLeft).replace("Due", "Matures")) : whenText(d.daysLeft)}
                  {d.min ? ` · Minimum ${fmtIn(d.min, d.currency)}` : ""}
                  {" · "}
                  <button className="link snz" onClick={() => setSnoozeOpen(snoozeOpen === d.id ? null : d.id)} aria-expanded={snoozeOpen === d.id}>
                    Snooze
                  </button>
                </div>
              </div>
              <b className="num">{fmtIn(d.amount, d.currency)}</b>
              <button
                className="chip"
                onClick={() => {
                  if (d.kind === "debt") return goTab("plan", "debts");
                  if (d.kind === "deposit") return goTab("wallet");
                  if (d.kind === "card") return setPayCard(state.accounts.find((a) => a.id === d.ref) ?? null);
                  if (d.kind === "statement") return setStmtCard(state.accounts.find((a) => a.id === d.ref) ?? null);
                  if (d.kind === "installment") k.postInstallment(d.ref);
                  else {
                    const u = upcoming(state).find((x) => x.item.id === d.id.slice(2) && x.key === d.ref);
                    if (u) setBillPay(u);
                    return;
                  }
                  toast(`Logged ${d.title}`);
                }}
              >
                {d.kind === "card" ? "Pay" : d.kind === "statement" ? "Check" : d.kind === "debt" || d.kind === "deposit" ? "Open" : d.kind === "income" ? "Mark received" : d.kind === "installment" ? "Posted" : "Mark paid"}
              </button>
              {snoozeOpen === d.id && (
                <div className="snoozerow" role="group" aria-label={`Snooze ${d.title}`}>
                  <span className="sub">Hide until</span>
                  {snoozeChoices(d).map((c) => (
                    <button
                      key={c.label}
                      className="chip"
                      onClick={() => {
                        const prev = state.settings.snoozed;
                        k.updateSettings({ snoozed: withSnooze(prev, d.id, c.until) });
                        setSnoozeOpen(null);
                        toast(`${d.title} snoozed · ${c.label.toLowerCase()}`, () => k.updateSettings({ snoozed: prev }));
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {due.length > 3 && (
            <button className="link" onClick={() => goTab("plan", "upcoming")}>
              See all {due.length} ›
            </button>
          )}
          {snoozedCount > 0 && (
            <button className="link" onClick={() => k.updateSettings({ snoozed: undefined })}>
              {snoozedCount} snoozed · Show again
            </button>
          )}
        </section>
      )}
      {due.length === 0 && snoozedCount > 0 && (
        <button className="link snoozedonly" onClick={() => k.updateSettings({ snoozed: undefined })}>
          <Emoji e="⏰" /> {snoozedCount} reminder{snoozedCount === 1 ? "" : "s"} snoozed · Show again
        </button>
      )}

      {billPay && <BillPay ctx={ctx} u={billPay} onClose={() => setBillPay(null)} />}
      {payCard && <PayCard ctx={ctx} card={payCard} onClose={() => setPayCard(null)} />}
      {stmtCard && <StatementFix ctx={ctx} card={stmtCard} onClose={() => setStmtCard(null)} />}

      {recapDue && (
        <div className="recapcard">
          <button className="recapopen" onClick={() => open({ kind: "recap", y: recapDue.y, m: recapDue.m })}>
            <span className="recapplay" aria-hidden="true">
              ▶
            </span>
            <span>
              <small>Kwenta recap</small>
              <b>{new Date(recapDue.y, recapDue.m, 1).toLocaleDateString("en-PH", { month: "long" })} in review is ready</b>
              <span>Top categories, biggest moments and your money style.</span>
            </span>
          </button>
          <button className="iconbtn light recapx" aria-label="Dismiss recap" onClick={() => k.updateSettings({ recapSeen: recapDue.key })}>
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      <div className="sectionhead">
        <h2>Quick actions</h2>
      </div>
      <div className="quick" role="list">
        {(moreActions ? quick : quick.slice(0, 4)).map((q) => (
          <button key={q.label} className="qbtn" onClick={q.onClick} role="listitem">
            <span className="qico"><Emoji e={q.icon} /></span>
            {q.label}
          </button>
        ))}
        <button className="qbtn" onClick={() => setMoreActions((v) => !v)} aria-expanded={moreActions}>
          <span className="qico">{moreActions ? "‹" : "•••"}</span>
          {moreActions ? "Less" : "More"}
        </button>
      </div>

      <div className="card today">
          <h3>{period === "day" ? "Today" : period === "week" ? "This week" : "This month"}</h3>
          <div className="flows">
          <div className="flow">
            <span className="arrow out" aria-hidden="true">↘</span>
            <span className="flowtext">
              <small>Spent</small>
              <b className="num">{fmt(per.expense)}</b>
            </span>
          </div>
          <div className="flow">
            <span className="arrow in" aria-hidden="true">↗</span>
            <span className="flowtext">
              <small>Earned</small>
              <b className="num">{fmt(per.income)}</b>
            </span>
          </div>
          </div>
          <div className="seg small" role="tablist">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <button key={p} role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button className="link" onClick={() => open({ kind: "stats" })}>
            See breakdown ›
          </button>
        </div>

      </div>

      <div className="homecol">
      <div className="sectionhead">
        <h2>Upcoming</h2>
        <button className="link" onClick={() => goTab("plan", "upcoming")}>
          Manage ›
        </button>
      </div>
      <div className="card">
        {instUp.map((d) => {
          const acc = state.accounts.find((a) => a.id === d.plan.acc);
          return (
            <div className="row" key={d.plan.id}>
              {acc ? <BankLogo account={acc} size={42} /> : <div className="ico"><Emoji e="💳" /></div>}
              <div className="main">
                <div className="t">{d.plan.name}</div>
                <div className={`s${d.daysLeft <= 3 ? " warnt" : ""}`}>
                  Installment {d.n}/{d.plan.months} · {d.daysLeft < 0 ? "due" : d.daysLeft === 0 ? "today" : `${shortDate(d.due)} · ${d.daysLeft} days`}
                </div>
              </div>
              <div className="amt num">{fmtIn(d.monthly, accCurrency(state, d.plan.acc))}</div>
              {d.daysLeft <= 7 && (
                <button
                  className="chip"
                  onClick={() => {
                    k.postInstallment(d.plan.id);
                    toast(`Posted ${d.plan.name} ${d.n}/${d.plan.months}`);
                  }}
                >
                  Posted
                </button>
              )}
            </div>
          );
        })}
        {up.length === 0 && instUp.length > 0 ? null : up.length === 0 && due.length > 0 ? (
          <div className="empty">Nothing else coming up. Your next payments are in Due soon above.</div>
        ) : up.length === 0 ? (
          <div className="empty">
            Add rent, subscriptions or your salary as recurring items.
            <br />
            <button className="btn ghost sm" onClick={() => goTab("plan", "upcoming")}>
              Add recurring item
            </button>
          </div>
        ) : (
          up.map((u) => (
            <div className="row" key={u.item.id}>
              <div className="ico"><Emoji e={u.item.type === "income" ? "💰" : billEmoji(u.item.name, u.item.cat)} /></div>
              <div className="main">
                <div className="t">{u.item.name}</div>
                <div className={`s${u.daysLeft <= 3 && u.item.type === "expense" ? " warnt" : ""}`}>
                  {u.daysLeft < 0 ? `${-u.daysLeft} days overdue` : u.daysLeft === 0 ? "Due today" : `${shortDate(u.due)} · ${u.daysLeft} days left`}
                </div>
              </div>
              <div className={`amt num ${u.item.type === "income" ? "in" : ""}`}>{fmtIn(u.item.amount, accCurrency(state, u.item.acc))}</div>
              {u.daysLeft <= 7 && (
                <button
                  className="chip"
                  onClick={() => {
                    setBillPay(u);
                  }}
                >
                  {u.item.type === "income" ? "Mark received" : "Mark paid"}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {budgeted.length > 0 && (
        <>
          <div className="sectionhead">
            <h2>{atRisk.length ? "Budgets to watch" : "Budgets"}</h2>
            <button className="link" onClick={() => goTab("plan", "budgets")}>
              {atRisk.length ? "All budgets ›" : "Edit ›"}
            </button>
          </div>
          {atRisk.length === 0 ? (
            <button className="card budgetok" onClick={() => goTab("plan", "budgets")}>
              All {budgeted.length} budget{budgeted.length === 1 ? "" : "s"} on track <Emoji e="✅" />
            </button>
          ) : (
            <div className="card">
              {atRisk.slice(0, 4).map((b) => {
                const over = paceOf(b) === "over";
                return (
                  <div className="cat" key={b.cat}>
                    <div className="head">
                      <span>
                        <Emoji e={catEmoji(b.cat)} /> {b.cat} <small className="periodtag">{periodInfo(b.period).label}</small>
                      </span>
                      <span className={`num${over ? " over" : ""}`}>
                        {fmt(b.spent)} / {fmt(b.limit)}
                      </span>
                    </div>
                    <div className="bar">
                      <i style={{ width: `${Math.min(100, b.pct)}%`, background: over ? "var(--warn)" : catColor(b.cat) }} />
                      {b.period !== "daily" && <b className="marker" style={{ left: `${b.elapsed * 100}%` }} title="How far into the period we are" />}
                    </div>
                    <div className={`s${over ? " over" : ""}`}>{over ? `${fmt(-b.left)} over` : "Spending faster than the month is passing ⚠️"}</div>
                  </div>
                );
              })}
              {atRisk.length > 4 && <p className="hint">{atRisk.length - 4} more need a look in Plan.</p>}
            </div>
          )}
        </>
      )}

      <div className="sectionhead">
        <h2>Recent</h2>
        <button className="link" onClick={() => goTab("history")}>
          See all ›
        </button>
      </div>
      <div className="card">
        {recent.length ? (
          recent.map((t) => <TxRow key={t.id} tx={t} accounts={state.accounts} showDate onEdit={() => open({ kind: "add", edit: t })} />)
        ) : (
          <div className="empty">Nothing yet. Tell Alki your first expense above.</div>
        )}
      </div>
      </div>
      </div>
    </>
  );
}
