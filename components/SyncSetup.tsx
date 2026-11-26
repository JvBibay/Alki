"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { State } from "@/lib/types";
import { currentUserId, pullSnapshot, snapshotTime } from "@/lib/cloud";
import { keepThisDevice, markRestored, setPassphrase, skipSetup } from "@/lib/sync";
import Icon from "./Icon";

type Step = "checking" | "offline" | "create" | "enter" | "choose";

const isEmpty = (s: State) => s.accounts.length === 0 && s.txs.length === 0;

/**
 * Shown right after sign-in when no sync passphrase is set for this browser session.
 * No cloud backup yet: choose a passphrase (this device's data becomes the first backup).
 * A backup exists: enter the passphrase to restore it, or keep this device's data.
 */
export default function SyncSetup({ ctx, onDone }: { ctx: Ctx; onDone: () => void }) {
  const [step, setStep] = useState<Step>("checking");
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [found, setFound] = useState<{ state: State; updatedAt: string } | null>(null);

  useEffect(() => {
    let alive = true;
    snapshotTime().then(
      (t) => alive && setStep(t ? "enter" : "create"),
      () => alive && setStep("offline"),
    );
    return () => {
      alive = false;
    };
  }, []);

  function skip() {
    skipSetup();
    onDone();
  }

  async function restore(state: State, updatedAt: string, pw: string) {
    await ctx.k.replaceAll(state);
    markRestored(await currentUserId(), updatedAt, state); // before the passphrase, so nothing is uploaded back
    setPassphrase(pw);
    if (remember) await ctx.k.rememberSyncPass(pw);
    ctx.toast("Restored from the cloud. Auto-sync is on.");
    onDone();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (pass.length < 8) return setError("Use a passphrase of at least 8 characters.");
    if (step === "create") {
      if (pass !== again) return setError("The passphrases don’t match.");
      setPassphrase(pass); // auto-sync uploads this device’s data as the first backup
      if (remember) void ctx.k.rememberSyncPass(pass);
      ctx.toast("Sync is on. Your data will back up automatically.");
      return onDone();
    }
    setBusy(true);
    try {
      const got = await pullSnapshot(pass); // throws a friendly error for a wrong passphrase
      if (isEmpty(ctx.k.state)) await restore(got.state, got.updatedAt, pass);
      else {
        setFound(got);
        setStep("choose");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t open the backup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authwrap" style={{ position: "fixed", inset: 0, zIndex: 45, overflowY: "auto" }}>
      <div className="authbox">
        <div className="acct-hero">
          <div className="acct-avatar" aria-hidden="true">
            <Icon name={step === "choose" ? "download" : "lock"} size={32} />
          </div>
          <div className="acct-name">
            {step === "create" ? "Protect your backup" : step === "choose" ? "Which data do you want?" : "Unlock your backup"}
          </div>
          <p>
            {step === "create"
              ? "Choose a sync passphrase. It encrypts your data on this device, so only you can read it."
              : step === "choose"
                ? "This device already has data, and so does your cloud backup."
                : "Enter your sync passphrase to bring your data to this device."}
          </p>
        </div>

        <div className="card" style={{ marginTop: 12, padding: 16 }}>
          {step === "checking" && <p className="sub">Checking your cloud backup…</p>}

          {step === "offline" && (
            <div className="form" style={{ padding: 0 }}>
              <p className="sub">You’re offline or the cloud isn’t reachable. You can keep using Kwenta, and unlock sync later from Account → Back up now.</p>
              <button className="btn" onClick={skip}>
                Continue without sync
              </button>
            </div>
          )}

          {(step === "create" || step === "enter") && (
            <form className="form" style={{ padding: 0 }} onSubmit={submit}>
              <label>
                Sync passphrase
                <input type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="At least 8 characters" autoFocus />
              </label>
              {step === "create" && (
                <label>
                  Type it again
                  <input type="password" autoComplete="off" value={again} onChange={(e) => setAgain(e.target.value)} />
                </label>
              )}
              <p className="sub">
                {step === "create"
                  ? "It can’t be recovered if you forget it, and you’ll enter it again each time you reopen the browser."
                  : "This is the passphrase you chose on your first device."}
              </p>
              <label style={{ flexDirection: "row", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 20, height: 20, flex: "none", padding: 0 }} />
                <span>Remember on this device</span>
              </label>
              <p className="sub" style={{ marginTop: -4 }}>
                So you don’t have to enter it each time you open Kwenta. {ctx.k.lockOn ? "It’s kept protected by your PIN." : "Without a PIN lock it’s stored unprotected on this device."}
              </p>
              {error && <p className="warnt">{error}</p>}
              <button className="btn" type="submit" disabled={busy || !pass}>
                {busy ? "Checking…" : step === "create" ? "Turn on sync" : "Unlock"}
              </button>
              <button type="button" className="btn ghost" onClick={skip}>
                Skip for now
              </button>
            </form>
          )}

          {step === "choose" && found && (
            <div className="form" style={{ padding: 0 }}>
              <p className="sub">
                <b>Cloud backup:</b> {found.state.txs.length} transactions, {found.state.accounts.length} accounts.
                <br />
                <b>This device:</b> {ctx.k.state.txs.length} transactions, {ctx.k.state.accounts.length} accounts.
              </p>
              <button
                className="btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await restore(found.state, found.updatedAt, pass);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Use my cloud backup
              </button>
              <p className="sub" style={{ marginTop: -4 }}>Replaces this device’s data. You can undo it from Settings → Undo last import.</p>
              <button
                className="btn ghost"
                disabled={busy}
                onClick={() => {
                  setPassphrase(pass);
                  if (remember) void ctx.k.rememberSyncPass(pass);
                  keepThisDevice(); // overwrite the cloud copy with this device’s data
                  ctx.toast("Keeping this device’s data. Uploading it now.");
                  onDone();
                }}
              >
                Keep this device’s data
              </button>
              <p className="sub" style={{ marginTop: -4 }}>Overwrites your cloud backup with what’s on this device.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
