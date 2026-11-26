"use client";

import { useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { Tx, TxType } from "@/lib/types";
import { accountName, dayLabel, fmt } from "@/lib/format";
import { catEmoji, catNames } from "@/lib/categories";
import { activeAccounts, addDays, monthRange, periodRange, toBase } from "@/lib/stats";
import TxRow from "./TxRow";
import Icon from "./Icon";
import { Modal } from "./Sheet";
import Emoji, { EmojiText } from "./Emoji";

type TypeFilter = "all" | TxType;
type PeriodKind = "all" | "week" | "month" | "lastmonth" | "custom";
interface Period {
  kind: PeriodKind;
  from?: string; // yyyy-mm-dd, custom only
  to?: string;
}

const PERIODS: [PeriodKind, string][] = [
  ["all", "All time"],
  ["week", "This week"],
  ["month", "This month"],
  ["lastmonth", "Last month"],
  ["custom", "Custom dates"],
];

const dateIn = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const parseDate = (v?: string) => {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};
const short = (v?: string) => (v ? new Date(parseDate(v)!).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "…");

function periodBounds(p: Period, now = Date.now()): [number, number] | null {
  if (p.kind === "all") return null;
  if (p.kind === "week") return periodRange("week", now);
  if (p.kind === "month") return periodRange("month", now);
  if (p.kind === "lastmonth") {
    const d = new Date(now);
    return monthRange(d.getFullYear(), d.getMonth() - 1);
  }
  const from = parseDate(p.from) ?? -Infinity;
  const to = p.to ? addDays(parseDate(p.to)!, 1) : Infinity;
  return [from, to];
}

function periodLabel(p: Period) {
  if (p.kind === "custom") return `${short(p.from)} – ${short(p.to)}`;
  return PERIODS.find(([k]) => k === p.kind)![1];
}

export default function History({ ctx }: { ctx: Ctx }) {
  const { k, toast } = ctx;
  const { state } = k;
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [type, setType] = useState<TypeFilter>("all");
  const [acc, setAcc] = useState("all");
  const [cats, setCats] = useState<string[]>([]);
  const [period, setPeriod] = useState<Period>({ kind: "all" });
  const [sheet, setSheet] = useState<"date" | "filter" | null>(null);

  const needle = q.trim().toLowerCase();
  // "1,200" and "₱180" should find those amounts: compare digits only when the search looks like a number.
  const numNeedle = needle.replace(/[₱$,\s]/g, "");
  const numeric = /^\d+(\.\d+)?$/.test(numNeedle) ? numNeedle : "";
  const bounds = periodBounds(period);
  const filtering = type !== "all" || acc !== "all" || cats.length > 0;
  const anything = filtering || period.kind !== "all" || !!needle;

  const list = [...state.txs]
    .filter((t) => type === "all" || t.type === type)
    .filter((t) => acc === "all" || t.acc === acc || t.to === acc)
    .filter((t) => !cats.length || cats.includes(t.cat))
    .filter((t) => !bounds || (t.date >= bounds[0] && t.date < bounds[1]))
    .filter(
      (t) =>
        !needle ||
        t.note.toLowerCase().includes(needle) ||
        t.cat.toLowerCase().includes(needle) ||
        accountName(state.accounts, t.acc).toLowerCase().includes(needle) ||
        (!!t.to && accountName(state.accounts, t.to).toLowerCase().includes(needle)) ||
        String(t.amount).includes(numeric || needle),
    )
    .sort((a, b) => b.date - a.date);

  const groups: { key: string; ts: number; items: Tx[]; out: number; in: number }[] = [];
  let totalOut = 0;
  let totalIn = 0;
  for (const t of list) {
    const key = new Date(t.date).toDateString();
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, ts: t.date, items: [], out: 0, in: 0 };
      groups.push(g);
    }
    g.items.push(t);
    // Day totals match Home: lending / paying back (Debt) isn't spending or income; foreign amounts are converted.
    if (t.cat === "Debt" || t.cat === "Adjustment") continue;
    const v = toBase(state, t.amount, t.acc);
    if (t.type === "expense") {
      g.out += v;
      totalOut += v;
    }
    if (t.type === "income") {
      g.in += v;
      totalIn += v;
    }
  }

  function remove(t: Tx) {
    k.removeTx(t.id);
    toast(`Deleted ${fmt(t.amount)}`, () => k.restoreTx(t));
  }
  function clearAll() {
    setQ("");
    setSearching(false);
    setType("all");
    setAcc("all");
    setCats([]);
    setPeriod({ kind: "all" });
  }

  const chips: { label: string; clear: () => void }[] = [];
  if (period.kind !== "all") chips.push({ label: `📅 ${periodLabel(period)}`, clear: () => setPeriod({ kind: "all" }) });
  if (type !== "all") chips.push({ label: type[0].toUpperCase() + type.slice(1), clear: () => setType("all") });
  if (acc !== "all") chips.push({ label: accountName(state.accounts, acc), clear: () => setAcc("all") });
  for (const c of cats) chips.push({ label: `${catEmoji(c, state.customCats ?? [])} ${c}`, clear: () => setCats((x) => x.filter((y) => y !== c)) });

  return (
    <>
      <header className="band">
        <div className="bandtop">
          <div>
            <h1 className="hello">History</h1>
            <div className="eyebrow">{anything ? `${list.length} of ${state.txs.length} entries` : `${state.txs.length} entries`}</div>
          </div>
          <div className="headbtns">
            <button
              className={`iconbtn light${searching || needle ? " on" : ""}`}
              aria-label="Search"
              aria-expanded={searching}
              onClick={() => {
                if (searching) setQ("");
                setSearching((v) => !v);
              }}
            >
              <Icon name="search" size={20} />
            </button>
            <button className={`iconbtn light${period.kind !== "all" ? " on" : ""}`} aria-label="Choose dates" onClick={() => setSheet("date")}>
              <Icon name="plan" size={20} />
            </button>
            <button className={`iconbtn light${filtering ? " on" : ""}`} aria-label="Filter" onClick={() => setSheet("filter")}>
              <Icon name="sliders" size={20} />
            </button>
          </div>
        </div>
        {searching && (
          <div className="search">
            <Icon name="search" size={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, categories, amounts" aria-label="Search transactions" autoFocus />
          </div>
        )}
      </header>

      {chips.length > 0 && (
        <div className="chips activechips">
          {chips.map((c) => (
            <button key={c.label} className="chip" aria-pressed="true" onClick={c.clear} aria-label={`Remove filter ${c.label}`}>
              <EmojiText text={c.label} /> <span aria-hidden="true">×</span>
            </button>
          ))}
          {chips.length > 1 && (
            <button className="link" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      )}
      {anything && list.length > 0 && (totalOut > 0 || totalIn > 0) && (
        <div className="histsum">
          {totalOut > 0 && (
            <span>
              Spent <b className="num out">{fmt(totalOut)}</b>
            </span>
          )}
          {totalIn > 0 && (
            <span>
              Received <b className="num in">{fmt(totalIn)}</b>
            </span>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="histempty">
          <div className="histempty-ico" aria-hidden="true">
            <Emoji e="🧾" />
          </div>
          {state.txs.length ? (
            <>
              <b>No matches</b>
              <p>Nothing fits these filters.</p>
              <button className="btn ghost sm" onClick={clearAll}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <b>No entries yet</b>
              <p>Spending, income, transfers, card payments, debts and installment payments you log will show up here.</p>
            </>
          )}
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <div className="day">
              <span>{dayLabel(g.ts)}</span>
              <span className="num">
                {g.in > 0 && <span className="in">+{fmt(g.in)} </span>}
                {g.out > 0 && <span className="out">−{fmt(g.out)}</span>}
              </span>
            </div>
            <div className="card">
              {g.items.map((t) => (
                <TxRow key={t.id} tx={t} accounts={state.accounts} onDelete={() => remove(t)} onEdit={() => ctx.open({ kind: "add", edit: t })} />
              ))}
            </div>
          </div>
        ))
      )}

      {sheet === "date" && (
        <DateSheet
          value={period}
          onApply={(p) => {
            setPeriod(p);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "filter" && (
        <FilterSheet
          ctx={ctx}
          value={{ type, acc, cats }}
          onApply={(f) => {
            setType(f.type);
            setAcc(f.acc);
            setCats(f.cats);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

function DateSheet({ value, onApply, onClose }: { value: Period; onApply: (p: Period) => void; onClose: () => void }) {
  const [kind, setKind] = useState<PeriodKind>(value.kind);
  const [from, setFrom] = useState(value.from ?? dateIn(Date.now() - 30 * 86_400_000));
  const [to, setTo] = useState(value.to ?? dateIn(Date.now()));
  return (
    <Modal title="Show entries from" onClose={onClose}>
      <div className="form">
        <div className="optlist" role="radiogroup">
          {PERIODS.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className="opt" onClick={() => (k === "custom" ? setKind(k) : onApply({ kind: k }))}>
              {label}
              {kind === k && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
        {kind === "custom" && (
          <>
            <div className="formrow">
              <label>
                From
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                To
                <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
            <button className="btn" type="button" onClick={() => onApply({ kind: "custom", from, to })}>
              Show {short(from)} – {short(to)}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function FilterSheet({
  ctx,
  value,
  onApply,
  onClose,
}: {
  ctx: Ctx;
  value: { type: TypeFilter; acc: string; cats: string[] };
  onApply: (v: { type: TypeFilter; acc: string; cats: string[] }) => void;
  onClose: () => void;
}) {
  const { state } = ctx.k;
  const [type, setType] = useState(value.type);
  const [acc, setAcc] = useState(value.acc);
  const [cats, setCats] = useState<string[]>(value.cats);
  // Only categories that have entries, so the list stays short.
  const used = new Set(state.txs.map((t) => t.cat));
  const catList = [...catNames(state.customCats ?? []), "Transfer", "Debt", "Adjustment", "Interest"].filter((c, i, a) => used.has(c) && a.indexOf(c) === i);
  const accounts = [...activeAccounts(state), ...state.accounts.filter((a) => a.archived || a.kind === "locked")];
  const toggle = (c: string) => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  return (
    <Modal title="Filter" onClose={onClose}>
      <div className="form">
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Type
          </div>
          <div className="seg" role="tablist">
            {(["all", "expense", "income", "transfer"] as TypeFilter[]).map((f) => (
              <button key={f} type="button" role="tab" aria-selected={type === f} onClick={() => setType(f)}>
                {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <label>
          Account
          <select value={acc} onChange={(e) => setAcc(e.target.value)}>
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        {catList.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Category
            </div>
            <div className="chips wrap" style={{ marginTop: 0 }}>
              {catList.map((c) => (
                <button key={c} type="button" className="chip" aria-pressed={cats.includes(c)} onClick={() => toggle(c)}>
                  <Emoji e={catEmoji(c, state.customCats ?? [])} /> {c}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="btn" type="button" onClick={() => onApply({ type, acc, cats })}>
          Show results
        </button>
        <button type="button" className="link" onClick={() => onApply({ type: "all", acc: "all", cats: [] })}>
          Reset filters
        </button>
      </div>
    </Modal>
  );
}
