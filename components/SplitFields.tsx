"use client";

import { useState } from "react";
import type { Ctx } from "@/lib/ui";
import { equalShares } from "@/lib/debts";
import { findProfile, peopleSummary, personKey } from "@/lib/people";
import { fmt } from "@/lib/format";
import { PersonAvatar } from "./People";
import MoneyInput from "./MoneyInput";

/** The state behind "who am I splitting with, and who pays how much" (shared by Add expense and Split a bill). */
export function useSplitState(ctx: Ctx, totalNum: number) {
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [includeMe, setIncludeMe] = useState(true);
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [custom, setCustom] = useState<Record<string, string>>({});

  const eq = equalShares(totalNum, names.length, includeMe);
  const shares = mode === "equal" ? names.map((n, i) => ({ name: n, share: eq.each[i] ?? 0 })) : names.map((n) => ({ name: n, share: parseFloat(custom[n] ?? "") || 0 }));
  const friendsTotal = shares.reduce((s, p) => s + p.share, 0);
  const myShare = mode === "equal" ? eq.mine : Math.max(0, Math.round((totalNum - friendsTotal) * 100) / 100);
  const overBy = mode === "custom" ? Math.round((friendsTotal - totalNum) * 100) / 100 : 0;

  function addName() {
    const parts = draft
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x && !names.some((n) => personKey(n) === personKey(x)));
    if (parts.length) setNames([...names, ...parts]);
    setDraft("");
  }

  return {
    ctx,
    names,
    setNames,
    draft,
    setDraft,
    includeMe,
    setIncludeMe,
    mode,
    setMode,
    custom,
    setCustom,
    shares,
    friendsTotal,
    myShare,
    overBy,
    addName,
    /** Enough to save: someone to split with, a total, and friends' shares that fit within it. */
    ready: names.length > 0 && totalNum > 0 && overBy <= 0,
    totalNum,
  };
}
export type SplitState = ReturnType<typeof useSplitState>;

/** Names you've used before, so the same person isn't typed three different ways. */
export function PeopleList({ ctx }: { ctx: Ctx }) {
  return (
    <datalist id="kwenta-people">
      {peopleSummary(ctx.k.state).map((p) => (
        <option key={p.key} value={p.name} />
      ))}
    </datalist>
  );
}

/** Pick the people, say whether you're in it, equal or custom shares, and see who owes what. */
export default function SplitFields({ s }: { s: SplitState }) {
  const { ctx } = s;
  const { k } = ctx;
  const picked = new Set(s.names.map(personKey));
  const everyone = peopleSummary(k.state);
  const allPeople = new Map(everyone.map((p) => [p.key, p]));
  const known = everyone.filter((p) => !picked.has(p.key)).slice(0, 12);

  return (
    <>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Split with
        </div>
        <div className="formrow">
          <input
            value={s.draft}
            onChange={(e) => s.setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                s.addName();
              }
            }}
            placeholder="Friend’s name, then Add"
            list="kwenta-people"
            aria-label="Friend’s name"
            style={{ flex: 1 }}
          />
          <button type="button" className="btn ghost sm" onClick={s.addName}>
            Add
          </button>
        </div>
        <PeopleList ctx={ctx} />
        {s.names.length > 0 && (
          <div className="chips" style={{ marginTop: 8 }}>
            {s.names.map((n) => (
              <button type="button" key={n} className="chip pchipbtn" onClick={() => s.setNames(s.names.filter((x) => x !== n))} aria-label={`Remove ${n}`}>
                <PersonAvatar name={n} emoji={findProfile(k.state, n)?.emoji} color={findProfile(k.state, n)?.color} label={allPeople.get(personKey(n))?.label} size={22} /> {n} ✕
              </button>
            ))}
          </div>
        )}
        {known.length > 0 && (
          <div className="quickpeople">
            <span className="eyebrow">Tap to add</span>
            <div className="chips scroll">
              {known.map((p) => (
                <button type="button" key={p.key} className="qperson" onClick={() => s.setNames([...s.names, p.name])}>
                  <PersonAvatar name={p.name} emoji={p.profile?.emoji} color={p.color} label={p.label} size={40} />
                  <span>{p.name.split(" ").slice(0, 2).join(" ")}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={s.includeMe} onChange={(e) => s.setIncludeMe(e.target.checked)} />
        <span>I’m part of the split too</span>
      </label>
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={s.mode === "equal"} onClick={() => s.setMode("equal")}>
          Split equally
        </button>
        <button type="button" role="tab" aria-selected={s.mode === "custom"} onClick={() => s.setMode("custom")}>
          Custom amounts
        </button>
      </div>
      {s.names.length > 0 && s.totalNum > 0 && (
        <div className="quote">
          {s.includeMe && (
            <div className="frow">
              <span>Me</span>
              <b className="num">{fmt(s.myShare)}</b>
            </div>
          )}
          {s.shares.map((p) => (
            <div className="frow" key={p.name}>
              <span>{p.name}</span>
              {s.mode === "equal" ? (
                <b className="num">{fmt(p.share)}</b>
              ) : (
                <span style={{ width: 130 }}>
                  <MoneyInput value={s.custom[p.name] ?? ""} onChange={(v) => s.setCustom({ ...s.custom, [p.name]: v })} placeholder="0" className="budgetinput" />
                </span>
              )}
            </div>
          ))}
          {s.overBy > 0 && <p className="warnt">Friends’ shares are {fmt(s.overBy)} more than the total.</p>}
        </div>
      )}
    </>
  );
}
