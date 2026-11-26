"use client";

import { useEffect, useRef } from "react";

/** Cloudflare Turnstile site key (public by design). Leave it empty to run without a captcha. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const captchaOn = () => !!TURNSTILE_SITE_KEY;

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn’t load the security check."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * The "are you a person" check shown on the sign-in screen (Cloudflare Turnstile; usually it just passes by itself).
 * `onToken` gets a one-use token, or null when it expires or fails. Change `resetKey` after each attempt to get a fresh one,
 * because Supabase accepts each token only once.
 */
export default function Captcha({ onToken, resetKey }: { onToken: (t: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let id: string | undefined;
    let alive = true;
    cb.current(null);
    loadScript().then(
      () => {
        if (!alive || !box.current || !window.turnstile) return;
        id = window.turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "auto",
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      },
      () => cb.current(null),
    );
    return () => {
      alive = false;
      if (id) window.turnstile?.remove(id);
    };
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} style={{ minHeight: 65, display: "flex", justifyContent: "center" }} />;
}
