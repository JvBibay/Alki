"use client";

import { useState } from "react";
import { catColor, catEmoji, catNames } from "@/lib/categories";
import type { Ctx } from "@/lib/ui";
import { forecast, lastDays, monthChange, monthRange, netWorth, netWorthSeries, sumRange, upcoming, type MonthChange } from "@/lib/stats";
import { fmt, shortDate, weekdayFull, weekdayShort } from "@/lib/format";
import { Donut, MiniBars, TrendLine } from "./Charts";
import Sheet from "./Sheet";
import Emoji from "./Emoji";

export default function Stats({ ctx }: { ctx: Ctx }) {
  const { state } = ctx.k;
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [range, setRange] = useState<30 | 90>(30);
  const [showStatement, setShowStatement] = useState(false);

  const [from, to] = monthRange(ym.y, ym.m);
  const s = sumRange(state, from, to);
  const [pFrom, pTo] = monthRange(ym.y, ym.m - 1);
  const prevFull = sumRange(state, pFrom, pTo);
  // For the month in progress, compare with the same days of last month, not the whole thing.
  const prevDays = new Date(ym.y, ym.m, 0).getDate();
  const prevSoFar = sumRange(state, pFrom, new Date(ym.y, ym.m - 1, Math.min(today.getDate(), prevDays) + 1).getTime());
  const label = new Date(ym.y, ym.m, 1).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  const isCurrent = ym.y === today.getFullYear() && ym.m === today.getMonth();
  const prev = isCurrent ? prevSoFar : prevFull;
  const slices = Object.entries(s.cats)
    .sort((a, b) => b[1] - a[1])
    .map(([l, v]) => ({ label: l, value: v, color: catColor(l) }));
  const week = lastDays(state, 7);
  const series = netWorthSeries(state, range);
  const nw = netWorth(state).net;
  const delta = nw - series[0].value;
  const f = forecast(state);
  const billsSoon = upcoming(state).filter((u) => u.due <= f.pay.date && u.item.type === "expense");
  const incomeByNote = state.txs
    .filter((t) => t.type === "income" && t.cat !== "Adjustment" && t.date >= from && t.date < to)
    .reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.note]: (acc[t.note] ?? 0) + t.amount }), {});

  const shift = (d: number) =>
    setYm(({ y, m }) => {
      const n = m + d;
      return n < 0 ? { y: y - 1, m: 11 } : n > 11 ? { y: y + 1, m: 0 } : { y, m: n };
    });

  const against = isCurrent ? "vs same days last month" : "vs last month";
  const changeNote = (c: MonthChange) => {
    if (c.kind === "first") return <small>First full month</small>;
    const color = c.tone === "bad" ? "var(--warn)" : c.tone === "good" ? "var(--income)" : undefined;
    const arrow = (n: number) => (n > 0 ? "↑" : n < 0 ? "↓" : "");
    const text =
      c.kind === "diff"
        ? `${arrow(c.diff)} ${c.diff < 0 ? "−" : c.diff > 0 ? "+" : ""}${fmt(Math.abs(c.diff))} ${against}`
        : `${arrow(c.pct)} ${c.capped ? ">" : ""}${Math.abs(c.pct)}% ${against}`;
    return <small style={{ color }}>{text}</small>;
  };

  return (
    <Sheet title="Statistics" onClose={ctx.close}>
      <div className="monthnav">
        <button onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <b>{label}</b>
        <button onClick={() => shift(1)} aria-label="Next month" disabled={isCurrent}>
          ›
        </button>
      </div>

      <div className="tiles two">
        <div className="tile">
          <span>Spent</span>
          <b className="num" style={{ color: "var(--expense)" }}>
            {fmt(s.expense)}
          </b>
          {changeNote(monthChange(s.expense, prev.expense, "expense"))}
        </div>
        <div className="tile">
          <span>Income</span>
          <b className="num" style={{ color: "var(--income)" }}>
            {fmt(s.income)}
          </b>
          {changeNote(monthChange(s.income, prev.income, "income"))}
        </div>
        <div className="tile">
          <span>Net flow</span>
          <b className="num">{fmt(s.income - s.expense)}</b>
          <small>{s.income ? `${Math.round(((s.income - s.expense) / s.income) * 100)}% saved` : ""}</small>
        </div>
        <div className="tile">
          <span>Transactions</span>
          <b className="num">{s.count}</b>
        </div>
      </div>

      <h2>Expense distribution</h2>
      <div className="card distribution">
        <Donut data={slices} size={150} thick={20} />
        <div className="legendlist">
          {slices.length === 0 && <div className="sub">No spending this month.</div>}
          {slices.map((sl) => (
            <div key={sl.label}>
              <i style={{ background: sl.color }} />
              <span>
                <Emoji e={catEmoji(sl.label)} /> {sl.label}
              </span>
              <b className="num">{fmt(sl.value)}</b>
            </div>
          ))}
        </div>
      </div>

      <h2>Last 7 days</h2>
      <div className="card">
        <MiniBars values={week.map((d) => d.expense)} labels={week.map((d) => weekdayShort(d.from))} fullLabels={week.map((d) => weekdayFull(d.from))} showValues height={90} />
      </div>

      <div className="sectionhead">
        <h2>Net worth trend</h2>
        <div className="seg small">
          {([30, 90] as const).map((r) => (
            <button key={r} aria-selected={range === r} onClick={() => setRange(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="trendhead">
          <div>
            <div className="eyebrow">Current</div>
            <b className="num">{fmt(nw)}</b>
          </div>
          <div>
            <div className="eyebrow">Change</div>
            <b className={`num ${delta >= 0 ? "in" : "out"}`}>
              {delta >= 0 ? "+" : ""}
              {fmt(delta)}
            </b>
          </div>
        </div>
        <TrendLine values={series.map((p) => p.value)} />
      </div>

      <h2>Cashflow forecast</h2>
      <div className="card forecast">
        <div className="frow">
          <span>Cash & accounts now</span>
          <b className="num">{fmt(f.liquid)}</b>
        </div>
        <div className="frow">
          <span>Bills before payday ({billsSoon.length})</span>
          <b className="num out">−{fmt(f.bills)}</b>
        </div>
        {f.cards > 0 && (
          <div className="frow">
            <span>Credit card payments before payday</span>
            <b className="num out">−{fmt(f.cards)}</b>
          </div>
        )}
        <div className="frow">
          <span>
            Usual spending ({fmt(f.avgDaily)}/day × {f.pay.daysLeft} days)
          </span>
          <b className="num out">−{fmt(f.avgDaily * f.pay.daysLeft)}</b>
        </div>
        <div className="frow total">
          <span>Projected on payday, {shortDate(f.pay.date)}</span>
          <b className={`num ${f.projected < 0 ? "out" : "in"}`}>{fmt(f.projected)}</b>
        </div>
      </div>

      {s.count > 0 && (
        <button className="btn wide" style={{ marginTop: 16 }} onClick={() => ctx.open({ kind: "recap", y: ym.y, m: ym.m })}>
          ▶ Play {new Date(ym.y, ym.m, 1).toLocaleDateString("en-PH", { month: "long" })} recap
        </button>
      )}
      <button className="btn ghost wide" style={{ marginTop: 12 }} onClick={() => setShowStatement((v) => !v)}>
        {showStatement ? "Hide" : "Generate"} income statement
      </button>
      {showStatement && (
        <div className="card statement" style={{ marginTop: 12 }}>
          <h3>Income statement · {label}</h3>
          <div className="frow head">Income</div>
          {Object.entries(incomeByNote).map(([n, v]) => (
            <div className="frow" key={n}>
              <span>{n}</span>
              <span className="num">{fmt(v)}</span>
            </div>
          ))}
          <div className="frow total">
            <span>Total income</span>
            <b className="num">{fmt(s.income)}</b>
          </div>
          <div className="frow head">Expenses</div>
          {slices.map((sl) => (
            <div className="frow" key={sl.label}>
              <span>{sl.label}</span>
              <span className="num">{fmt(sl.value)}</span>
            </div>
          ))}
          <div className="frow total">
            <span>Total expenses</span>
            <b className="num">{fmt(s.expense)}</b>
          </div>
          <div className="frow total grand">
            <span>Net income</span>
            <b className={`num ${s.income - s.expense < 0 ? "out" : "in"}`}>{fmt(s.income - s.expense)}</b>
          </div>
          <button className="btn sm" onClick={() => window.print()}>
            Print / save as PDF
          </button>
        </div>
      )}
    </Sheet>
  );
}
