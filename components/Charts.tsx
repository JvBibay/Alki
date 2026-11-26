"use client";

import { useState } from "react";
import { fmt, fmtShort } from "@/lib/format";

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Ring chart with the largest share written in the middle. */
export function Donut({ data, size = 140, thick = 18 }: { data: Slice[]; size?: number; thick?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thick) / 2;
  const c = 2 * Math.PI * r;
  const top = [...data].sort((a, b) => b.value - a.value)[0];
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Spending by category">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={thick} />
      {total > 0 &&
        data.map((d) => {
          const len = (d.value / total) * c;
          const gap = data.length > 1 ? Math.min(3, len / 3) : 0;
          const el = (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thick}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${d.label}: ${fmt(d.value)}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      {top && total > 0 ? (
        <>
          <text x="50%" y="48%" textAnchor="middle" fontSize={size / 6.5} fontWeight="800" fill="var(--ink)">
            {Math.round((top.value / total) * 100)}%
          </text>
          <text x="50%" y="62%" textAnchor="middle" fontSize={size / 12} fill="var(--muted)">
            {top.label}
          </text>
        </>
      ) : (
        <text x="50%" y="54%" textAnchor="middle" fontSize={size / 11} fill="var(--muted)">
          No spending
        </text>
      )}
    </svg>
  );
}

/**
 * Income and spending per day (palette colors), weekday letter underneath. Both share one square-root scale: a
 * bigger amount is always a taller bar, but one huge day doesn't flatten the rest into thin lines (heights are
 * not proportional; exact figures are in the tooltip and the totals line).
 *  - "split": one column per day, income rising above a center line and spending dropping below it.
 *  - "pair": income and spending side by side, both growing up from the baseline.
 */
export function DualBars({ days, height = 84, mode = "split" }: { days: { label: string; full?: string; income: number; expense: number }[]; height?: number; mode?: "split" | "pair" }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...days.flatMap((d) => [d.income, d.expense]));
  const split = mode === "split";
  // A nonzero amount keeps a thin visible stub; with nothing logged, split shows only the line and pair a faint stub.
  const h = (v: number) => (v > 0 ? `${Math.max(split ? 6 : 5, Math.sqrt(v / max) * 100)}%` : split ? "0%" : "3%");
  const bar = (v: number, color: string) => ({ height: h(v), background: v > 0 ? color : undefined, opacity: split || v > 0 ? 1 : 0.35 });
  return (
    <>
    <div className="minibars dual" style={{ height: height + 18 }} role="group" aria-label={split ? "Income above the line and spending below it, per day. Tap a day for amounts." : "Income and spending per day. Tap a day for amounts."}>
      {days.map((d, i) => (
        <div className={`mb${sel === i ? " sel" : ""}`} key={i} role="button" tabIndex={0} aria-label={`${d.full ?? d.label}: in ${fmt(d.income)}, out ${fmt(d.expense)}`} aria-pressed={sel === i} onClick={() => setSel(sel === i ? null : i)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(sel === i ? null : i)}>
          {split ? (
            <div className="mbtrack split" style={{ height }}>
              <div className="up">
                <i style={bar(d.income, "var(--chart-in)")} />
              </div>
              <div className="down">
                <i style={bar(d.expense, "var(--chart-out)")} />
              </div>
            </div>
          ) : (
            <div className="mbtrack pair" style={{ height }}>
              <i style={bar(d.income, "var(--chart-in)")} />
              <i style={bar(d.expense, "var(--chart-out)")} />
            </div>
          )}
          <span>{d.label}</span>
        </div>
      ))}
    </div>
    <div className="mbcap" aria-live="polite">
      {sel !== null ? `${days[sel].full ?? days[sel].label} · In ${fmt(days[sel].income)} · Out ${fmt(days[sel].expense)}` : "Tap a day to see the amounts"}
    </div>
    </>
  );
}

/** Small vertical bars with weekday labels underneath; tap a day for its amount. */
export function MiniBars({ values, labels, fullLabels, height = 70, highlightLast = true, fitRange = false, showValues = false }: { values: number[]; labels: string[]; fullLabels?: string[]; height?: number; highlightLast?: boolean; fitRange?: boolean; showValues?: boolean }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  // fitRange: for values that can be negative or barely change (like net worth), size bars between the
  // lowest and highest value so small moves are visible instead of every bar looking the same or empty.
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pct = (v: number) => {
    if (!fitRange) return v ? Math.max(6, (v / max) * 100) : 4;
    if (hi === lo) return 60;
    return 18 + ((v - lo) / (hi - lo)) * 82;
  };
  return (
    <>
    <div className="minibars" style={{ height: height + 18 + (showValues ? 14 : 0) }} role="group" aria-label="Daily amounts. Tap a day for its amount.">
      {values.map((v, i) => (
        <div className={`mb${sel === i ? " sel" : ""}`} key={i} role="button" tabIndex={0} aria-label={`${fullLabels?.[i] ?? labels[i]}: ${fmt(v)}`} aria-pressed={sel === i} onClick={() => setSel(sel === i ? null : i)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(sel === i ? null : i)}>
          <div className="mbtrack" style={{ height }}>
            <i
              style={{ height: `${pct(v)}%`, ...(fitRange && v < 0 ? { background: "var(--expense)" } : {}) }}
              className={highlightLast && i === values.length - 1 ? "hl" : ""}
            />
          </div>
          <span>{labels[i]}</span>
          {showValues && <span className="mbv">{v ? fmtShort(v) : "\u2013"}</span>}
        </div>
      ))}
    </div>
    <div className="mbcap" aria-live="polite">
      {sel !== null ? `${fullLabels?.[sel] ?? labels[sel]} · ${fmt(values[sel])}` : "Tap a day to see the amount"}
    </div>
    </>
  );
}

/** Line chart for net worth over time. */
export function TrendLine({ values, height = 110 }: { values: number[]; height?: number }) {
  const w = 320;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, height - 8 - ((v - min) / span) * (height - 16)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${height} L0,${height} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Net worth trend">
        <defs>
          <linearGradient id="tl" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#tl)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="axis">
        <span>{fmtShort(min)}</span>
        <span>{fmtShort(max)}</span>
      </div>
    </div>
  );
}
