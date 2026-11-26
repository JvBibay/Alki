"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { State } from "./types";
import { ConflictError, currentUserId, pushSnapshot } from "./cloud";
import { getSupabase } from "./supabase";

/* ---------- Sync passphrase: kept for this browser session only ---------- */

const SP = "kwenta-sp";
const DEBOUNCE_MS = 5000;
const RETRY_MS = 30_000;

let passMem: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function getPassphrase(): string | null {
  if (passMem) return passMem;
  try {
    passMem = sessionStorage.getItem(SP);
  } catch {
    /* ignore */
  }
  return passMem;
}

export function setPassphrase(p: string) {
  passMem = p;
  try {
    sessionStorage.setItem(SP, p);
  } catch {
    /* ignore */
  }
  emit();
}

/** Whether the user chose "skip for now" on the setup screen this session. */
const SKIP = "kwenta-setup-skip";
let skipMem: boolean | null = null;
export function setupSkipped(): boolean {
  if (skipMem === null) {
    try {
      skipMem = sessionStorage.getItem(SKIP) === "1";
    } catch {
      skipMem = false;
    }
  }
  return skipMem;
}
function writeSkip(v: boolean) {
  skipMem = v;
  try {
    if (v) sessionStorage.setItem(SKIP, "1");
    else sessionStorage.removeItem(SKIP);
  } catch {
    /* ignore */
  }
  emit();
}
export const skipSetup = () => writeSkip(true);
export const useSetupSkipped = () => useSyncExternalStore(subscribe, setupSkipped, () => false);

/** Forgets the passphrase and the "skipped" choice (on sign-out). The setup screen shows again next sign-in. */
export function clearPassphrase() {
  passMem = null;
  try {
    sessionStorage.removeItem(SP);
  } catch {
    /* ignore */
  }
  skipMem = false;
  try {
    sessionStorage.removeItem(SKIP);
  } catch {
    /* ignore */
  }
  status = { ...status, kind: "off" };
  emit();
}

/** "Lock sync on this device": forgets the passphrase but doesn't pop the setup screen back up. */
export function lockSync() {
  clearPassphrase();
  writeSkip(true);
}

export const usePassphrase = () => useSyncExternalStore(subscribe, getPassphrase, () => null);

/* ---------- Status ---------- */

export type SyncKind = "off" | "synced" | "syncing" | "offline" | "error" | "behind";
export interface SyncStatus {
  kind: SyncKind;
  /** Cloud time of the last successful save or restore on this device. */
  at: string | null;
  message?: string;
}

let status: SyncStatus = { kind: "off", at: null };
const setStatus = (s: Partial<SyncStatus> & { kind: SyncKind }) => {
  status = { ...status, message: undefined, ...s };
  emit();
};
export const useSyncStatus = () => useSyncExternalStore(subscribe, () => status, () => status);

/** The cloud time this device last saw, per account, so we can tell when another device saved. */
const atKey = (uid: string) => `kwenta-sync-at:${uid}`;
export function getSyncAt(uid: string): string | null {
  try {
    return localStorage.getItem(atKey(uid));
  } catch {
    return null;
  }
}
export function setSyncAt(uid: string, at: string) {
  try {
    localStorage.setItem(atKey(uid), at);
  } catch {
    /* ignore */
  }
  setStatus({ kind: "synced", at });
}

/** Call after restoring from the cloud, so the restored data isn't uploaded again. */
let lastPushed: string | null = null;
export function markRestored(uid: string, at: string, state: State) {
  lastPushed = JSON.stringify(state);
  setSyncAt(uid, at);
}

/** Resolve a "behind" state by choosing this device's data: overwrite the cloud copy. */
let forceNext = false;
export function keepThisDevice() {
  forceNext = true;
  setStatus({ kind: "syncing" });
  emit();
  kick?.();
}

let kick: (() => void) | null = null;

/* ---------- The engine ---------- */

/**
 * Uploads an encrypted snapshot a few seconds after the data stops changing, while signed in and
 * unlocked. Offline changes wait and go up when the connection returns. If another device saved
 * first, it stops and reports "behind" instead of overwriting.
 */
export function useAutoSync(state: State, enabled: boolean) {
  const pass = usePassphrase();
  const [uid, setUid] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const running = useRef(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let alive = true;
    void currentUserId().then(
      (id) => alive && setUid(id),
      () => alive && setUid(null),
    );
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") clearPassphrase();
      if (alive) setUid(session?.user.id ?? null);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const retrigger = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    kick = retrigger;
    const online = () => retrigger();
    const offline = () => setStatus({ kind: "offline" });
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      if (kick === retrigger) kick = null;
    };
  }, [retrigger]);

  useEffect(() => {
    if (!enabled || !pass || !uid) {
      if (status.kind !== "off" && (!pass || !uid)) setStatus({ kind: "off" });
      return;
    }
    // Wait for the data to settle, and don't pile up on a "behind" state until the user decides.
    if (status.kind === "behind" && !forceNext) return;

    const timer = window.setTimeout(async () => {
      if (running.current) return;
      const current = stateRef.current;
      const json = JSON.stringify(current);
      if (!forceNext && json === lastPushed) {
        if (status.kind === "syncing") setStatus({ kind: "synced" });
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) return setStatus({ kind: "offline" });
      running.current = true;
      setStatus({ kind: "syncing" });
      try {
        const expected = forceNext ? "force" : getSyncAt(uid);
        const at = await pushSnapshot(current, pass, expected);
        forceNext = false;
        lastPushed = json;
        setSyncAt(uid, at);
      } catch (err) {
        forceNext = false;
        if (err instanceof ConflictError) {
          setStatus({ kind: "behind" });
        } else {
          setStatus({ kind: navigator.onLine ? "error" : "offline", message: err instanceof Error ? err.message : undefined });
          // Try again later.
          window.setTimeout(retrigger, RETRY_MS);
        }
      } finally {
        running.current = false;
        // Edits made while the upload was in flight still need to go up.
        if (JSON.stringify(stateRef.current) !== lastPushed && status.kind === "synced") retrigger();
      }
    }, forceNext ? 0 : DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [state, enabled, pass, uid, tick, retrigger]);
}
