"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKwenta } from "@/lib/store";
import { fmtIn, setBaseCurrency, setHideAmounts } from "@/lib/format";
import { setCustomCategories } from "@/lib/categories";
import type { Ctx, Overlay, PlanTab, Tab } from "@/lib/ui";
import Home from "@/components/Home";
import Wallet from "@/components/Wallet";
import Plan from "@/components/Plan";
import History from "@/components/History";
import Stats from "@/components/Stats";
import Chat from "@/components/Chat";
import AddTx from "@/components/AddTx";
import Settings from "@/components/Settings";
import Streak from "@/components/Streak";
import Icon from "@/components/Icon";
import LockScreen from "@/components/LockScreen";
import Recap from "@/components/Recap";
import Splash from "@/components/Splash";
import AuthGate from "@/components/AuthGate";
import SyncSetup from "@/components/SyncSetup";
import PinRequired from "@/components/PinRequired";
import { hasPaid, STATS_PAID, useAccess } from "@/lib/plans";
import ProGate from "@/components/ProGate";
import { Modal } from "@/components/Sheet";
import { usePassphrase, useAutoSync, useSetupSkipped, setPassphrase } from "@/lib/sync";
import { loginRequired } from "@/lib/session";
import { passphraseWorks } from "@/lib/cloud";
import { pullTheme, pushTheme } from "@/lib/themeSync";
import { applyLook } from "@/lib/themes";
import OfflineBar from "@/components/OfflineBar";
import Onboarding from "@/components/Onboarding";
import { accountOnboarded } from "@/lib/onboarded";
import { reminderPayload, saveReminderData } from "@/lib/reminders";
import { usePushSync } from "@/lib/push";
import { useNativeReminders } from "@/lib/nativeReminders";
import { cleanupPhotos } from "@/lib/photos";
import { lookOf } from "@/lib/closet";
import ClosetSheet from "@/components/ClosetSheet";
import { EmojiText } from "@/components/Emoji";
import Notifications from "@/components/Notifications";
import { addNotices, newBadgeNotices } from "@/lib/notices";

interface ToastMsg {
  msg: string;
  undo?: () => void;
  id: number;
}

const NAV: { id: Tab; icon: string; label: string }[] = [
  { id: "home", icon: "home", label: "Home" },
  { id: "wallet", icon: "wallet", label: "Wallet" },
  { id: "plan", icon: "plan", label: "Plan" },
  { id: "history", icon: "history", label: "History" },
];

/** The sign-in gate comes first (it also starts the cloud client, so magic-link and reset links become sessions). */
export default function Page() {
  return (
    <AuthGate>
      <App />
    </AuthGate>
  );
}

