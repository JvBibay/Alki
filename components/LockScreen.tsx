"use client";

import { useEffect, useState } from "react";
import Mascot from "./Mascot";
import Icon from "./Icon";
import { bioEnrolled, unlockWithBio } from "@/lib/biometric";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
const MAX_TRIES = 5;

/** Saved PIN length (4–6), or 0 if unknown. */
function savedPinLength() {
  try {
    const n = parseInt(localStorage.getItem("kwenta-pinlen") ?? "", 10);
    return n >= 4 && n <= 6 ? n : 0;
  } catch {
    return 0;
  }
}

/** Full-screen PIN pad shown while Kwenta is locked. */
export default function LockScreen({ onUnlock, onErase }: { onUnlock: (pin: string) => Promise<boolean>; onErase: () => void }) {
  const [pinLen] = useState(savedPinLength);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [forgot, setForgot] = useState(false);
  const [eraseArmed, setEraseArmed] = useState(false);
  const waiting = waitUntil > now;
  const [bio, setBio] = useState(false);
  useEffect(() => setBio(bioEnrolled()), []);

  /** Fingerprint prompt, then the normal PIN unlock with the PIN it releases. A cancel or failure just falls back to the pad. */
  async function useFingerprint() {
    if (busy || waiting) return;
    setError("");
    setBusy(true);
    const p = await unlockWithBio();
    setBusy(false);
    if (!p) return setError("Fingerprint didn’t work. Use your PIN.");
    void submit(p);
  }

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [waiting]);

  async function submit(value: string) {
    if (busy || waiting) return;
    setBusy(true);
    const ok = await onUnlock(value);
    setBusy(false);
    if (ok) return;
    const n = fails + 1;
    setFails(n);
    setPin("");
    if (n % MAX_TRIES === 0) {
      // Slow down guessing: 30s, then 60s, 90s…
      setWaitUntil(Date.now() + (n / MAX_TRIES) * 30_000);
      setNow(Date.now());
      setError("Too many tries. Please wait.");
    } else setError(`Wrong PIN. ${MAX_TRIES - (n % MAX_TRIES)} tries left before a short wait.`);
  }

  function press(key: string) {
    if (!key || busy || waiting) return;
    setError("");
    if (key === "⌫") return setPin((p) => p.slice(0, -1));
    setPin((p) => (p.length >= (pinLen || 6) ? p : p + key));
  }

  // Unlock as soon as the last digit is entered (when we know the PIN length).
  useEffect(() => {
    if (pinLen && pin.length === pinLen) void submit(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, pinLen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
      else if (e.key === "Enter" && pin.length >= 4) void submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="lockscreen" role="dialog" aria-modal="true" aria-label="Kwenta is locked">
      <Mascot size={84} animated />
      <h1>Kwenta is locked</h1>
      <p className="sub">{waiting ? `Try again in ${Math.ceil((waitUntil - now) / 1000)}s` : pinLen ? `Enter your ${pinLen}-digit PIN` : "Enter your PIN"}</p>
      <div className="pindots" aria-label={`${pin.length} digits entered`}>
        {Array.from({ length: pinLen || Math.max(4, pin.length) }, (_, i) => (
          <i key={i} className={i < pin.length ? "on" : ""} />
        ))}
      </div>
      <p className="pinerror" role="alert">
        {busy ? "Checking…" : error}
      </p>
      <div className="pinpad">
        {KEYS.map((k, i) =>
          k ? (
            <button key={i} onClick={() => press(k)} aria-label={k === "⌫" ? "Delete digit" : k} disabled={waiting}>
              {k}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      <button className="btn wide" disabled={pin.length < 4 || busy || waiting} onClick={() => void submit(pin)}>
        <Icon name="check" size={18} /> Unlock
      </button>
      {bio && (
        <button className="btn ghost wide" style={{ marginTop: 10 }} disabled={busy || waiting} onClick={() => void useFingerprint()}>
          <Icon name="lock" size={18} /> Use fingerprint
        </button>
      )}
      {!forgot ? (
        <button className="link" style={{ marginTop: 14 }} onClick={() => setForgot(true)}>
          Forgot PIN?
        </button>
      ) : (
        <div className="forgot">
          <p>
            Your data is encrypted with your PIN, so nobody (not even us) can recover it without the PIN. You can erase this device’s data and start over,
            then import a backup if you have one.
          </p>
          <button
            className={`btn sm ${eraseArmed ? "danger" : "ghost"}`}
            onClick={() => {
              if (!eraseArmed) return setEraseArmed(true);
              onErase();
            }}
          >
            {eraseArmed ? "Tap again to erase everything" : "Erase data and start over"}
          </button>
        </div>
      )}
    </div>
  );
}
