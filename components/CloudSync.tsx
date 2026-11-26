"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Ctx } from "@/lib/ui";
import type { State } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { ConflictError, currentUserId, passphraseWorks, pullSnapshot, pushSnapshot, snapshotTime } from "@/lib/cloud";
import { getSyncAt, lockSync, markRestored, setPassphrase, setSyncAt, usePassphrase, useSyncStatus } from "@/lib/sync";
import { Modal } from "./Sheet";
import AuthScreen from "./AuthScreen";
import Icon from "./Icon";
import Plans from "./Plans";
import { describeAccess, useAccess } from "@/lib/plans";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : null);

/** Sign in to a cloud account, then back up to or restore from an end-to-end encrypted snapshot. */
export default function CloudSync({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const sb = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sb) return setLoading(false);
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  return (
    <Modal title="Cloud backup" onClose={onClose}>
      {!sb ? (
        <p className="sub">Cloud backup isn’t set up in this build.</p>
      ) : loading ? (
        <p className="sub">Loading…</p>
      ) : session ? (
        <Synced ctx={ctx} email={session.user.email ?? "your account"} onClose={onClose} />
      ) : (
        <SignIn />
      )}
    </Modal>
  );
}

export function SignIn() {
  return <AuthScreen compact />;
}

function Synced({ ctx, email, onClose }: { ctx: Ctx; email: string; onClose: () => void }) {
  const sb = getSupabase()!;
  const stored = usePassphrase();
  const sync = useSyncStatus();
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [remember, setRemember] = useState(true);
  const [last, setLast] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "unlock" | "push" | "pull">("");
  const [confirmPull, setConfirmPull] = useState<{ state: State; updatedAt: string } | null>(null);
  const [conflict, setConflict] = useState(false);
  const access = useAccess();
  const [plans, setPlans] = useState(false);

  const refresh = () => snapshotTime().then(setLast, () => setLast(null));
  useEffect(() => {
    void refresh();
  }, []);

  /** Checks the passphrase against any existing backup, then keeps it for this session so auto-sync can run. */
  async function unlock(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (pass.length < 8) return setError("Use a sync passphrase of at least 8 characters.");
    if (last === null && pass !== again) return setError("The passphrases don’t match.");
    setBusy("unlock");
    try {
      if (!(await passphraseWorks(pass))) return setError("That isn’t the passphrase for your existing backup.");
      setPassphrase(pass);
      if (remember) void ctx.k.rememberSyncPass(pass);
      setPass("");
      setAgain("");
      ctx.toast("Sync unlocked. Changes now back up automatically.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t check the passphrase.");
    } finally {
      setBusy("");
    }
  }

  async function push(force: boolean) {
    if (!stored) return;
    setBusy("push");
    setError("");
    try {
      const uid = await currentUserId();
      const at = await pushSnapshot(ctx.k.state, stored, force ? "force" : getSyncAt(uid));
      setSyncAt(uid, at);
      setLast(at);
      setConflict(false);
      ctx.toast("Backed up to the cloud (encrypted).");
    } catch (err) {
      if (err instanceof ConflictError) setConflict(true);
      else setError(err instanceof Error ? err.message : "Couldn’t back up.");
    } finally {
      setBusy("");
    }
  }

  async function pull() {
    if (!stored) return;
    setBusy("pull");
    setError("");
    try {
      setConfirmPull(await pullSnapshot(stored));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t restore.");
    } finally {
      setBusy("");
    }
  }

  if (confirmPull) {
    return (
      <div className="form">
        <p className="sub">
          The cloud backup has {confirmPull.state.txs.length} transactions and {confirmPull.state.accounts.length} accounts. It will replace everything currently in Kwenta. You can
          undo this from Settings → Undo last import.
        </p>
        <button
          className="btn"
          onClick={async () => {
            await ctx.k.replaceAll(confirmPull.state);
            markRestored(await currentUserId(), confirmPull.updatedAt, confirmPull.state);
            setLast(confirmPull.updatedAt);
            ctx.toast("Restored from the cloud.");
            onClose();
          }}
        >
          Replace my data
        </button>
        <button className="btn ghost" onClick={() => setConfirmPull(null)}>
          Cancel
        </button>
      </div>
    );
  }

  const behind = conflict || sync.kind === "behind";
  // Until the first answer arrives, don't flash the upgrade box at someone who has a plan.
  const locked = access.loaded && !access.active;

  return (
    <div className="form">
      {plans && <Plans access={access} onClose={() => { setPlans(false); access.refresh(); }} />}
      {access.loaded && (
        <div className="card" style={{ padding: 12 }}>
          <b>{describeAccess(access)}</b>
          {locked && <p className="sub" style={{ margin: "6px 0 10px" }}>Saving to the cloud needs a plan. Everything else stays free, and you can still restore or delete your existing backup.</p>}
          {!access.admin && (
            <button className={locked ? "btn" : "btn ghost sm"} style={locked ? undefined : { marginTop: 8 }} onClick={() => setPlans(true)}>
              {locked ? "See plans" : "Manage plan"}
            </button>
          )}
        </div>
      )}
      <p className="sub">
        Signed in as <b>{email}</b>. {last === undefined ? "" : last ? `Last cloud backup: ${when(last)}.` : "No cloud backup yet."}
      </p>

      {!stored ? (
        <form className="form" style={{ padding: 0 }} onSubmit={unlock}>
          <label>
            Sync passphrase
            <input type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="At least 8 characters" />
          </label>
          {last === null && (
            <label>
              Type it again
              <input type="password" autoComplete="off" value={again} onChange={(e) => setAgain(e.target.value)} />
            </label>
          )}
          <p className="sub">
            {last === null
              ? "Choose a passphrase. It encrypts your data on this device before upload, so only you can read it. It can’t be recovered if you forget it."
              : "Enter the passphrase you set for your backup. Use the same one on every device."}
          </p>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 10, fontWeight: 700 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 20, height: 20, flex: "none", padding: 0 }} />
            <span>Remember on this device</span>
          </label>
          {error && <p className="warnt">{error}</p>}
          <button className="btn" type="submit" disabled={busy === "unlock" || last === undefined}>
            {busy === "unlock" ? "Checking…" : "Unlock sync"}
          </button>
        </form>
      ) : (
        <>
          <p className="sub">
            <b>{locked ? "Auto-sync is paused (no active plan)." : "Auto-sync is on."}</b> Changes upload a few seconds after you stop editing, encrypted on this device. You’ll be asked for the passphrase again after you close the
            browser. Receipt photos aren’t included.
          </p>
          {behind && (
            <div className="card" style={{ padding: 12 }}>
              <p className="warnt" style={{ fontWeight: 700 }}>
                A newer backup from another device is in the cloud.
              </p>
              <p className="sub" style={{ margin: "6px 0 10px" }}>
                Restore it to get those changes, or keep this device’s data and overwrite the cloud copy.
              </p>
              <button className="btn" onClick={pull} disabled={!!busy}>
                Restore the newer backup
              </button>
              <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => push(true)} disabled={!!busy}>
                Keep this device’s data
              </button>
            </div>
          )}
          {error && <p className="warnt">{error}</p>}
          <button className="btn" onClick={() => push(false)} disabled={!!busy || locked}>
            <Icon name="upload" size={18} /> {busy === "push" ? "Backing up…" : "Back up now"}
          </button>
          <button className="btn ghost" onClick={pull} disabled={!!busy}>
            <Icon name="download" size={18} /> {busy === "pull" ? "Restoring…" : "Restore from cloud"}
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              lockSync();
              void ctx.k.rememberSyncPass(null); // forget it on this device too
              ctx.toast("Sync locked. Auto-sync is paused.");
            }}
          >
            <Icon name="lock" size={18} /> Lock sync on this device
          </button>
        </>
      )}
      <button
        className="btn ghost"
        onClick={async () => {
          await sb.auth.signOut();
          ctx.toast("Signed out.");
        }}
      >
        Sign out
      </button>
    </div>
  );
}
