"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Ctx } from "@/lib/ui";
import { getSupabase } from "@/lib/supabase";
import { deleteSnapshot, snapshotTime } from "@/lib/cloud";
import Sheet from "./Sheet";
import Icon from "./Icon";
import CloudSync from "./CloudSync";
import { useIsAdmin } from "@/lib/admin";
import AuthScreen from "./AuthScreen";
import { clearOwner } from "@/lib/session";
import { COMMON_PASSWORD_MESSAGE, isCommonPassword } from "@/lib/passwords";
import { clearPassphrase, usePassphrase, useSyncStatus, type SyncStatus } from "@/lib/sync";

export const RECOVERY_FLAG = "kwenta-recovery";
/** Set just before signing out after a password reset, so the sign-in screen can say what happened. */
export const RESET_DONE_FLAG = "kwenta-reset-done";

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** Plain-language state for the Backup card. */
function describeSync(sync: SyncStatus, unlocked: boolean, last: string | null | undefined): { title: string; sub: string; tone: "ok" | "warn" | "bad" } {
  if (!unlocked) {
    return {
      title: last ? `Last backup ${ago(last)}` : "Not backed up yet",
      sub: "Auto-sync is paused. Open Back up now and unlock sync to turn it on.",
      tone: "warn",
    };
  }
  switch (sync.kind) {
    case "syncing":
      return { title: "Syncing…", sub: "Uploading an encrypted copy.", tone: "warn" };
    case "offline":
      return { title: "Offline", sub: "Changes are kept on this device and will upload when you’re back online.", tone: "warn" };
    case "error":
      return { title: "Couldn’t sync", sub: sync.message ? `${sync.message} Retrying soon.` : "Retrying soon.", tone: "bad" };
    case "behind":
      return { title: "Newer backup found", sub: "Another device saved first. Open Back up now to choose which to keep.", tone: "bad" };
    default: {
      const at = sync.at ?? last;
      return { title: at ? `Synced ${ago(at)}` : "Auto-sync on", sub: at ? new Date(at).toLocaleString() : "Your changes will upload shortly.", tone: "ok" };
    }
  }
}

const initials = (s: string) => (s.trim().match(/[A-Za-z0-9]/g)?.slice(0, 2).join("") || "?").toUpperCase();

/** Short status for the Settings card: the signed-in email, or null. */
export function useAccountEmail(): string | null | undefined {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return setEmail(null);
    void sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return email;
}

