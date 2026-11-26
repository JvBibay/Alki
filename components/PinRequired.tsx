"use client";

import { FormEvent, useState } from "react";
import type { Ctx } from "@/lib/ui";
import Icon from "./Icon";

const PIN_RE = /^\d{4,6}$/;

/**
 * Offered once after sign-in: a PIN encrypts the data stored on this device and locks the app after
 * time in the background. It's optional ("Not now"), and can be turned on later in Settings.
 */
export default function PinRequired({ ctx, onSkip }: { ctx: Ctx; onSkip: () => void }) {
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!PIN_RE.test(pin)) return setError("Use 4 to 6 digits.");
    if (pin !== again) return setError("The two PINs don’t match.");
    setBusy(true);
    try {
      await ctx.k.setPin(pin);
      ctx.toast("PIN lock is on. Your data is now encrypted on this device.");
    } catch {
      setError("Couldn’t save the PIN. Try again.");
      setBusy(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, auto?: boolean) => (
    <label>
      {label}
      <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={value} autoFocus={auto} onChange={(e) => set(e.target.value.replace(/\D/g, ""))} />
    </label>
  );

  return (
    <div className="authwrap" style={{ position: "fixed", inset: 0, zIndex: 46, overflowY: "auto" }}>
      <div className="authbox">
        <div className="acct-hero">
          <div className="acct-avatar" aria-hidden="true">
            <Icon name="lock" size={32} />
          </div>
          <div className="acct-name">Add a PIN? (optional)</div>
          <p>A PIN locks Kwenta and encrypts the data on this device. You can also turn it on later in Settings.</p>
        </div>
        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          <form className="form" style={{ padding: 0 }} onSubmit={submit}>
            {field("PIN (4–6 digits)", pin, setPin, true)}
            {field("Type it again", again, setAgain)}
            <p className="sub">If you forget this PIN, the data on this device can’t be opened. Your cloud backup and sync passphrase still work.</p>
            {error && <p className="warnt">{error}</p>}
            <button className="btn" type="submit" disabled={busy || !pin}>
              {busy ? "Saving…" : "Save PIN"}
            </button>
            <button type="button" className="btn ghost" onClick={onSkip} disabled={busy}>
              Not now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
