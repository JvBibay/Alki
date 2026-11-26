"use client";

import { FormEvent, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { CustomCat } from "@/lib/categories";
import { CAT_COLOR_CHOICES, CAT_EMOJI_CHOICES, catColor, catEmoji, catNames, isBuiltIn } from "@/lib/categories";
import { budgetList, paceOf, periodInfo, periodOf, PERIODS, type BudgetPeriod } from "@/lib/budgets";
import { fmt } from "@/lib/format";
import { Modal } from "./Sheet";
import Icon from "./Icon";
import MoneyInput from "./MoneyInput";
import Emoji, { EmojiText } from "./Emoji";

/** Plan → Budgets: your own budgets, each with a category, amount and period. */
export default function Budgets({ ctx }: { ctx: Ctx }) {
  const { k } = ctx;
  const { state } = k;
  const list = budgetList(state);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [catEdit, setCatEdit] = useState<CustomCat | "new" | null>(null);
  const over = list.filter((b) => paceOf(b) === "over").length;
  const fast = list.filter((b) => paceOf(b) === "fast").length;
  const custom = state.customCats ?? [];

  return (
    <>
      <div className="card summary">
        <div className="eyebrow">Your budgets</div>
        <div className="big">
          <EmojiText text={list.length === 0 ? "None yet" : over > 0 ? `${over} of ${list.length} over budget` : fast > 0 ? `${fast} of ${list.length} spending fast ⚠️` : `All ${list.length} on track ✅`} />
        </div>
        <p className="hint" style={{ marginTop: 6 }}>
          Set a limit for any category: daily, weekly, every 2 weeks, monthly or yearly. The line on each bar shows how far into that period we are. On track means you’ve spent no more than that share of the budget; ahead of the line is spending fast.
        </p>
      </div>

      <button className="btn wide" style={{ marginTop: 12 }} onClick={() => setEditing("new")}>
        <Icon name="plus" size={18} /> Add budget
      </button>

      {list.length === 0 && (
        <div className="card empty" style={{ marginTop: 12 }}>
          Try a weekly Food budget, a daily Kape limit, or a yearly budget for Gifts. <Emoji e="🎁" />
        </div>
      )}

      {list.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          {list.map((b) => {
            const isOver = b.spent > b.limit;
            const behind = paceOf(b) === "fast"; // spending faster than time passing
            return (
              <button className="cat budgetrow2" key={b.cat} onClick={() => setEditing(b.cat)} aria-label={`Edit ${b.cat} budget`}>
                <div className="head">
                  <span>
                    <Emoji e={catEmoji(b.cat)} /> {b.cat} <small className="periodtag">{periodInfo(b.period).label}</small>
                  </span>
                  <span className={`num${isOver ? " over" : ""}`}>
                    {fmt(b.spent)} / {fmt(b.limit)}
                  </span>
                </div>
                <div className="bar">
                  <i style={{ width: `${Math.min(100, b.pct)}%`, background: isOver ? "var(--warn)" : catColor(b.cat) }} />
                  {b.period !== "daily" && <b className="marker" style={{ left: `${b.elapsed * 100}%` }} title="How far into the period we are" />}
                </div>
                <div className={`s num${isOver ? " over" : ""}`}>
                  {isOver ? `${fmt(-b.left)} over ${periodInfo(b.period).this}` : `${fmt(b.left)} left ${periodInfo(b.period).this}`}
                  {behind && " · spending fast ⚠️"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="sectionhead">
        <h2>Categories</h2>
        <button className="link" onClick={() => setCatEdit("new")}>
          + New category
        </button>
      </div>
      <div className="catchips">
        {catNames(custom).map((name) => {
          const c = custom.find((x) => x.name === name);
          return (
            <button
              key={name}
              className={`catchip${c ? " custom" : ""}`}
              onClick={() => (c ? setCatEdit(c) : undefined)}
              disabled={!c}
              title={c ? "Edit category" : "Built-in category"}
              style={{ ["--cc" as string]: catColor(name, custom) }}
            >
              <Emoji e={catEmoji(name, custom)} /> {name}
              {c && <Icon name="edit" size={13} />}
            </button>
          );
        })}
      </div>
      <p className="hint">Your own categories show up everywhere you pick a category. Typing its name to Alki (e.g. “milk tea 120”) files it there too.</p>

      {editing && <BudgetForm ctx={ctx} cat={editing === "new" ? null : editing} onClose={() => setEditing(null)} onNewCategory={() => setCatEdit("new")} />}
      {catEdit && <CategoryForm ctx={ctx} cat={catEdit === "new" ? null : catEdit} onClose={() => setCatEdit(null)} />}
    </>
  );
}

function BudgetForm({ ctx, cat, onClose, onNewCategory }: { ctx: Ctx; cat: string | null; onClose: () => void; onNewCategory: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const custom = state.customCats ?? [];
  const taken = new Set(Object.keys(state.budgets));
  const choices = catNames(custom).filter((c) => c === cat || !taken.has(c));
  const [category, setCategory] = useState(cat ?? choices[0] ?? "Food");
  const [amount, setAmount] = useState(cat ? String(state.budgets[cat] ?? "") : "");
  const [period, setPeriod] = useState<BudgetPeriod>(cat ? periodOf(state, cat) : "monthly");

  function save(e: FormEvent) {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    if (cat && cat !== category) k.moveBudget(cat, category);
    k.setBudget(category, v, period);
    toast(`${periodInfo(period).label} ${category} budget: ${fmt(v)}`);
    onClose();
  }

  return (
    <Modal title={cat ? "Edit budget" : "New budget"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          Category
          <select value={category} onChange={(e) => (e.target.value === "__new" ? (onClose(), onNewCategory()) : setCategory(e.target.value))}>
            {choices.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__new">＋ New category…</option>
          </select>
        </label>
        <label>
          Limit
          <MoneyInput value={amount} onChange={setAmount} placeholder="5,000" required />
        </label>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Resets
          </div>
          <div className="seg small wrap" role="tablist">
            {PERIODS.map((p) => (
              <button type="button" key={p.id} role="tab" aria-selected={period === p.id} onClick={() => setPeriod(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn" type="submit">
          {cat ? "Save budget" : "Add budget"}
        </button>
        {cat && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              k.setBudget(cat, 0);
              toast(`Removed the ${cat} budget`);
              onClose();
            }}
          >
            Remove budget
          </button>
        )}
      </form>
    </Modal>
  );
}

function CategoryForm({ ctx, cat, onClose }: { ctx: Ctx; cat: CustomCat | null; onClose: () => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const [name, setName] = useState(cat?.name ?? "");
  const [emoji, setEmoji] = useState(cat?.emoji ?? CAT_EMOJI_CHOICES[0]);
  const [color, setColor] = useState(cat?.color ?? CAT_COLOR_CHOICES[(state.customCats?.length ?? 0) % CAT_COLOR_CHOICES.length]);
  const [keywords, setKeywords] = useState((cat?.keywords ?? []).join(", "));
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");
  const used = cat ? state.txs.filter((t) => t.cat === cat.name).length : 0;

  function save(e: FormEvent) {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, " ").slice(0, 24);
    if (!n) return;
    const clash = catNames(state.customCats ?? []).some((c) => c.toLowerCase() === n.toLowerCase() && c !== cat?.name);
    if (clash || isBuiltIn(n) || ["income", "transfer", "debt"].includes(n.toLowerCase())) return setError("That category already exists.");
    const next: CustomCat = {
      name: n,
      emoji,
      color,
      keywords: keywords
        .split(",")
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12),
    };
    if (cat) k.updateCustomCat(cat.name, next);
    else k.addCustomCat(next);
    toast(`${emoji} ${n} ${cat ? "saved" : "added"}`);
    onClose();
  }

  return (
    <Modal title={cat ? "Edit category" : "New category"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="catpreview" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}>
          <span>{emoji}</span>
          <b>{name.trim() || "Category name"}</b>
        </div>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Milk tea, Baby, Pets" maxLength={24} required autoFocus />
        </label>
        <fieldset className="emojis">
          <legend>Icon</legend>
          {CAT_EMOJI_CHOICES.map((em) => (
            <button type="button" key={em} aria-pressed={emoji === em} onClick={() => setEmoji(em)} aria-label={em}>
              <Emoji e={em} />
            </button>
          ))}
        </fieldset>
        <fieldset className="swatches">
          <legend>Color</legend>
          {CAT_COLOR_CHOICES.map((c) => (
            <button type="button" key={c} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} />
          ))}
        </fieldset>
        <label>
          Words that mean this category (optional)
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. boba, chatime, coco" />
        </label>
        {error && <p className="warnt">{error}</p>}
        <button className="btn" type="submit">
          {cat ? "Save category" : "Add category"}
        </button>
        {cat && (
          <button
            type="button"
            className={`btn ${armed ? "danger" : "ghost"}`}
            onClick={() => {
              if (!armed) return setArmed(true);
              k.removeCustomCat(cat.name);
              toast(`Deleted ${cat.name}${used ? `; ${used} entries moved to Other` : ""}`);
              onClose();
            }}
          >
            {armed ? `Tap again to delete${used ? ` (${used} entries move to Other)` : ""}` : "Delete category"}
          </button>
        )}
      </form>
    </Modal>
  );
}