/** Full-screen account page: who you are, how safe your backup is, and account controls. */
export default function Account({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const sb = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(() => {
    try {
      return sessionStorage.getItem(RECOVERY_FLAG) === "1";
    } catch {
      return false;
    }
  });
  const [cloud, setCloud] = useState(false);

  useEffect(() => {
    if (!sb) return setLoading(false);
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  function doneRecovery() {
    try {
      sessionStorage.removeItem(RECOVERY_FLAG);
    } catch {
      /* ignore */
    }
    setRecovery(false);
  }

  return (
    <Sheet title="Account" onClose={onClose}>
      {!sb ? (
        <p className="sub">Accounts aren’t set up in this build.</p>
      ) : loading ? (
        <p className="sub">Loading…</p>
      ) : !session ? (
        <SignedOut />
      ) : recovery ? (
        <>
          <Hero session={session} ctx={ctx} />
          <h2>Set a new password</h2>
          <div className="card acct-signin">
            <NewPassword ctx={ctx} intro="You opened a reset link. Choose a new password for your account." onDone={doneRecovery} signOutAfter />
          </div>
        </>
      ) : (
        <Signed ctx={ctx} session={session} onCloud={() => setCloud(true)} onClose={onClose} />
      )}
      {cloud && <CloudSync ctx={ctx} onClose={() => setCloud(false)} />}
    </Sheet>
  );
}

function Hero({ session, ctx }: { session: Session; ctx: Ctx }) {
  const email = session.user.email ?? "";
  const name = ctx.k.state.settings.name || email.split("@")[0] || "You";
  return (
    <div className="acct-hero">
      <div className="acct-avatar" aria-hidden="true">
        {initials(name)}
      </div>
      <div className="acct-name">{name}</div>
      <div className="acct-mail">{email}</div>
      <div className="acct-tags">
        <span className="acct-tag">
          <Icon name="lock" size={13} /> End-to-end encrypted
        </span>
        <span className="acct-tag">Since {day(session.user.created_at)}</span>
      </div>
    </div>
  );
}

function SignedOut() {
  return <AuthScreen compact />;
}

/** `signOutAfter`: for a password reset, end the session so the person signs in again with the new password. */
function NewPassword({ ctx, intro, onDone, signOutAfter = false }: { ctx: Ctx; intro: string; onDone: () => void; signOutAfter?: boolean }) {
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (isCommonPassword(pw)) return setError(COMMON_PASSWORD_MESSAGE);
    if (pw !== again) return setError("The passwords don’t match.");
    setBusy(true);
    const { error } = await getSupabase()!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    if (signOutAfter) {
      // Reset link: don't stay logged in. Sign out everywhere (the old password may have been the problem), then show the sign-in page.
      try {
        sessionStorage.setItem(RESET_DONE_FLAG, "1");
        sessionStorage.removeItem(RECOVERY_FLAG);
      } catch {
        /* ignore */
      }
      await getSupabase()!.auth.signOut({ scope: "global" });
      return;
    }
    ctx.toast("Password updated.");
    setPw("");
    setAgain("");
    setError("");
    onDone();
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="sub">{intro}</p>
      <label>
        New password
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
      </label>
      <label>
        Type it again
        <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </label>
      {error && <p className="warnt">{error}</p>}
      <button className="btn" type="submit" disabled={busy || !pw}>
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

function Signed({ ctx, session, onCloud, onClose }: { ctx: Ctx; session: Session; onCloud: () => void; onClose: () => void }) {
  const isAdmin = useIsAdmin();
  const sb = getSupabase()!;
  const [last, setLast] = useState<string | null | undefined>(undefined);
  const [changing, setChanging] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState("");

  const sync = useSyncStatus();
  const pass = usePassphrase();

  // Reload the backup time on open, on focus, and whenever a sync finishes.
  useEffect(() => {
    const load = () => snapshotTime().then(setLast, () => setLast(null));
    void load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [sync.at]);

  const view = describeSync(sync, !!pass, last);

  const [out, setOut] = useState<null | "local" | "global">(null);
  async function finishSignOut(erase: boolean) {
    const scope = out === "global" ? "global" : "local";
    if (erase) {
      clearPassphrase(); // stop auto-sync first, so the emptied data can never be uploaded over your backup
      clearOwner(); // the device is clean, so the next account to sign in can start fresh
      ctx.k.eraseEverything(); // wipes this device’s data (and PIN, receipt photos) before leaving
    }
    const { error } = await sb.auth.signOut({ scope });
    if (error) return setError(error.message);
    ctx.toast(erase ? "Signed out and erased this device." : scope === "global" ? "Signed out of all devices." : "Signed out.");
    onClose();
  }

  return (
    <>
      <Hero session={session} ctx={ctx} />

      <h2>Backup</h2>
      <div className="card">
        <div className="acct-status">
          <span className={`acct-dot${view.tone === "ok" ? " ok" : view.tone === "bad" ? " bad" : ""}`} aria-hidden="true" />
          <div className="main">
            <div className="t" style={{ fontWeight: 800 }}>
              {view.title}
            </div>
            <div className="sub">{view.sub}</div>
          </div>
        </div>
      </div>
      <div className="acct-tiles">
        <button className="acct-tile" onClick={onCloud}>
          <div className="ico">
            <Icon name="upload" size={20} />
          </div>
          <div>
            <b>Back up now</b>
            <small>Upload an encrypted copy</small>
          </div>
        </button>
        <button className="acct-tile" onClick={onCloud}>
          <div className="ico">
            <Icon name="download" size={20} />
          </div>
          <div>
            <b>Restore</b>
            <small>Bring it to this device</small>
          </div>
        </button>
      </div>

      <h2>Security</h2>
      <div className="card">
        <button className="row rowbtn" onClick={() => setChanging((v) => !v)} aria-expanded={changing}>
          <div className="ico">
            <Icon name="key" size={20} />
          </div>
          <div className="main">
            <div className="t">Change password</div>
            <div className="s">Used to sign in to your account</div>
          </div>
          <Icon name={changing ? "up" : "down"} size={18} />
        </button>
        {changing && (
          <div className="acct-inline">
            <NewPassword ctx={ctx} intro="Choose a new password." onDone={() => setChanging(false)} />
          </div>
        )}
        <div className="row">
          <div className="ico">
            <Icon name="shield" size={20} />
          </div>
          <div className="main">
            <div className="t">Sync passphrase</div>
            <div className="s">Separate from your password. It encrypts your backup and can’t be recovered if lost.</div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <>
          <h2>Admin</h2>
          <div className="card">
            <button className="row rowbtn" onClick={() => window.location.assign("/admin")}>
              <div className="ico">
                <Icon name="shield" size={20} />
              </div>
              <div className="main">
                <div className="t">Admin dashboard</div>
                <div className="s">Read feedback and approve testimonials</div>
              </div>
              <Icon name="chevron" size={18} />
            </button>
          </div>
        </>
      )}

      <h2>Danger zone</h2>
      <div className="card acct-danger">
        {error && <p className="warnt" style={{ margin: "10px 0 0" }}>{error}</p>}
        {confirmDel ? (
          <div className="acct-inline" style={{ paddingTop: 14 }}>
            <p className="warnt">This permanently deletes your cloud backup. Data on this device isn’t touched.</p>
            <button
              className="btn danger"
              onClick={async () => {
                try {
                  await deleteSnapshot();
                  setLast(null);
                  setConfirmDel(false);
                  setError("");
                  ctx.toast("Cloud backup deleted.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Couldn’t delete it.");
                }
              }}
            >
              Yes, delete cloud backup
            </button>
            <button className="btn ghost" onClick={() => setConfirmDel(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="row rowbtn" onClick={() => setConfirmDel(true)} disabled={!last}>
            <div className="ico">
              <Icon name="trash" size={20} />
            </div>
            <div className="main">
              <div className="t">Delete cloud backup</div>
              <div className="s">Removes the copy stored online</div>
            </div>
          </button>
        )}
        {out ? (
          <div className="acct-inline" style={{ paddingTop: 14 }}>
            <p style={{ fontWeight: 800 }}>{out === "global" ? "Sign out of every device?" : "Sign out?"} What should happen to the data on this device?</p>
            {!(pass && sync.kind === "synced") && (
              <p className="warnt">
                Your latest changes may not be backed up yet{pass ? "" : " (sync is off)"}. Erasing now could lose them.
              </p>
            )}
            <button className="btn" onClick={() => finishSignOut(false)}>
              Keep my data on this device
            </button>
            <button className="btn danger" onClick={() => finishSignOut(true)}>
              Erase data from this device
            </button>
            <button className="btn ghost" onClick={() => setOut(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button className="row rowbtn" onClick={() => setOut("local")}>
              <div className="ico">
                <Icon name="logout" size={20} />
              </div>
              <div className="main">
                <div className="t">Sign out</div>
                <div className="s">Choose whether to keep your data on this device</div>
              </div>
            </button>
            <button className="row rowbtn" onClick={() => setOut("global")}>
              <div className="ico">
                <Icon name="logout" size={20} />
              </div>
              <div className="main">
                <div className="t">Sign out everywhere</div>
                <div className="s">Ends your session on every phone and browser. Use it if a device is lost.</div>
              </div>
            </button>
          </>
        )}
      </div>
    </>
  );
}
