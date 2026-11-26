import { cloudConfigured } from "./supabase";

/**
 * Session rules for login mode. Supabase keeps you signed in with a refresh token; these rules
 * add an app-level limit on top, so a phone left behind doesn't stay signed in forever.
 * They live in this browser, so they protect against a forgotten device, not someone who can
 * already read this browser's storage. "Sign out everywhere" revokes the tokens server-side.
 */
export const INACTIVITY_DAYS = 14; // signed out after this long without opening the app
export const MAX_AGE_DAYS = 30; // signed out this long after signing in, even if used daily

const KEY = "kwenta-session";
const DAY = 86_400_000;

interface Meta {
  start: number;
  last: number;
}

/** Login is required whenever cloud is configured, unless NEXT_PUBLIC_REQUIRE_LOGIN=false (handy for local work). */
export const loginRequired = () => cloudConfigured() && process.env.NEXT_PUBLIC_REQUIRE_LOGIN !== "false";

function read(): Meta | null {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || "null");
    return m && typeof m.start === "number" && typeof m.last === "number" ? m : null;
  } catch {
    return null;
  }
}

function write(m: Meta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* storage unavailable */
  }
}

/** Starts the clock for a new sign-in, unless one is already running. */
export function ensureSessionMeta() {
  if (!read()) write({ start: Date.now(), last: Date.now() });
}

/** Records that the app is being used right now. */
export function touchSession() {
  const m = read();
  if (m) write({ ...m, last: Date.now() });
}

export function clearSessionMeta() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** True when the inactivity or maximum-age limit has passed. No clock yet means not expired. */
export function sessionExpired(now = Date.now()): boolean {
  const m = read();
  if (!m) return false;
  return now - m.last > INACTIVITY_DAYS * DAY || now - m.start > MAX_AGE_DAYS * DAY;
}

/** Whether Supabase left a saved login in this browser (used to stay usable offline). */
export function hasStoredLogin(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/* ---------- Which account owns the data on this device ---------- */

const OWNER = "kwenta-owner";

export function getOwner(): string | null {
  try {
    return localStorage.getItem(OWNER);
  } catch {
    return null;
  }
}
export function setOwner(uid: string) {
  try {
    localStorage.setItem(OWNER, uid);
  } catch {
    /* ignore */
  }
}
export function clearOwner() {
  try {
    localStorage.removeItem(OWNER);
  } catch {
    /* ignore */
  }
}

/** The user id inside Supabase's saved login, readable offline. */
export function storedUserId(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) {
        const id = JSON.parse(localStorage.getItem(k) || "null")?.user?.id;
        return typeof id === "string" ? id : null;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
