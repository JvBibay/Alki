import { useEffect, useState } from "react";

/** Chrome on Android offers a one-tap install; the browser sends this event once and we keep it. */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export type Platform = "android" | "ios" | "other";

export function detectPlatform(ua = typeof navigator !== "undefined" ? navigator.userAgent : "", maxTouch = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0): Platform {
  if (/android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac, but it has a touch screen.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouch > 1)) return "ios";
  return "other";
}

/** Already opened from the Home Screen (installed), so the guide isn't needed. */
export const isInstalled = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** Whether a one-tap install is available right now, and a function to run it. */
export function useInstallPrompt(): { canPrompt: boolean; install: () => Promise<void> } {
  const [, setN] = useState(0);
  useEffect(() => {
    const l = () => setN((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    canPrompt: !!deferred,
    install: async () => {
      const p = deferred;
      if (!p) return;
      await p.prompt();
      await p.userChoice.catch(() => undefined);
      deferred = null;
      listeners.forEach((l) => l());
    },
  };
}
