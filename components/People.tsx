"use client";

import { FormEvent, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { Debt } from "@/lib/types";
import { debtLeft, debtPaid, isSettled } from "@/lib/debts";
import { PERSON_COLORS, defaultColor, findProfile, initials, personReminder, type PersonSummary } from "@/lib/people";
import ReminderCard from "./ReminderCard";
import { fmt, shortDate } from "@/lib/format";
import Sheet, { Modal } from "./Sheet";
import Icon from "./Icon";
import Emoji from "./Emoji";

/** Round avatar: the person's emoji, else their initials, on their color. */
export function PersonAvatar({ name, emoji, color, label, size = 44 }: { name: string; emoji?: string; color?: string; label?: string; size?: number }) {
  return (
    <span
      className={`pavatar${emoji ? " emoji" : ""}`}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * (emoji ? 0.5 : (label ?? initials(name)).length > 1 ? 0.34 : 0.4), ["--pc" as string]: color ?? defaultColor(name) }}
    >
      {emoji || label || initials(name)}
    </span>
  );
}

const pct = (p: PersonSummary) => (p.collectTarget > 0 ? Math.min(100, Math.round((p.collected / p.collectTarget) * 100)) : 0);

/** One person on the Debts tab: net balance, breakdown and collection progress. */
export function PersonCard({ p, onOpen }: { p: PersonSummary; onOpen: () => void }) {
  const splitCount = p.open.filter((d) => d.splitId).length;
  return (
    <button className="card personcard" onClick={onOpen} aria-label={`Open ${p.name}`}>
      <div className="ptop">
        <PersonAvatar name={p.name} emoji={p.profile?.emoji} color={p.color} label={p.label} />
        <div className="main">
          <div className="t">{p.name}</div>
          <div className="s">
            {p.open.length} open item{p.open.length === 1 ? "" : "s"}
            {splitCount > 0 ? ` · ${splitCount} from splits` : ""}
          </div>
        </div>
        <span className="chev">
          <Icon name="chevron" size={18} />
        </span>
      </div>
      <div className="pbal">
        <div>
          <div className="eyebrow">{p.open.length === 0 ? "All settled" : "Owes you"}</div>
          <b className={`pnet num ${p.owedLeft > 0 ? "in" : ""}`}>{fmt(p.owedLeft, true)}</b>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="eyebrow">You owe</div>
          <b className={`pnet num ${p.oweLeft > 0 ? "out" : ""}`}>{fmt(p.oweLeft, true)}</b>
        </div>
      </div>
      {p.collectTarget > 0 && (
        <div className="pprog">
          <div className="pprogtxt">
            <span className="num">
              {fmt(p.collected, true)} of {fmt(p.collectTarget, true)} collected
            </span>
            <b className="num">{pct(p)}%</b>
          </div>
          <div className="bar">
            <i style={{ width: `${pct(p)}%`, background: "var(--accent)" }} />
          </div>
        </div>
      )}
    </button>
  );
}

