"use client";

import type { Ctx } from "@/lib/ui";
import { badges } from "@/lib/badges";
import AlkiCloset from "./AlkiCloset";
import { DAY, startOfDay, streak } from "@/lib/stats";
import Sheet from "./Sheet";
import BadgeCoin from "./BadgeCoin";
import Fire from "./Fire";

export default function Streak({ ctx }: { ctx: Ctx }) {
  const { k, toast, close } = ctx;
  const { state } = k;
  const st = streak(state.txs);
  const list = badges(state);
  const earned = new Set(list.filter((b) => b.earned).map((b) => b.id));
  const next = list.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress)[0];

  const logged = new Set(state.txs.filter((t) => !t.auto).map((t) => startOfDay(t.date)));
  const today = startOfDay(Date.now());
  const days = Array.from({ length: 14 }, (_, i) => today - (13 - i) * DAY);

  return (
    <Sheet title="Streaks & rewards" onClose={close}>
      <div className="streakhero card">
        <div className="flame" aria-hidden="true">
          <Fire size={64} lit={st.count > 0} sparks />
        </div>
        <div className="big num">{st.count}</div>
        <div className="sub">day streak · best {st.best}</div>
        <p>{st.loggedToday ? "You’ve logged today. See you tomorrow!" : st.count ? "Log anything today to keep your streak alive." : "Log something today to start a streak."}</p>
        <div className="dots" aria-label="Last 14 days">
          {days.map((d) => (
            <span key={d} className={logged.has(d) ? "on" : ""} title={new Date(d).toDateString()}>
              {new Date(d).toLocaleDateString("en-PH", { weekday: "narrow" })}
            </span>
          ))}
        </div>
      </div>

      {next && (
        <div className="card nextbadge">
          <span className="bico"><BadgeCoin icon={next.icon} tier={next.tier} size={52} /></span>
          <div className="main">
            <div className="eyebrow">Next badge</div>
            <div className="t">{next.name}</div>
            <div className="s">{next.desc}</div>
            <div className="bar">
              <i style={{ width: `${next.progress * 100}%`, background: "var(--accent)" }} />
            </div>
          </div>
        </div>
      )}

      <h2>Badges</h2>
      <div className="badgegrid">
        {list.map((b) => (
          <div key={b.id} className={`badge${b.earned ? " earned" : ""}`} title={b.desc}>
            <span className="bico"><BadgeCoin icon={b.icon} tier={b.tier} size={60} /></span>
            <b>{b.name}</b>
            <small>{b.earned ? "Earned" : b.desc}</small>
          </div>
        ))}
      </div>

      <h2>Alki’s closet</h2>
      <AlkiCloset ctx={ctx} />
    </Sheet>
  );
}