function App() {
  const k = useKwenta();
  // Encrypted auto-sync: runs only while signed in, a sync passphrase is set, and the app is unlocked.
  // Saving to the cloud is a paid feature (admins are exempt); everything else works for free.
  const access = useAccess();
  useAutoSync(k.state, k.ready && !k.locked && access.active);
  // Push reminders (only if turned on for this device): keeps the server's wake-up times current.
  usePushSync(k.state, k.ready && !k.locked);
  // Inside the Android app, the phone itself shows the reminders: keep what is scheduled there current.
  useNativeReminders(k.state, k.ready && !k.locked);
  // Arrived from a password-reset link (the gate flagged it): open Settings → Account to set a new password.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("kwenta-recovery") === "1") setOverlay({ kind: "settings" });
    } catch {
      /* ignore */
    }
  }, []);
  // The account remembers the chosen theme: adopt it once per launch, then keep the account up to date.
  const [themePulled, setThemePulled] = useState(false);
  const { updateSettings } = k;
  const themeNow = k.state.settings.theme;
  const paletteNow = k.state.settings.palette || "forest";
  const customNow = paletteNow === "custom" ? k.state.settings.customColor : undefined;
  useEffect(() => {
    if (!loginRequired() || !k.ready || k.locked || themePulled) return;
    let alive = true;
    void pullTheme().then((t) => {
      if (!alive) return;
      if (t && (t.theme !== themeNow || t.palette !== paletteNow || t.custom !== customNow)) updateSettings({ theme: t.theme, palette: t.palette, customColor: t.custom ?? k.state.settings.customColor });
      setThemePulled(true);
    });
    return () => {
      alive = false;
    };
    // Only once per launch: later choices are made here and pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.ready, k.locked, themePulled]);
  useEffect(() => {
    if (!loginRequired() || !k.ready || k.locked || !themePulled) return;
    const t = setTimeout(() => void pushTheme({ theme: themeNow, palette: paletteNow, custom: customNow }), 1500);
    return () => clearTimeout(t);
  }, [k.ready, k.locked, themePulled, themeNow, paletteNow, customNow]);
  // Totals everywhere use the main currency from Settings.
  setBaseCurrency(k.state.settings.currency);
  setHideAmounts(k.state.settings.hideAmounts);
  setCustomCategories(k.state.customCats);
  const [tab, setTab] = useState<Tab>("home");
  const [planTab, setPlanTab] = useState<PlanTab>("budgets");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  // Opening animation: once per app launch (a new session), not on every tab switch.
  const [splash, setSplash] = useState(true);
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("kwenta-opened")) setSplash(false);
      else sessionStorage.setItem("kwenta-opened", "1");
    } catch {
      /* storage blocked: just play it */
    }
  }, []);
  const startEntering = useCallback(() => {
    setEntering(true);
    setTimeout(() => setEntering(false), 1200);
  }, []);
  const endSplash = useCallback(() => setSplash(false), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // One combined key keeps the dependency list a fixed size.
  const look = k.locked ? "locked" : `${k.state.settings.theme}|${k.state.settings.palette || "forest"}|${k.state.settings.customColor ?? ""}`;
  useEffect(() => {
    if (look === "locked") return; // keep the colors applied from saved prefs
    const [theme, palette, custom] = look.split("|");
    applyLook(theme, palette, custom);
  }, [look]);

  // First run: brand-new users (nothing saved yet) get the get-started flow. Once it opens it stays
  // open until finished, even though adding the first account (step 4) makes the app non-empty.
  // Signed in without a sync passphrase this session: restore or create a backup first, so a new
  // phone restores from the cloud instead of starting the get-started flow.
  const syncPass = usePassphrase();
  // A remembered passphrase unlocks sync by itself. Wait for that check before showing the passphrase screen.
  const [recallDone, setRecallDone] = useState(false);
  const { recallSyncPass, rememberSyncPass } = k;
  useEffect(() => {
    if (!loginRequired() || !k.ready || k.locked || recallDone) return;
    let alive = true;
    void recallSyncPass()
      .then(async (p) => {
        if (!p || !alive) return;
        // Make sure it still opens the cloud backup (it may have been changed on another device).
        // If we can't check because we're offline, trust it; sync will verify when it reconnects.
        const ok = await passphraseWorks(p).catch(() => true);
        if (!alive) return;
        if (ok) setPassphrase(p);
        else void rememberSyncPass(null);
      })
      .finally(() => alive && setRecallDone(true));
    return () => {
      alive = false;
    };
  }, [k.ready, k.locked, recallDone, recallSyncPass, rememberSyncPass]);
  const setupDone = useSetupSkipped();
  const needsSetup = loginRequired() && k.ready && !k.locked && recallDone && !syncPass && !setupDone;
  // Login mode offers a PIN once (optional). "Not now" is remembered on this device; Settings can still turn it on.
  const [pinSkipped, setPinSkipped] = useState(() => {
    try {
      return localStorage.getItem("kwenta-pin-skip") === "1";
    } catch {
      return false;
    }
  });
  const needsPin = loginRequired() && k.ready && !k.locked && !k.lockOn && !needsSetup && !pinSkipped;
  // Has this account already done setup on another device? (null = still checking: don't flash "Get started" meanwhile.)
  const [acctDone, setAcctDone] = useState<boolean | null>(null);
  const emptyHere = k.ready && !k.locked && !k.state.settings.onboarded && k.state.accounts.length === 0 && k.state.txs.length === 0;
  useEffect(() => {
    if (!emptyHere || acctDone !== null) return;
    let alive = true;
    void accountOnboarded().then((d) => alive && setAcctDone(d));
    return () => {
      alive = false;
    };
  }, [emptyHere, acctDone]);
  // An existing account on a new device: skip "Get started" and remember it here, so it never asks again.
  useEffect(() => {
    if (emptyHere && acctDone === true) k.updateSettings({ onboarded: true });
  }, [emptyHere, acctDone, k]);
  const needsOnboarding = emptyHere && !needsSetup && !needsPin && acctDone === false;
  const [onboarding, setOnboarding] = useState(false);
  useEffect(() => {
    if (needsOnboarding) setOnboarding(true);
  }, [needsOnboarding]);

  // Once per launch, delete receipt photos no longer attached to any entry.
  const photosCleaned = useRef(false);
  useEffect(() => {
    if (!k.ready || k.locked || photosCleaned.current) return;
    photosCleaned.current = true;
    void cleanupPhotos(new Set(k.state.txs.map((t) => t.photo).filter(Boolean) as string[]));
  }, [k.ready, k.locked, k.state.txs]);

  // Keep the small reminder list (titles + dates, no amounts) fresh for the background check.
  const remindersOn = !!k.state.settings.reminders?.enabled;
  useEffect(() => {
    if (!k.ready || k.locked || !remindersOn) return;
    const t = setTimeout(() => void saveReminderData(reminderPayload(k.state)).catch(() => undefined), 800);
    return () => clearTimeout(t);
  }, [k.ready, k.locked, remindersOn, k.state]);

  // Phone status bar color: match the header on main tabs, the page background on full-screen panels.
  const barVar = k.locked || onboarding || (overlay && overlay.kind !== "recap") ? "--bg" : "--band";
  useEffect(() => {
    const sync = () => syncSystemBar(barVar);
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [barVar, look]);

  // Auto-lock after time in the background, and blur content in the app switcher.
  const { lockOn, lock } = k;
  const autoLock = k.state.settings.autoLock ?? 1;
  useEffect(() => {
    if (!lockOn) return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        document.body.classList.add("privacy-hide");
      } else {
        document.body.classList.remove("privacy-hide");
        if (hiddenAt && Date.now() - hiddenAt >= autoLock * 60_000) {
          setOverlay(null);
          lock();
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.body.classList.remove("privacy-hide");
    };
  }, [lockOn, lock, autoLock]);

  const close = useCallback(() => setOverlay(null), []);
  const ctx: Ctx = useMemo(
    () => ({
      k,
      toast: (msg, undo) => setToast({ msg, undo, id: Date.now() }),
      open: setOverlay,
      close,
      access,
      goTab: (t, p) => {
        setOverlay(null);
        setTab(t);
        if (p) setPlanTab(p);
        window.scrollTo(0, 0);
      },
    }),
    [k, close, access],
  );

  // Savings interest: post whatever has come due when the app opens and each time it comes back into view.
  const { postInterest } = k;
  useEffect(() => {
    if (!k.ready || k.locked) return;
    const run = () => {
      const added = postInterest();
      if (!added.length) return;
      const accs = new Set(added.map((x) => x.acc)).size;
      ctx.toast(accs === 1 ? `Interest added: ${fmtIn(added.reduce((s, x) => s + x.amount, 0), added[0].currency)} to ${added[0].name}` : `Interest added to ${accs} accounts`);
    };
    run();
    const onVis = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // ctx.toast only calls a stable state setter, so it needn't restart this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.ready, k.locked, postInterest]);

  // Badges: announce each newly earned one once (toast + Notifications list, and a phone notification if allowed).
  const { updateSettings: saveSettings } = k;
  const noticeState = k.state;
  useEffect(() => {
    if (!k.ready || k.locked || needsOnboarding) return;
    const found = newBadgeNotices(noticeState);
    if (!found) return;
    saveSettings({ badgesSeen: found.seen, notices: addNotices(noticeState.settings.notices, found.notices) });
    const names = found.notices.map((n) => n.title.replace("New badge: ", ""));
    const msg = names.length === 1 ? `${found.notices[0].icon} New badge: ${names[0]}!` : `🏆 ${names.length} new badges: ${names.join(", ")}`;
    ctx.toast(msg);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      void navigator.serviceWorker
        ?.getRegistration()
        .then((reg) => reg?.showNotification("Kwenta", { body: msg, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "kwenta-badge" }))
        .catch(() => undefined);
    }
    // ctx.toast only calls a stable state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.ready, k.locked, needsOnboarding, noticeState, saveSettings]);

  const pinEl = needsPin ? (
    <PinRequired
      ctx={ctx}
      onSkip={() => {
        try {
          localStorage.setItem("kwenta-pin-skip", "1");
        } catch {
          /* ignore */
        }
        setPinSkipped(true);
      }}
    />
  ) : null;
  const syncEl = needsSetup ? <SyncSetup ctx={ctx} onDone={() => undefined} /> : null;
  const splashEl = splash ? <Splash look={k.ready && !k.locked ? lookOf(k.state.settings) : undefined} onLeave={startEntering} onDone={endSplash} /> : null;

  if (k.ready && k.locked) {
    return (
      <>
        <LockScreen onUnlock={k.unlock} onErase={k.eraseEverything} />
        {splashEl}
      </>
    );
  }

  return (
    <>
      {splashEl}
      {syncEl}
      {pinEl}
      <OfflineBar />
      {onboarding && (
        <Onboarding
          ctx={ctx}
          onFinish={(openSettings) => {
            setOnboarding(false);
            window.scrollTo(0, 0);
            if (openSettings) setOverlay({ kind: "settings" });
          }}
        />
      )}
      <main key={tab} className={`app tab-${tab}${entering ? " entering" : ""}`}>
        {!k.ready ? (
          <div className="loadingcard" role="status" aria-live="polite">
            <span className="loadingdot" aria-hidden="true" /> Opening your Kwenta…
          </div>
        ) : tab === "home" ? (
          <Home ctx={ctx} />
        ) : tab === "wallet" ? (
          <Wallet ctx={ctx} />
        ) : tab === "plan" ? (
          <Plan ctx={ctx} tab={planTab} setTab={setPlanTab} />
        ) : (
          <History ctx={ctx} />
        )}
      </main>

      {k.ready && overlay?.kind === "stats" && (STATS_PAID && !hasPaid(access) ? <Modal title="Statistics" onClose={close}><ProGate ctx={ctx} what="Statistics and charts" /></Modal> : <Stats ctx={ctx} />)}
      {k.ready && overlay?.kind === "chat" && <Chat ctx={ctx} />}
      {k.ready && overlay?.kind === "add" && <AddTx ctx={ctx} initialType={overlay.type} initialAcc={overlay.acc} edit={overlay.edit} autoScan={overlay.scan} key={overlay.edit?.id ?? "new"} />}
      {k.ready && overlay?.kind === "settings" && <Settings ctx={ctx} />}
      {k.ready && overlay?.kind === "streak" && <Streak ctx={ctx} />}
      {k.ready && overlay?.kind === "recap" && <Recap ctx={ctx} y={overlay.y} m={overlay.m} />}
      {k.ready && overlay?.kind === "closet" && <ClosetSheet ctx={ctx} />}
      {k.ready && overlay?.kind === "notifications" && <Notifications ctx={ctx} />}

      {toast && (
        <div id="toast" className="show" role="status" aria-live="polite" key={toast.id}>
          <span className="tbadge" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
          <span className="tmsg">
            <EmojiText text={toast.msg} />
          </span>
          {toast.undo && (
            <button
              className="tundo"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
          <button className="tclose" onClick={() => setToast(null)} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
          <span className="tbar" aria-hidden="true" />
        </div>
      )}

      {!overlay && (
        <nav aria-label="Main">
          <div className="navin">
            {NAV.slice(0, 2).map((n) => (
              <NavBtn key={n.id} n={n} active={tab === n.id} onClick={() => ctx.goTab(n.id)} />
            ))}
            <button className="fab" onClick={() => setOverlay({ kind: "add", type: "expense" })} aria-label="Add transaction">
              <Icon name="plus" size={28} stroke={2.5} />
            </button>
            {NAV.slice(2).map((n) => (
              <NavBtn key={n.id} n={n} active={tab === n.id} onClick={() => ctx.goTab(n.id)} />
            ))}
          </div>
        </nav>
      )}
    </>
  );
}

function NavBtn({ n, active, onClick }: { n: (typeof NAV)[number]; active: boolean; onClick: () => void }) {
  return (
    <button className="navbtn" aria-current={active ? "page" : undefined} onClick={onClick}>
      <Icon name={n.icon} size={22} />
      {n.label}
    </button>
  );
}

/** Turns "rgb(90, 37, 55)" or "color(srgb 0.1 0.09 0.1)" into "#5a2537", which every phone understands. */
function toHex(color: string): string | null {
  const rgb = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  const srgb = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  const parts = rgb ? rgb.slice(1, 4).map(Number) : srgb ? srgb.slice(1, 4).map((v) => Number(v) * 255) : null;
  if (!parts) return null;
  return "#" + parts.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

/** Sets <meta name="theme-color"> (the phone's status bar) to a CSS color variable's real value. */
function syncSystemBar(cssVar: string) {
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;color:var(${cssVar})`;
  document.body.appendChild(probe);
  const color = toHex(getComputedStyle(probe).color);
  probe.remove();
  if (!color) return;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const m = document.createElement("meta");
    m.setAttribute("name", "theme-color");
    document.head.appendChild(m);
    m.setAttribute("content", color);
  }
  metas.forEach((m) => m.setAttribute("content", color));
}
