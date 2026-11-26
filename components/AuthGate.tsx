"use client";

import { ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { clearSessionMeta, ensureSessionMeta, getOwner, hasStoredLogin, loginRequired, sessionExpired, setOwner, storedUserId, touchSession } from "@/lib/session";
import { wipeLocalData } from "@/lib/store";
import { clearPassphrase } from "@/lib/sync";
import { applyThemeNow, themeFromMetadata } from "@/lib/themeSync";
import { RECOVERY_FLAG, RESET_DONE_FLAG } from "./Account";
import AuthScreen from "./AuthScreen";
import Icon from "./Icon";

type Gate = "loading" | "in" | "out" | "foreign";

/**
 * Shows the app only to a signed-in user. After the first sign-in the saved session lets the app
 * open and work offline, until the session rules in lib/session.ts say it's time to sign in again.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const required = loginRequired();
  const [gate, setGate] = useState<Gate>(required ? "loading" : "in");
  const [notice, setNotice] = useState("");
  /** Set when this device holds data that belongs to a different account than the one signing in. */
  const [foreign, setForeign] = useState<{ uid: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!required) return;
    const sb = getSupabase();
    if (!sb) return setGate("in");
    let alive = true;

    const apply = async (session: Session | null) => {
      if (!alive) return;
      if (!session) {
        clearSessionMeta();
        return setGate("out");
      }
      if (sessionExpired()) {
        clearSessionMeta();
        setNotice("For your security you were signed out. Please sign in again.");
        await sb.auth.signOut();
        return setGate("out");
      }
      // The first account to sign in on a device adopts the data already on it. A different account
      // must not see that data: it has to erase it first (or sign out).
      const owner = getOwner();
      if (owner && owner !== session.user.id) {
        setForeign({ uid: session.user.id, email: session.user.email ?? "this account" });
        return setGate("foreign");
      }
      if (!owner) setOwner(session.user.id);
      // Show the theme chosen on any of this account's devices, before the app and its data have loaded.
      const chosen = themeFromMetadata(session.user.user_metadata);
      if (chosen) applyThemeNow(chosen);
      ensureSessionMeta();
      touchSession();
      setNotice("");
      setGate("in");
    };

    sb.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => {
        // No connection to refresh the login: stay usable offline if a saved login exists and hasn't expired.
        if (!alive) return;
        const owner = getOwner();
        const uid = storedUserId();
        const sameDevice = !owner || !uid || owner === uid;
        if (hasStoredLogin() && !sessionExpired() && sameDevice) setGate("in");
        else setGate("out");
      });

    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        try {
          sessionStorage.setItem(RECOVERY_FLAG, "1");
        } catch {
          /* ignore */
        }
      }
      if (event === "SIGNED_OUT") {
        clearSessionMeta();
        clearPassphrase();
        try {
          if (sessionStorage.getItem(RESET_DONE_FLAG) === "1") {
            sessionStorage.removeItem(RESET_DONE_FLAG);
            setNotice("Password updated. Please sign in with your new password.");
          }
        } catch {
          /* ignore */
        }
        if (alive) setGate("out");
        return;
      }
      void apply(session);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [required]);

  // While signed in: note activity, and sign out if a limit passes while the app stays open.
  useEffect(() => {
    if (!required || gate !== "in") return;
    let lastTouch = 0;
    const touch = () => {
      const now = Date.now();
      if (now - lastTouch < 60_000) return;
      lastTouch = now;
      touchSession();
    };
    const check = () => {
      if (!sessionExpired()) return;
      clearSessionMeta();
      setNotice("For your security you were signed out. Please sign in again.");
      void getSupabase()?.auth.signOut();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        check();
        touch();
      }
    };
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, 5 * 60_000);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [required, gate]);

  if (gate === "in") return <>{children}</>;
  if (gate === "loading") return <div className="authwrap" aria-busy="true" />;

  if (gate === "foreign" && foreign) {
    return (
      <div className="authwrap">
        <div className="authbox">
          <div className="acct-hero">
            <div className="acct-avatar" aria-hidden="true">
              <Icon name="shield" size={34} />
            </div>
            <div className="acct-name">Different account</div>
            <p>This device has data from another Kwenta account. To keep each account’s data private, it has to be erased before {foreign.email} can use Kwenta here.</p>
          </div>
          <div className="card" style={{ marginTop: 12, padding: 16 }}>
            <div className="form" style={{ padding: 0 }}>
              <p className="sub">The other account’s data is safe if it was backed up to the cloud. Anything that wasn’t will be lost.</p>
              <button
                className="btn danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await wipeLocalData();
                  clearPassphrase();
                  setOwner(foreign.uid);
                  ensureSessionMeta();
                  touchSession();
                  setForeign(null);
                  setBusy(false);
                  setGate("in");
                }}
              >
                {busy ? "Erasing…" : "Erase this device and continue"}
              </button>
              <button
                className="btn ghost"
                disabled={busy}
                onClick={async () => {
                  clearSessionMeta();
                  await getSupabase()?.auth.signOut();
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="authwrap">
      <div className="authbox">
        <AuthScreen notice={notice} />
        <p className="sub" style={{ textAlign: "center", margin: "0 8px 24px" }}>
          You need a connection the first time you sign in.
        </p>
      </div>
    </div>
  );
}
