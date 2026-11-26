"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/photos";
import Icon from "./Icon";
import { Modal } from "./Sheet";
import Emoji from "./Emoji";
import { cleanName } from "@/lib/testimonials";
import { cleanMessage, MAX_FEEDBACK, sendFeedback, type FeedbackKind } from "@/lib/feedback";

const KINDS: { id: FeedbackKind; emoji: string; label: string; ph: string }[] = [
  { id: "idea", emoji: "💡", label: "Idea", ph: "What would make Kwenta better for you?" },
  { id: "problem", emoji: "🐞", label: "Problem", ph: "What went wrong? What did you expect to happen?" },
  { id: "praise", emoji: "💚", label: "Praise", ph: "What do you like about Kwenta?" },
];

export default function Feedback({ screen, rating, name, onClose, onSent, toast }: { screen: string; rating?: number; name?: string; onClose: () => void; onSent?: () => void; toast: (m: string) => void }) {
  const [kind, setKind] = useState<FeedbackKind>(rating === 3 ? "praise" : rating === 1 ? "problem" : "idea");
  const [message, setMessage] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [publicOk, setPublicOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Optional screenshot, shrunk to a small JPEG as soon as it's picked.
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);
  async function pick(f?: File) {
    if (!f) return;
    setErr("");
    try {
      const blob = await compressImage(f, 1280, 0.7);
      setShot({ blob, url: URL.createObjectURL(blob) });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Couldn’t read that image. Try another one.");
    }
  }
  const ph = KINDS.find((k) => k.id === kind)!.ph;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const m = cleanMessage(message);
    if (!m) return setErr("Please write a few words first.");
    setBusy(true);
    setErr("");
    try {
      const r = await sendFeedback({ kind, message: m, rating, contactOk, publicOk, name: cleanName(name ?? ""), screen, at: Date.now() }, shot?.blob);
      toast(r === "sent" ? "Thank you! Alki passed it on 💚" : shot ? "Saved without the screenshot. It will send when you’re back online." : "Saved. It will send when you’re back online.");
      onSent?.();
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error && /sign in/i.test(e2.message) ? "Please sign in to send feedback." : "Couldn’t send it. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Send feedback" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="chips" role="group" aria-label="What kind of feedback">
          {KINDS.map((k) => (
            <button key={k.id} type="button" className="chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              <Emoji e={k.emoji} /> {k.label}
            </button>
          ))}
        </div>
        <label>
          Your message
          <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, MAX_FEEDBACK))} placeholder={ph} rows={5} autoFocus />
          <span className="hint" style={{ textAlign: "right" }}>
            {message.length}/{MAX_FEEDBACK}
          </span>
        </label>
        {kind === "problem" && (
          <div className="fbshot">
            <span className="fbshot-t">Screenshot <small>(optional)</small></span>
            {shot ? (
              <div className="fbshot-prev">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.url} alt="Your screenshot" />
                <button type="button" className="x" aria-label="Remove screenshot" onClick={() => setShot(null)}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ) : (
              <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
                <Icon name="plus" size={16} /> Add a screenshot
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} />
          <span>It’s OK to contact me about this</span>
        </label>
        {(kind === "praise" || rating === 3) && (
          <label className="check">
            <input type="checkbox" checked={publicOk} onChange={(e) => setPublicOk(e.target.checked)} />
            <span>You may show this publicly. Only the first letter of my name is shown ({cleanName(name ?? "") ? `${cleanName(name ?? "")[0]}***` : "Kwenta user"}).</span>
          </label>
        )}
        <p className="hint">Your feedback is sent as plain text with your account. Please don’t include account numbers, PINs or passwords, and hide them in any screenshot. None of your budget data is sent.</p>
        {err && (
          <p className="warnt" role="alert">
            {err}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </Modal>
  );
}
