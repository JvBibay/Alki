"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { catColor, catEmoji, catNames } from "@/lib/categories";
import type { Ctx } from "@/lib/ui";
import { monthRecap } from "@/lib/recap";
import { accountName, fmt, fmtIn } from "@/lib/format";
import { accCurrency } from "@/lib/stats";
import Mascot from "./Mascot";
import { lookOf } from "@/lib/closet";
import BankLogo from "./BankLogo";
import Icon from "./Icon";
import Emoji from "./Emoji";

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A number that counts up from zero when its slide appears. */
function CountUp({ value, format = (n: number) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const [v, setV] = useState(() => (reducedMotion() ? value : 0));
  useEffect(() => {
    if (reducedMotion()) {
      setV(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(v)}</>;
}

/** Story-style monthly recap. Tap the sides to move, swipe, or tap a bar on top; hold to pause. It moves on by itself. */
export default function Recap({ ctx, y, m }: { ctx: Ctx; y: number; m: number }) {
  const { k, close } = ctx;
  const { state } = k;
  const r = useMemo(() => monthRecap(state, y, m), [state, y, m]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const press = useRef<{ x: number; y: number; t: number } | null>(null);
  const { toast } = ctx;
  const month = new Date(y, m, 1).toLocaleDateString("en-PH", { month: "long" });
  const acc = state.accounts.find((a) => a.id === r.topAccount?.id);

  const slides: { tone: string; body: React.ReactNode }[] = [
    {
      tone: "t1",
      body: (
        <>
          <Mascot size={120} look={lookOf(state.settings)} animated={state.settings.alkiMotion !== false} />
          <p className="rk-eyebrow">Your monthly recap</p>
          <h2 className="rk-huge">{r.label}</h2>
          <p className="rk-lead">
            You logged <b><CountUp value={r.entries} /></b> {r.entries === 1 ? "entry" : "entries"} on <b>{r.loggedDays}</b> {r.loggedDays === 1 ? "day" : "days"}.
            {r.entries >= 20 ? " That’s real dedication!" : " Let’s see where the money went."}
          </p>
        </>
      ),
    },
    {
      tone: "t2",
      body: (
        <>
          <p className="rk-eyebrow">Money in, money out</p>
          <div className="rk-flow">
            <div className="rk-in">
              <span>↓ Came in</span>
              <b className="num"><CountUp value={r.income} format={fmt} /></b>
              <i className="rk-meter"><u style={{ width: `${Math.max(r.income, r.expense) ? (r.income / Math.max(r.income, r.expense)) * 100 : 0}%` }} /></i>
            </div>
            <div className="rk-out">
              <span>↑ Went out</span>
              <b className="num"><CountUp value={r.expense} format={fmt} /></b>
              <i className="rk-meter"><u style={{ width: `${Math.max(r.income, r.expense) ? (r.expense / Math.max(r.income, r.expense)) * 100 : 0}%` }} /></i>
            </div>
          </div>
          <h2 className="rk-big num">
            {r.saved >= 0 ? (
              <>You kept <CountUp value={r.saved} format={fmt} /></>
            ) : (
              <>You spent <CountUp value={-r.saved} format={fmt} /> more than came in</>
            )}
          </h2>
          <p className="rk-lead">
            {r.savingsRate !== null && r.savingsRate > 0 && `That’s ${r.savingsRate}% of your income. `}
            {r.vsPrev !== null &&
              (r.vsPrev <= 0 ? `Spending was ${Math.abs(r.vsPrev)}% lower than the month before. 👏` : `Spending was ${r.vsPrev}% higher than the month before.`)}
          </p>
        </>
      ),
    },
    {
      tone: "t3",
      body: (
        <>
          <p className="rk-eyebrow">Where it went</p>
          {r.topCats.length === 0 ? (
            <h2 className="rk-big">No spending logged in {month}.</h2>
          ) : (
            <>
              <h2 className="rk-big">
                <Emoji e={catEmoji(r.topCats[0].cat)} /> {r.topCats[0].cat} led the way
              </h2>
              <div className="rk-cats">
                {r.topCats.map((c, n) => (
                  <div key={c.cat} className="rk-cat">
                    <span className="rk-rank">{n + 1}</span>
                    <div className="main">
                      <div className="rk-catrow">
                        <b>
                          <Emoji e={catEmoji(c.cat)} /> {c.cat}
                        </b>
                        <span className="num">{fmt(c.amount)}</span>
                      </div>
                      <div className="rk-bar">
                        <i style={{ width: `${c.pct}%`, background: catColor(c.cat) }} />
                      </div>
                    </div>
                    <span className="rk-pct">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ),
    },
    {
      tone: "t4",
      body: (
        <>
          <p className="rk-eyebrow">Biggest moments</p>
          {r.biggest ? (
            <>
              <div className="rk-moment">
                <span>Biggest expense</span>
                <b className="num">{fmtIn(r.biggest.amount, accCurrency(state, r.biggest.acc))}</b>
                <small>
                  {r.biggest.note} · {new Date(r.biggest.date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                </small>
              </div>
              {r.busiestDay && (
                <div className="rk-moment">
                  <span>Busiest spending day</span>
                  <b>{new Date(r.busiestDay.date).toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" })}</b>
                  <small className="num">{fmt(r.busiestDay.amount)} spent</small>
                </div>
              )}
            </>
          ) : (
            <h2 className="rk-big">A no-spend month? Impressive.</h2>
          )}
        </>
      ),
    },
    {
      tone: "t5",
      body: (
        <>
          <p className="rk-eyebrow">Your habits</p>
          <h2 className="rk-huge num"><CountUp value={r.noSpendDays} /></h2>
          <p className="rk-lead">
            no-spend {r.noSpendDays === 1 ? "day" : "days"} out of {r.daysInMonth}. {r.noSpendDays >= 8 ? "Your wallet got some rest! 😌" : "Can you beat it next month?"}
          </p>
          {acc && r.topAccount && (
            <div className="rk-acc">
              <BankLogo account={acc} size={40} />
              <div>
                <small>Most used account</small>
                <b>
                  {accountName(state.accounts, acc.id)} · {r.topAccount.count} {r.topAccount.count === 1 ? "entry" : "entries"}
                </b>
              </div>
            </div>
          )}
        </>
      ),
    },
    {
      tone: "t6",
      body: (
        <>
          <p className="rk-eyebrow">Your money style in {month}</p>
          <div className="rk-emoji"><Emoji e={r.style.emoji} /></div>
          <h2 className="rk-big">{r.style.title}</h2>
          <p className="rk-lead">{r.style.line}</p>
          <div className="rk-actions">
            <button className="btn rk-done" onClick={() => void share()}>
              <Icon name="send" size={18} /> Share
            </button>
            <button className="btn ghost rk-done2" onClick={close}>
              Done
            </button>
          </div>
        </>
      ),
    },
  ];

  const last = slides.length - 1;
  const go = (d: number) => setI((n) => Math.max(0, Math.min(last, n + d)));

  async function share() {
    const top = r.topCats[0];
    const text = [
      `My ${r.label} on Kwenta 💚`,
      r.saved >= 0 ? `Kept ${fmt(r.saved)}` : `Spent ${fmt(-r.saved)} more than came in`,
      top ? `Top category: ${top.cat}` : "",
      `${r.noSpendDays} no-spend ${r.noSpendDays === 1 ? "day" : "days"}`,
      `${r.style.emoji} ${r.style.title}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Copied. Paste it in your chat.");
      }
    } catch {
      /* share sheet closed */
    }
  }

  // Swipe or tap to move, hold to pause. A long press is never a tap.
  const down = (e: React.PointerEvent) => {
    press.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    setPaused(true);
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    setPaused(false);
    const p = press.current;
    press.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if ((e.target as HTMLElement).closest("button")) return;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return go(dx < 0 ? 1 : -1);
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && Date.now() - p.t < 350) {
      const rect = e.currentTarget.getBoundingClientRect();
      go(e.clientX - rect.left < rect.width / 3 ? -1 : 1);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  });

  return (
    <div className={`recap ${slides[i].tone}`} role="dialog" aria-modal="true" aria-label={`${r.label} recap`} style={{ ["--rk-play" as string]: paused ? "paused" : "running" }}>
      <div className="rk-progress" role="tablist" aria-label="Recap slides">
        {slides.map((_, n) => (
          <button key={n} role="tab" aria-selected={n === i} aria-label={`Slide ${n + 1} of ${slides.length}`} onClick={() => setI(n)}>
            <i className={n < i ? "done" : n === i ? `now${n === last ? " end" : ""}` : ""} onAnimationEnd={() => n === i && n < last && go(1)} />
          </button>
        ))}
      </div>
      <div className="rk-head">
        <span>{r.label} recap</span>
        <button className="iconbtn light" onClick={close} aria-label="Close recap">
          <Icon name="close" />
        </button>
      </div>
      <div
        className="rk-slide"
        key={i}
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={() => setPaused(false)}
        onPointerCancel={() => {
          press.current = null;
          setPaused(false);
        }}
      >
        {slides[i].body}
      </div>
      <div className="rk-nav">
        <button className="iconbtn light" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous">
          <Icon name="back" />
        </button>
        <span>{i === 0 ? "Tap or swipe · hold to pause" : `${i + 1} / ${slides.length}`}</span>
        <button className="iconbtn light" onClick={() => (i === last ? close() : go(1))} aria-label={i === last ? "Finish" : "Next"}>
          <Icon name={i === last ? "check" : "send"} />
        </button>
      </div>
    </div>
  );
}
