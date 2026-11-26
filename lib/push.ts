"use client";

import { useEffect, useRef } from "react";
import type { State } from "./types";
import { wakeTimes } from "./reminders";
import { cloudConfigured, getSupabase } from "./supabase";

/**
 * Push reminders: the phone asks the browser for a push address and tells Supabase (a) that address and (b) the
 * times it wants waking (wakeTimes in lib/reminders.ts). A scheduled function sends an empty push at those times and
 * the service worker builds the notification from the list saved on the phone. The server never learns what is due.
 * Setup: scripts/push.sql, supabase/functions/send-reminders and the README ("Push reminders").
 */

const DEVICE_KEY = "kwenta-push-device";
// Inlined at build time (NEXT_PUBLIC_*). Without it the feature stays hidden.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushStatus = "unconfigured" | "ios-install" | "unsupported" | "blocked" | "off" | "on";

const isIOS = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const storedDevice = () => {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
};
const storeDevice = (id: string | null) => {
  try {
    if (id) localStorage.setItem(DEVICE_KEY, id);
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* ignore */
  }
};

/** Whether push reminders are set up on the server side and in this build. */
export const pushConfigured = () => !!VAPID_PUBLIC_KEY && cloudConfigured();

/** What this device can do right now, for the Settings screen. */
export async function pushStatus(): Promise<PushStatus> {
  if (!pushConfigured()) return "unconfigured";
  // iPhone only allows push for an app added to the Home Screen.
  if (isIOS() && !isStandalone()) return "ios-install";
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted" || !storedDevice()) return "off";
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ? "on" : "off";
}

function keyBytes(base64Url: string): BufferSource {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Saves this phone's push address with the server and returns the device id. */
async function register(sub: PushSubscription): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud sync isn’t set up.");
  const json = sub.toJSON();
  const { data, error } = await sb.rpc("register_push_device", { p_endpoint: sub.endpoint, p_p256dh: json.keys?.p256dh ?? "", p_auth: json.keys?.auth ?? "" });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Sends the upcoming wake-up times (only times) to the server, replacing the old ones. */
async function uploadWakes(device: string, state: State) {
  const sb = getSupabase();
  if (!sb) return;
  const times = wakeTimes(state).map((t) => new Date(t).toISOString());
  const { error } = await sb.rpc("set_push_wakes", { p_device: device, p_times: times });
  if (error) throw new Error(error.message);
}

export async function enablePush(state: State): Promise<{ ok: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: "Cloud sync isn’t set up." };
  const { data } = await sb.auth.getSession();
  if (!data.session) return { ok: false, message: "Sign in first (Settings → Account), so reminders can find this phone." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, message: "Notifications are blocked. Allow them for Kwenta in your phone’s settings." };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    const id = await register(sub);
    storeDevice(id);
    await uploadWakes(id, state);
    return { ok: true, message: "Push reminders are on for this device." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn’t turn on push reminders." };
  }
}

export async function disablePush(): Promise<void> {
  const id = storedDevice();
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    /* ignore */
  }
  const sb = getSupabase();
  if (sb && id) await sb.from("push_devices").delete().eq("id", id); // wakes go with it
  storeDevice(null);
}

/**
 * Keeps the server's wake-up times current while the app is open: after anything that changes what is due
 * (logging, paying, snoozing, confirming a statement) and once a day. Does nothing unless push is turned on here.
 */
export function usePushSync(state: State, active: boolean) {
  const last = useRef("");
  const refreshed = useRef(false);
  useEffect(() => {
    if (!active || !pushConfigured() || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const id = storedDevice();
    if (!id) return;
    const times = wakeTimes(state);
    const key = `${id}|${times.join(",")}`;
    if (key === last.current) return;
    const timer = setTimeout(async () => {
      try {
        // Once per visit, refresh the saved push address too (browsers occasionally change it).
        if (!refreshed.current) {
          refreshed.current = true;
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = await reg?.pushManager.getSubscription();
          if (sub) storeDevice(await register(sub));
          else return;
        }
        await uploadWakes(storedDevice() ?? id, state);
        last.current = key;
      } catch {
        /* offline or signed out: try again on the next change */
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [state, active]);
}
