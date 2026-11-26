"use client";

import { useState } from "react";
import Emoji from "./Emoji";
import type { Ctx } from "@/lib/ui";
import { CURRENCIES, defaultFx, fetchRates, getCurrency, pairRate, RATE_SOURCE } from "@/lib/currency";
import { baseCurrency } from "@/lib/stats";
import { fmtIn } from "@/lib/format";

/** Main currency, exchange rates for the currencies in use, and online rate updates. */
export default function CurrencySettings({ ctx }: { ctx: Ctx }) {
  const { k, toast } = ctx;
  const { state } = k;
  const base = baseCurrency(state);
  const fx = state.fx ?? defaultFx();
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);

  const inUse = [...new Set(state.accounts.map((a) => a.currency || base))].filter((c) => c !== base);
  const listed = showAll ? CURRENCIES.map((c) => c.code).filter((c) => c !== base) : inUse;

  async function update() {
    setBusy(true);
    try {
      k.setFx(await fetchRates());
      setEdits({});
      toast("Exchange rates updated.");
    } catch {
      toast("Couldn’t reach the rate service. Your current rates are kept.");
    }
    setBusy(false);
  }

  /** Sets "1 <code> = value <base>" by adjusting that currency's USD rate. */
  function setPair(code: string, raw: string) {
    setEdits((e) => ({ ...e, [code]: raw }));
    const v = parseFloat(raw);
    if (!v || v <= 0) return;
    const baseRate = fx.rates[base] ?? 1;
    k.setFx({ ...fx, rates: { ...fx.rates, [code]: baseRate / v }, updated: Date.now(), source: "manual" });
  }

  const updated = new Date(fx.updated).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="card form">
      <label>
        Main currency
        <select
          value={base}
          onChange={(e) => {
            k.changeBaseCurrency(e.target.value);
            toast(`Totals now shown in ${e.target.value}. Your accounts keep their own currencies.`);
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </select>
      </label>
      <p className="sub" style={{ marginTop: -4 }}>
        Used for net worth, stats, budgets and goals. Each account can have its own currency (set it when you add or edit an account).
      </p>

      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Exchange rates · {fx.source === "online" ? "updated" : fx.source === "manual" ? "edited" : "built-in"} {updated}
        </div>
        {listed.length === 0 ? (
          <p className="sub">All your accounts use {base}. Add an account in another currency and its rate shows here.</p>
        ) : (
          <div className="rates">
            {listed.map((code) => {
              const c = getCurrency(code);
              const current = pairRate(code, base, fx);
              return (
                <label key={code} className="rate">
                  <span>
                    <Emoji e={c.flag} /> 1 {code} =
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={edits[code] ?? String(Math.round(current * 10000) / 10000)}
                    onChange={(e) => setPair(code, e.target.value.replace(/[^\d.]/g, ""))}
                    aria-label={`Value of 1 ${code} in ${base}`}
                  />
                  <span className="sub">{base}</span>
                </label>
              );
            })}
          </div>
        )}
        <button type="button" className="link" style={{ marginTop: 8 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show only currencies I use" : "Show all currencies"}
        </button>
      </div>

      <button type="button" className="btn ghost sm" onClick={() => void update()} disabled={busy}>
        {busy ? "Updating…" : "Update rates online"}
      </button>
      <p className="sub">
        Rates by{" "}
        <a href={RATE_SOURCE.url} target="_blank" rel="noreferrer noopener">
          {RATE_SOURCE.name}
        </a>
        . Updating only downloads public rates; none of your data is sent. You can also type a rate yourself, e.g. your bank’s or remittance center’s.
        {inUse.length > 0 && ` Example: ${fmtIn(100, inUse[0])} ≈ ${fmtIn(pairRate(inUse[0], base, fx) * 100, base)}.`}
      </p>
    </div>
  );
}
