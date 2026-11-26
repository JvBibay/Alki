"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Ctx } from "@/lib/ui";
import { hasSpeech, listen } from "@/lib/ui";
import { respond } from "@/lib/assistant";
import { runReply, type Card } from "@/lib/runReply";
import { accCurrency } from "@/lib/stats";
import Sheet from "./Sheet";
import Mascot, { type Face } from "./Mascot";
import { lookOf } from "@/lib/closet";
import Icon from "./Icon";
import { EmojiText } from "./Emoji";

interface Msg {
  id: number;
  from: "me" | "alki";
  text: string;
  cards?: Card[];
}

const SUGGESTIONS = ["Spent 225 on lunch", "lunch 180 and jeep 24", "hati kami ni Migs 1200", "What’s my balance?", "How much did I spend this week?", "What bills are coming up?", "Can I afford 2000?"];

export default function Chat({ ctx }: { ctx: Ctx }) {
  const { k, toast } = ctx;
  const name = k.state.settings.name;
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 0,
      from: "alki",
      text: `Hi${name ? ` ${name}` : ""}! Ask me about your money, or just type or say a transaction like “salary 15000” or “spent 250 on food” and I’ll log it.`,
    },
  ]);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [face, setFace] = useState<Face>("wink");
  const stopRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  // Undo buttons run later, so they read the app's latest state through this.
  const kRef = useRef(k);
  kRef.current = k;

  function send(input: string) {
    const t = input.trim();
    if (!t) return;
    const r = respond(t, k.state);
    const cards = runReply(() => kRef.current, r);
    setFace(r.face ?? "normal");
    setMsgs((m) => [...m, { id: idRef.current++, from: "me", text: t }, { id: idRef.current++, from: "alki", text: r.text, cards: cards.length ? cards : undefined }]);
    setText("");
  }

  function undo(m: Msg, n: number) {
    const c = m.cards?.[n];
    if (!c || c.undone) return;
    c.undo();
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, cards: x.cards?.map((y, j) => (j === n ? { ...y, undone: true } : y)) } : x)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(text);
  }

  function toggleMic() {
    if (stopRef.current) {
      stopRef.current();
      return;
    }
    const stop = listen(
      (t) => send(t),
      () => {
        stopRef.current = null;
        setListening(false);
      },
      () => toast("Couldn’t use the microphone."),
    );
    if (stop) {
      stopRef.current = stop;
      setListening(true);
    }
  }

  return (
    <Sheet title="Chat with Alki" onClose={ctx.close} className="chatsheet">
      <div className="chatlog" aria-live="polite">
        <div className="chathero">
          <Mascot size={70} look={{ ...lookOf(k.state.settings), scene: undefined }} face={listening ? "thinking" : face} animated />
          <p className="sub">Typing works offline and never leaves this device. Voice uses your browser’s speech service.</p>
        </div>
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.from}`}>
            {m.cards ? (
              <div className="logged">
                <span className={`pill ${m.cards.every((c) => c.undone) ? "muted" : ""}`}>{m.cards.every((c) => c.undone) ? "Undone" : "✓ Done"}</span>
                <p>
                  <EmojiText text={m.text} />
                </p>
                {m.cards.map(
                  (c, n) =>
                    !c.undone && (
                      <div key={n}>
                        <div className="txcard">
                          <b>{c.title}</b>
                          <span className="num">{c.amount}</span>
                          <button className="chip" onClick={() => undo(m, n)}>
                            Undo
                          </button>
                        </div>
                        {c.rows.map((row) => (
                          <div key={row} className="sub" style={{ margin: "4px 2px 0", fontSize: "0.8rem" }}>
                            {row}
                          </div>
                        ))}
                      </div>
                    ),
                )}
              </div>
            ) : (
              <p>{m.from === "alki" ? <EmojiText text={m.text} /> : m.text}</p>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="chatfoot">
        <div className="chips scroll">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => setText(s)}>
              {s}
            </button>
          ))}
        </div>
        <form className="qa" onSubmit={onSubmit} autoComplete="off">
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Log or ask anything" aria-label="Message Alki" autoFocus />
          {hasSpeech() && (
            <button type="button" className={`roundbtn${listening ? " on" : ""}`} onClick={toggleMic} aria-label={listening ? "Stop listening" : "Speak"}>
              <Icon name="mic" />
            </button>
          )}
          <button className="roundbtn primary" type="submit" aria-label="Send">
            <Icon name="send" />
          </button>
        </form>
      </div>
    </Sheet>
  );
}
