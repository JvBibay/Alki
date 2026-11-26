"use client";

import { useRef, useState } from "react";
import type { Account, Tx } from "@/lib/types";
import { catColor, catEmoji } from "@/lib/categories";
import { accountName, fmtIn } from "@/lib/format";
import Icon from "./Icon";
import BankLogo from "./BankLogo";
import Emoji from "./Emoji";

/** How far the row slides to show its Edit and Delete buttons. */
const REVEAL = 144;

/**
 * One entry. When it can be deleted, swipe it left to reveal Edit and Delete (Delete always has an Undo toast);
 * on a mouse the trash icon shows on hover, and Delete/Backspace works with the keyboard.
 */
export default function TxRow({ tx, accounts, onDelete, onEdit, showDate }: { tx: Tx; accounts: Account[]; onDelete?: () => void; onEdit?: () => void; showDate?: boolean }) {
  const icon = tx.type === "transfer" ? "🔁" : tx.type === "income" ? "💰" : catEmoji(tx.cat);
  const tint = tx.type === "income" ? "#10b981" : tx.type === "transfer" ? "#64748b" : catColor(tx.cat);
  const cur = accounts.find((a) => a.id === tx.acc)?.currency;
  const toCur = accounts.find((a) => a.id === tx.to)?.currency;
  const sub =
    tx.type === "transfer"
      ? `${accountName(accounts, tx.acc)} → ${accountName(accounts, tx.to)}${tx.toAmount !== undefined ? ` (${fmtIn(tx.toAmount, toCur)})` : ""}`
      : `${tx.cat} · ${accountName(accounts, tx.acc)}`;
  const cls = tx.type === "income" ? "in" : tx.type === "expense" ? "out" : "";
  const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "−" : "";
  const when = showDate
    ? new Date(tx.date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
    : new Date(tx.date).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

  const swipeable = !!onDelete;
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null); // current offset while a finger is down
  const start = useRef<{ x: number; base: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  const down = (e: React.PointerEvent) => {
    if (!swipeable || (e.target as HTMLElement).closest("button")) return;
    start.current = { x: e.clientX, base: open ? -REVEAL : 0, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const d = e.clientX - s.x;
    if (!s.moved && Math.abs(d) < 8) return;
    if (!s.moved) e.currentTarget.setPointerCapture?.(e.pointerId);
    s.moved = true;
    setDrag(Math.max(-REVEAL, Math.min(0, s.base + d)));
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    if (!s?.moved) return;
    justDragged.current = true; // the click that follows a drag shouldn't open the editor
    setTimeout(() => (justDragged.current = false), 0);
    setOpen((drag ?? 0) < -REVEAL / 2);
    setDrag(null);
  };
  const click = () => {
    if (justDragged.current) return;
    if (open) return setOpen(false);
    onEdit?.();
  };

  const offset = drag ?? (open ? -REVEAL : 0);

  const row = (
    <div
      className={`row${onEdit ? " tappable" : ""}${swipeable ? " swiperow" : ""}`}
      style={swipeable ? { transform: `translateX(${offset}px)`, transition: drag === null ? "transform 0.2s ease" : "none" } : undefined}
      onClick={onEdit || swipeable ? click : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role={onEdit ? "button" : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onKeyDown={
        onEdit
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") (e.preventDefault(), onEdit());
              else if (onDelete && (e.key === "Delete" || e.key === "Backspace")) (e.preventDefault(), onDelete());
            }
          : undefined
      }
      aria-label={onEdit ? `Edit ${tx.note}. Swipe left for more actions.` : undefined}
    >
      <div className="ico" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}>
        <Emoji e={icon} />
        {accounts.find((a) => a.id === tx.acc) && (
          <span className="accbadge">
            <BankLogo account={accounts.find((a) => a.id === tx.acc)} size={18} />
          </span>
        )}
      </div>
      <div className="main">
        <div className="t">
          {tx.note}
          {tx.photo && <span className="clip" title="Has a receipt photo"> <Emoji e="📎" /></span>}
        </div>
        <div className="s">
          {sub}{tx.track ? " · track only" : ""} · <span className="nowrap">{when}</span>
        </div>
      </div>
      <div className={`amt num ${cls}`}>
        {sign}
        {fmtIn(tx.amount, cur)}
      </div>
      {onDelete && (
        <button
          className="x txdel"
          onClick={(e) => {
            e.stopPropagation(); // don't also open the editor
            onDelete();
          }}
          aria-label={`Delete ${tx.note}`}
        >
          <Icon name="trash" size={18} />
        </button>
      )}
    </div>
  );

  if (!swipeable) return row;
  return (
    <div className="swipe">
      <div className="swipeactions" aria-hidden={!open} style={{ visibility: open || drag !== null ? "visible" : "hidden" }}>
        <button className="swedit" tabIndex={open ? 0 : -1} onClick={() => (setOpen(false), onEdit?.())}>
          <Icon name="edit" size={18} /> Edit
        </button>
        <button className="swdel" tabIndex={open ? 0 : -1} onClick={() => (setOpen(false), onDelete?.())}>
          <Icon name="trash" size={18} /> Delete
        </button>
      </div>
      {row}
    </div>
  );
}
