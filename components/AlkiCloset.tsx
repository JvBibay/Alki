"use client";

import { useState } from "react";
import type { Ctx } from "@/lib/ui";
import { badges } from "@/lib/badges";
import { ITEMS, isUnlocked, lookOf, SLOTS, type Item, type Look, type Slot } from "@/lib/closet";
import Mascot from "./Mascot";
import Icon from "./Icon";
import BandScene from "./BandScene";
import Emoji from "./Emoji";

/** Mix-and-match accessories for Alki: one item per slot, saved as you tap. */
export default function AlkiCloset({ ctx }: { ctx: Ctx }) {
  const { k, toast } = ctx;
  const { state } = k;
  const look = lookOf(state.settings);
  const [slot, setSlot] = useState<Slot>("head");
  const list = badges(state);
  const earned = new Set(list.filter((b) => b.earned).map((b) => b.id));
  const unlockedCount = ITEMS.filter((i) => isUnlocked(i, earned)).length;
  const items = ITEMS.filter((i) => i.slot === slot);

  const save = (next: Look) => k.updateSettings({ look: next });

  function wear(item: Item | null) {
    const next = { ...look };
    if (item) next[slot] = item.id;
    else delete next[slot];
    save(next);
  }

  function surprise() {
    const next: Look = {};
    for (const s of SLOTS) {
      const pool = ITEMS.filter((i) => i.slot === s.id && isUnlocked(i, earned));
      // Leave some slots empty so it doesn't always look busy.
      if (pool.length && Math.random() < 0.75) next[s.id] = pool[Math.floor(Math.random() * pool.length)].id;
    }
    save(next);
    toast("Alki picked a new look! ✨");
  }

  const needText = (item: Item) => (item.needs === "season" ? "Pasko season" : list.find((b) => b.id === item.needs)?.name ?? "Locked");

  // The scene is shown as a landscape behind Alki here, not as a circle (same as the headers).
  const { scene, ...plain } = look;

  return (
    <div className="closet">
      <div className={`closetstage${scene ? " withscene" : ""}`}>
        {scene && <BandScene id={scene} variant="stage" motion={state.settings.alkiMotion !== false} />}
        <Mascot size={128} look={plain} animated={state.settings.alkiMotion !== false} />
      </div>
      <div className="closetbar">
        <span className="sub">
          {unlockedCount} of {ITEMS.length} unlocked
        </span>
        <span className="formrow">
          <button className="btn ghost sm" onClick={surprise}>
            <Emoji e="🎲" /> Surprise me
          </button>
          <button className="btn ghost sm" onClick={() => save({})} disabled={Object.keys(look).length === 0}>
            Take off all
          </button>
        </span>
      </div>

      {/* icon-only tabs; the chosen slot's name shows underneath */}
      <div className="seg closettabs" role="tablist" aria-label="Accessory type">
        {SLOTS.map((s) => (
          <button key={s.id} role="tab" aria-selected={slot === s.id} aria-label={s.label} title={s.label} onClick={() => setSlot(s.id)}>
            <Icon name={s.glyph} size={24} />
          </button>
        ))}
      </div>
      <div className="closetlabel">{SLOTS.find((s) => s.id === slot)?.label}</div>

      <div className="closetgrid">
        <button className="closetitem" aria-pressed={!look[slot]} onClick={() => wear(null)}>
          {slot === "scene" ? (
            <span className="scenethumb">
              <Mascot size={44} look={plain} />
            </span>
          ) : (
            <Mascot size={54} look={{ ...plain, [slot]: undefined }} />
          )}
          <b>None</b>
        </button>
        {items.map((item) => {
          const open = isUnlocked(item, earned);
          return (
            <button
              key={item.id}
              className={`closetitem${open ? "" : " locked"}`}
              aria-pressed={look[slot] === item.id}
              disabled={!open}
              onClick={() => wear(item)}
              title={open ? item.name : `Unlock with: ${needText(item)}`}
            >
              {slot === "scene" ? (
                <span className="scenethumb">
                  <BandScene id={item.id} variant="stage" motion={false} />
                  <Mascot size={44} look={plain} />
                </span>
              ) : (
                <Mascot size={54} look={{ ...plain, [slot]: item.id }} />
              )}
              <b>{item.name}</b>
              {!open && <small><Emoji e="🔒" /> {needText(item)}</small>}
            </button>
          );
        })}
      </div>
      <p className="hint">Earn badges to unlock more. The Pasko hat, Pasko scarf and Parol night scene are available every ber month until January 6. <Emoji e="🎄" /></p>
    </div>
  );
}