/** Full-screen profile: who they are, the balance between you, and every item. */
export function PersonSheet({
  ctx,
  p,
  onClose,
  onPay,
  onEdit,
  onAdd,
  onSettle,
  onRenamed,
}: {
  ctx: Ctx;
  p: PersonSummary;
  onClose: () => void;
  onPay: (d: Debt) => void;
  onEdit: (d: Debt) => void;
  onAdd: (direction: "owe" | "owed") => void;
  onSettle: () => void;
  onRenamed: (newName: string) => void;
}) {
  const { k, toast } = ctx;
  const [editingProfile, setEditingProfile] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const [reminding, setReminding] = useState(false);
  const profile = p.profile;
  const splits = k.state.splits ?? [];
  const splitTitle = (d: Debt) => splits.find((s) => s.id === d.splitId)?.title;

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg);
    } catch {
      toast("Couldn’t copy on this device");
    }
  }

  async function remind() {
    const text = personReminder(p, (n) => fmt(n, true), k.state.settings.payInfo?.trim() || undefined);
    try {
      if (navigator.share) await navigator.share({ text });
      else await copy(text, "Reminder copied. Paste it in your chat.");
    } catch {
      /* share sheet closed */
    }
  }

  const row = (d: Debt) => {
    const left = debtLeft(d);
    const settled = isSettled(d);
    const fromSplit = splitTitle(d);
    const paid = debtPaid(d);
    return (
      <div className={`pitem${settled ? " settled" : ""}`} key={d.id}>
        <span className={`picon ${d.direction}`} aria-hidden="true">
          {d.splitId ? "🧾" : d.direction === "owed" ? "↙" : "↗"}
        </span>
        <button className="main" onClick={() => !settled && onPay(d)} disabled={settled} aria-label={settled ? undefined : `Record payment for ${d.note || "this item"}`}>
          <span className="t">{d.note || fromSplit || (d.direction === "owed" ? "Lent" : "Borrowed")}</span>
          <span className="s">
            {d.direction === "owed" ? "Owes you" : "You owe"} · {shortDate(d.created)}
            {fromSplit ? " · split" : ""}
            {paid > 0 && !settled ? ` · ${fmt(paid, true)} paid` : ""}
            {settled && (<> · settled <Emoji e="✅" /></>)}
          </span>
        </button>
        <b className={`num ${d.direction === "owed" ? "in" : "out"}`}>
          {d.direction === "owe" ? "−" : ""}
          {fmt(settled ? d.amount : left, true)}
        </b>
        <button className="x" aria-label={`Edit ${d.note || "item"}`} onClick={() => onEdit(d)}>
          <Icon name="edit" size={16} />
        </button>
      </div>
    );
  };

  return (
    <Sheet
      title="Profile"
      onClose={onClose}
      right={
        <button className="iconbtn" aria-label={`Edit ${p.name}'s profile`} onClick={() => setEditingProfile(true)}>
          <Icon name="edit" size={18} />
        </button>
      }
    >
      <div className="phero" style={{ ["--pc" as string]: p.color }}>
        <PersonAvatar name={p.name} emoji={profile?.emoji} color={p.color} label={p.label} size={84} />
        <h2>{p.name}</h2>
        {profile?.note && <p className="sub">{profile.note}</p>}
        {profile?.payHandle ? (
          <button className="payhandle" onClick={() => void copy(profile.payHandle!, "Payment details copied")}>
            <Emoji e="💳" /> {profile.payHandle} <Icon name="copy" size={14} />
          </button>
        ) : (
          <button className="link" onClick={() => setEditingProfile(true)}>
            + Add GCash / bank details
          </button>
        )}
      </div>

      <div className="card pbalance">
        <div className="pbal" style={{ marginTop: 0, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div className="eyebrow">{p.open.length === 0 ? "All settled" : "Owes you"}</div>
            <b className={`pbig num ${p.owedLeft > 0 ? "in" : ""}`} style={{ fontSize: "1.7rem" }}>{fmt(p.owedLeft, true)}</b>
          </div>
          <div style={{ flex: 1 }}>
            <div className="eyebrow">You owe</div>
            <b className={`pbig num ${p.oweLeft > 0 ? "out" : ""}`} style={{ fontSize: "1.7rem" }}>{fmt(p.oweLeft, true)}</b>
          </div>
        </div>
        {p.collectTarget > 0 && (
          <div className="pprog">
            <div className="pprogtxt">
              <span className="num">
                {fmt(p.collected, true)} of {fmt(p.collectTarget, true)} collected
              </span>
              <b className="num">{pct(p)}%</b>
            </div>
            <div className="bar">
              <i style={{ width: `${pct(p)}%`, background: "var(--accent)" }} />
            </div>
          </div>
        )}
        <div className="pactions">
          <button className="btn" onClick={onSettle} disabled={p.open.length === 0}>
            <Icon name="check" size={18} /> Settle up
          </button>
          <button className="btn ghost" onClick={() => (p.net > 0 ? setReminding(true) : void remind())} disabled={p.open.length === 0}>
            <Icon name="send" size={18} /> Remind
          </button>
        </div>
      </div>

      <div className="sectionhead">
        <h2>Open items</h2>
        <div className="formrow">
          <button className="btn ghost sm" onClick={() => onAdd("owed")}>
            <Icon name="plus" size={16} /> Owes me
          </button>
          <button className="btn ghost sm" onClick={() => onAdd("owe")}>
            <Icon name="plus" size={16} /> I owe
          </button>
        </div>
      </div>
      {p.open.length === 0 ? (
        <div className="card empty">Nothing open with {p.name.split(" ")[0]}. <Emoji e="🙌" /></div>
      ) : (
        <div className="card plist">{[...p.open].sort((a, b) => b.created - a.created).map(row)}</div>
      )}
      {p.open.length > 0 && <p className="hint">Tap an item when they pay part or all of it.</p>}

      {p.settled.length > 0 && (
        <>
          <button className="link" style={{ marginTop: 18 }} onClick={() => setShowSettled((v) => !v)}>
            {showSettled ? "Hide" : "Show"} settled ({p.settled.length})
          </button>
          {showSettled && <div className="card plist" style={{ marginTop: 10 }}>{[...p.settled].sort((a, b) => b.created - a.created).map(row)}</div>}
        </>
      )}

      {reminding && <ReminderCard ctx={ctx} p={p} onClose={() => setReminding(false)} />}
      {editingProfile && <ProfileForm ctx={ctx} name={p.name} onClose={() => setEditingProfile(false)} onRenamed={onRenamed} />}
    </Sheet>
  );
}

/** Edit name, avatar and payment details. Renaming moves their debts along with them. */
export function ProfileForm({ ctx, name, onClose, onRenamed }: { ctx: Ctx; name: string; onClose: () => void; onRenamed?: (newName: string) => void }) {
  const { k, toast } = ctx;
  const existing = findProfile(k.state, name);
  const [n, setN] = useState(existing?.name ?? name);
  const [emoji, setEmoji] = useState(existing?.emoji ?? "");
  const [color, setColor] = useState(existing?.color ?? defaultColor(name));
  const [payHandle, setPayHandle] = useState(existing?.payHandle ?? "");
  const [note, setNote] = useState(existing?.note ?? "");

  function save(e: FormEvent) {
    e.preventDefault();
    if (!n.trim()) return;
    k.savePerson({ id: existing?.id, name: n, emoji: emoji.trim() || undefined, color, payHandle: payHandle.trim() || undefined, note: note.trim() || undefined }, name);
    toast(`Saved ${n.trim()}`);
    onRenamed?.(n.trim());
    onClose();
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="pformhead">
          <PersonAvatar name={n || "?"} emoji={emoji.trim() || undefined} color={color} size={64} />
          <div className="swatches" role="radiogroup" aria-label="Avatar color">
            {PERSON_COLORS.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={`Color ${c}`} className="swatch" style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <label>
          Name
          <input value={n} onChange={(e) => setN(e.target.value)} required maxLength={40} />
        </label>
        <label>
          Avatar emoji (optional)
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="e.g. 🐱 or 🏀" maxLength={4} />
        </label>
        <label>
          GCash, Maya or bank details (optional)
          <input value={payHandle} onChange={(e) => setPayHandle(e.target.value)} placeholder="e.g. GCash 0917 123 4567" maxLength={60} />
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Officemate, pays every 15th" maxLength={60} />
        </label>
        <button className="btn" type="submit">
          Save profile
        </button>
        {existing && (
          <button
            type="button"
            className="link"
            onClick={() => {
              k.removePerson(existing.id);
              toast(`Profile cleared. Debts with ${existing.name} are kept.`);
              onClose();
            }}
          >
            Clear profile details
          </button>
        )}
        <p className="hint">Changing the name also renames their debts and split shares.</p>
      </form>
    </Modal>
  );
}
