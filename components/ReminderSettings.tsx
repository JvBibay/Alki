"use client";

import { useEffect, useState } from "react";
import type { Ctx } from "@/lib/ui";
import { disablePush, enablePush, pushStatus, type PushStatus } from "@/lib/push";
import { CARD_LEADS, cardLead, disableReminders, dueSoon, enableReminders, reminderSupport, testNotification, whenText, type ReminderSupport } from "@/lib/reminders";

/** Settings → Reminders: daily background notifications (Android) with a test button. */
export default function ReminderSettings({ ctx }: { ctx: Ctx }) {
  const { k, toast } = ctx;
  const r = k.state.settings.reminders ?? { enabled: false, names: !k.lockOn, logNudge: true };
  const [support, setSupport] = useState<ReminderSupport | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [push, setPush] = useState<PushStatus | null>(null);
  // Inside the Kwenta Android app (a Capacitor web view) there is no Notification or Push API at all.
  const [shell, setShell] = useState(false);
  const perm = typeof Notification !== "undefined" ? Notification.permission : "default";
  // A saved "on" means nothing where notifications can't be shown, so don't claim it.
  const working = r.enabled && support !== "none";
  const shellHelp = "The Kwenta Android app can’t show phone notifications. Open Kwenta in Chrome and choose Add to Home screen (Install app) there, then turn reminders on. You’ll still see “Due soon” on Home.";

  useEffect(() => {
    setShell(!!(window as unknown as { Capacitor?: unknown }).Capacitor);
    void reminderSupport().then(setSupport);
    void pushStatus().then(setPush);
  }, []);

  async function togglePush(on: boolean) {
    setBusy(true);
    if (on) {
      const res = await enablePush(k.state);
      toast(res.message);
    } else {
      await disablePush();
      toast("Push reminders turned off for this device.");
    }
    setPush(await pushStatus());
    setBusy(false);
  }

  async function toggle(on: boolean) {
    setBusy(true);
    if (on) {
      const res = await enableReminders();
      setNote(res.message);
      if (res.ok) k.updateSettings({ reminders: { ...r, enabled: true } });
      toast(res.message);
    } else {
      await disableReminders();
      k.updateSettings({ reminders: { ...r, enabled: false } });
      setNote("");
      toast("Daily reminders turned off.");
    }
    setBusy(false);
  }

  async function test() {
    const next = dueSoon(k.state, Date.now(), 7)[0];
    try {
      await testNotification(next ? `${r.names ? next.title : "A payment"}: ${whenText(next.daysLeft).toLowerCase()}` : "This is how your reminders will look. 🪙");
      toast("Test notification sent.");
    } catch {
      toast("Couldn’t show a notification. Check that notifications are allowed for Kwenta.");
    }
  }

  return (
    <div className="card securitycard">
      <div className="status">
        <span aria-hidden="true">{working ? "🔔" : "🔕"}</span>
        {working ? "Daily reminders are on" : support === "none" && r.enabled ? "Daily reminders can’t run here" : "Daily reminders are off"}
      </div>
      <p className="sub">
        Get a notification when a bill or installment is due today or tomorrow, plus an evening nudge if you haven’t logged anything. Chrome checks about once a day
        (it picks the exact time).
      </p>
      {support === "notify-only" && (
        <p className="sub warnt">This browser can’t check in the background. Reminders work best when Kwenta is installed from Chrome on Android. You’ll still see “Due soon” on Home.</p>
      )}
      {support === "none" && <p className="sub warnt">{shell ? shellHelp : "This browser doesn’t support notifications. You’ll still see “Due soon” on Home."}</p>}
      {perm === "denied" && <p className="sub warnt">Notifications are blocked for Kwenta. Allow them in your phone’s app or site settings.</p>}

      <div className="formrow">
        <button className="btn sm" disabled={busy || (support === "none" && !r.enabled)} onClick={() => void toggle(!r.enabled)}>
          {busy ? "Working…" : r.enabled ? "Turn off" : "Turn on reminders"}
        </button>
        {r.enabled && perm === "granted" && (
          <button className="btn ghost sm" onClick={() => void test()}>
            Send a test
          </button>
        )}
      </div>
      {note && <p className="sub">{note}</p>}

      <label className="sub" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span>Warn me about credit card payments</span>
        <select value={cardLead(k.state)} onChange={(e) => k.updateSettings({ reminders: { ...r, cardLead: Number(e.target.value) } })} aria-label="Days before a credit card payment is due">
          {CARD_LEADS.map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "1 day before" : `${n} days before`}
            </option>
          ))}
        </select>
      </label>

      {push && push !== "unconfigured" && (
        <div className="pushbox">
          <div className="status">
            <span aria-hidden="true">{push === "on" ? "📲" : "📵"}</span>
            {push === "on" ? "Push reminders are on for this device" : "Push reminders (iPhone, desktop and Android)"}
          </div>
          {push === "ios-install" && (
            <p className="sub">
              On iPhone, first tap <b>Share</b> → <b>Add to Home Screen</b>, then open Kwenta from the Home Screen and come back here. Safari tabs can’t receive push reminders.
            </p>
          )}
          {push === "unsupported" && <p className="sub warnt">{shell ? shellHelp : "This browser can’t receive push reminders. You’ll still see “Due soon” on Home."}</p>}
          {push === "blocked" && <p className="sub warnt">Notifications are blocked for Kwenta. Allow them in your phone’s or browser’s site settings, then try again.</p>}
          {(push === "off" || push === "on") && (
            <>
              <p className="sub">
                Kwenta’s server only learns <b>when</b> to nudge this device, never what is due or how much. The text of each reminder comes from your phone. Needs
                cloud sign-in.
              </p>
              <div className="formrow">
                <button className="btn sm" disabled={busy} onClick={() => void togglePush(push !== "on")}>
                  {busy ? "Working…" : push === "on" ? "Turn off" : "Turn on push reminders"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {r.enabled && (
        <>
          <label className="check">
            <input type="checkbox" checked={r.logNudge} onChange={(e) => k.updateSettings({ reminders: { ...r, logNudge: e.target.checked } })} />
            <span>Evening nudge if I haven’t logged anything today</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={!r.names} onChange={(e) => k.updateSettings({ reminders: { ...r, names: !e.target.checked } })} />
            <span>Hide bill names in notifications (shows “A bill is due” instead){k.lockOn ? ". Recommended with the PIN lock." : ""}</span>
          </label>
        </>
      )}
    </div>
  );
}
