"use client";

import { useEffect, useRef } from "react";
import type { Ctx } from "@/lib/ui";
import Sheet from "./Sheet";
import BadgeCoin from "./BadgeCoin";
import { unreadCount } from "@/lib/notices";

function when(at: number): string {
  const mins = Math.floor((Date.now() - at) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(at).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** Settings → Notifications: things Kwenta told you about (new badges), newest first. */
export default function Notifications({ ctx }: { ctx: Ctx }) {
  const { k, close } = ctx;
  const list = k.state.settings.notices ?? [];
  // Remember which were unread when the page opened, so they stay highlighted while you read them.
  const wasUnread = useRef(new Set(list.filter((n) => !n.read).map((n) => n.id)));
  const { updateSettings } = k;

  useEffect(() => {
    if (unreadCount(list)) updateSettings({ notices: list.map((n) => (n.read ? n : { ...n, read: true })) });
    // Only when it opens or a new notice arrives while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  return (
    <Sheet title="Notifications" onClose={close}>
      {list.length === 0 ? (
        <div className="card">
          <p className="sub" style={{ padding: "14px 0" }}>
            Nothing yet. When you earn a badge, it shows up here.
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            {list.map((n) => (
              <div key={n.id} className={`row noticerow${wasUnread.current.has(n.id) ? " unread" : ""}`}>
                <span className="bico">
                  <BadgeCoin icon={n.icon} tier={n.tier ?? "bronze"} size={44} />
                </span>
                <div className="main">
                  <div className="t">{n.title}</div>
                  <div className="s">{n.text}</div>
                </div>
                <span className="s">{when(n.at)}</span>
              </div>
            ))}
          </div>
          <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => updateSettings({ notices: [] })}>
            Clear all
          </button>
        </>
      )}
      <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => ctx.open({ kind: "streak" })}>
        See all badges
      </button>
    </Sheet>
  );
}
