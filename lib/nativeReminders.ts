/**
 * Reminders inside the Kwenta Android app.
 *
 * The Android app is a Capacitor shell around the website, and its web view has no Notification or Push API, so the
 * browser reminders can't run there. Instead the app asks Android itself to show the notifications, using the
 * Local Notifications plugin: Kwenta works out what is due, schedules the next few days of reminders on the phone,
 * and Android shows them at the right time even when Kwenta is closed. Nothing goes through a server.
 *
 * The page is loaded from the website, so the plugin is reached through the bridge Capacitor injects
 * (window.Capacitor.nativePromise), not by bundling Capacitor's JavaScript.
 */
import { useEffect, useRef } from "react";
import type { State } from "./types";
import { addDays, startOfDay } from "./stats";
import { dueNotification, NUDGE_NOTICE, reminderPayload, WAKE_DAYS, WAKE_HOUR } from "./reminders";

/** Evening "you haven't logged anything" nudge: local time, and only the next few evenings (opening the app refreshes it). */
export const NUDGE_HOUR = 20;
export const NUDGE_DAYS = 3;

/** Notification ids: one per day for bills, one per day for the nudge, one for the test button. */
export const DUE_ID = 1000;
export const NUDGE_ID = 2000;
export const TEST_ID = 9999;
export const CHANNEL = "kwenta-reminders";

export interface PlannedNotice {
  id: number;
  /** When Android should show it (ms). */
  at: number;
  title: string;
  body: string;
}

const atHour = (day: number, hour: number) => {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

/**
 * The reminders to have scheduled on the phone right now: for each of the next days at 9:00, what is due that day
 * (snoozes applied per day), plus the evening nudge for the next few days. Empty when reminders are off.
 */
export function planNativeReminders(state: State, now = Date.now()): PlannedNotice[] {
  const r = state.settings.reminders;
  if (!r?.enabled) return [];
  const payload = reminderPayload(state, now);
  const today = startOfDay(now);
  const out: PlannedNotice[] = [];
  for (let i = 0; i < WAKE_DAYS; i++) {
    const day = addDays(today, i);
    const at = atHour(day, WAKE_HOUR);
    if (at > now + 60_000) {
      const n = dueNotification(payload, day);
      if (n) out.push({ id: DUE_ID + i, at, ...n });
    }
    if (i < NUDGE_DAYS && payload.logNudge && payload.lastLog > 0) {
      const nudgeAt = atHour(day, NUDGE_HOUR);
      // Today's nudge is skipped once something has been logged today.
      const loggedToday = i === 0 && startOfDay(payload.lastLog) >= day;
      if (nudgeAt > now + 60_000 && !loggedToday) out.push({ id: NUDGE_ID + i, at: nudgeAt, ...NUDGE_NOTICE });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------- The bridge to the Android plugin ----------

type Bridge = {
  PluginHeaders?: { name: string }[];
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
};
const bridge = (): Bridge | undefined => (typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: Bridge }).Capacitor);

/** True inside the Kwenta Android app (even an older build that lacks the notifications plugin). */
export const inAndroidApp = () => typeof bridge()?.nativePromise === "function";

/** True when this build of the Android app includes the notifications plugin. */
export const nativeRemindersAvailable = () => inAndroidApp() && !!bridge()?.PluginHeaders?.some((h) => h.name === "LocalNotifications");

const call = <T>(method: string, options?: unknown) => bridge()!.nativePromise!("LocalNotifications", method, options) as Promise<T>;

export type NativePermission = "granted" | "denied" | "prompt";
const toPermission = (display: string | undefined): NativePermission => (display === "granted" ? "granted" : display === "denied" ? "denied" : "prompt");

export async function nativePermission(): Promise<NativePermission> {
  try {
    return toPermission((await call<{ display?: string }>("checkPermissions")).display);
  } catch {
    return "prompt";
  }
}

/** Shows Android's "allow notifications?" prompt (Android 13+; older versions are always allowed). */
export async function requestNativePermission(): Promise<NativePermission> {
  try {
    return toPermission((await call<{ display?: string }>("requestPermissions")).display);
  } catch {
    return "denied";
  }
}

async function ensureChannel() {
  // Android 8+ shows notifications only through a channel; creating it again is harmless.
  await call("createChannel", { id: CHANNEL, name: "Reminders", description: "Bills, installments and card payments that are due", importance: 4, visibility: 1, vibration: true });
}

const toNative = (p: PlannedNotice) => ({
  id: p.id,
  title: p.title,
  body: p.body,
  // Lets a list of several bills show in full instead of being cut to one line.
  largeBody: p.body,
  schedule: { at: new Date(p.at).toISOString(), allowWhileIdle: true },
  channelId: CHANNEL,
  smallIcon: "ic_stat_kwenta",
  iconColor: "#2F7A4D",
});

/** Cancels everything Kwenta has scheduled on the phone. */
export async function cancelNativeReminders() {
  if (!nativeRemindersAvailable()) return;
  const { notifications } = await call<{ notifications?: { id: number }[] }>("getPending");
  if (notifications?.length) await call("cancel", { notifications: notifications.map((n) => ({ id: n.id })) });
}

/** Replaces what is scheduled on the phone with the current plan. Returns how many reminders are now scheduled. */
export async function syncNativeReminders(state: State, now = Date.now()): Promise<number> {
  if (!nativeRemindersAvailable()) return 0;
  await cancelNativeReminders();
  const plan = planNativeReminders(state, now);
  if (!plan.length) return 0;
  await ensureChannel();
  await call("schedule", { notifications: plan.map(toNative) });
  return plan.length;
}

/** A notification in a couple of seconds, to check that reminders can reach you. */
export async function sendNativeTest(body: string) {
  await ensureChannel();
  await call("schedule", { notifications: [toNative({ id: TEST_ID, at: Date.now() + 2000, title: "Kwenta reminder", body })] });
}

/**
 * Keeps the phone's scheduled reminders current while the app is open: after anything that changes what is due
 * (logging, paying, snoozing) and when it opens. Does nothing unless reminders are on and Android allows notifications.
 */
export function useNativeReminders(state: State, active: boolean) {
  const last = useRef("");
  useEffect(() => {
    if (!active || !nativeRemindersAvailable()) return;
    const plan = planNativeReminders(state);
    const key = JSON.stringify(plan.map((p) => [p.id, p.at, p.title, p.body]));
    if (key === last.current) return;
    const timer = setTimeout(async () => {
      try {
        if (state.settings.reminders?.enabled && (await nativePermission()) !== "granted") return;
        await syncNativeReminders(state);
        last.current = key;
      } catch {
        /* try again on the next change */
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [state, active]);
}
