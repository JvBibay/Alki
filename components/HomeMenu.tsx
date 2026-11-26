"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Ctx } from "@/lib/ui";
import { unreadCount } from "@/lib/notices";
import Icon from "./Icon";

/** One collapsible menu for the Home header: hide amounts, chat, notifications, settings. */
export default function HomeMenu({ ctx }: { ctx: Ctx }) {
  const { k, open } = ctx;
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 8 });
  const hidden = !!k.state.settings.hideAmounts;
  const unread = unreadCount(k.state.settings.notices);

  useEffect(() => {
    if (!show) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) setShow(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setShow(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [show]);

  const go = (fn: () => void) => () => {
    setShow(false);
    fn();
  };

  return (
    <div className="homemenu" ref={ref} data-avoid>
      <button
        className="iconbtn light menubtn"
        onClick={() => {
          const r = ref.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
          setShow((v) => !v);
        }}
        aria-label={show ? "Close menu" : "Open menu"}
        aria-expanded={show}
        aria-haspopup="menu"
      >
        <Icon name={show ? "close" : "settings"} />
        {!show && unread > 0 && <span className="menudot" aria-label={`${unread} unread notifications`} />}
      </button>
      {show &&
        createPortal(
        <div className="menupanel" role="menu" ref={panelRef} style={{ top: pos.top, right: pos.right }}>
          <button role="menuitem" onClick={() => k.updateSettings({ hideAmounts: !hidden })} aria-pressed={hidden}>
            <Icon name={hidden ? "eyeOff" : "eye"} /> <span>{hidden ? "Show amounts" : "Hide amounts"}</span>
          </button>
          <button role="menuitem" onClick={go(() => open({ kind: "chat" }))}>
            <Icon name="chat" /> <span>Chat with Alki</span>
          </button>
          <button role="menuitem" onClick={go(() => open({ kind: "notifications" }))}>
            <Icon name="bell" /> <span>Notifications</span>
            {unread > 0 && <span className="newdot">{unread}</span>}
          </button>
          <button role="menuitem" onClick={go(() => open({ kind: "settings" }))}>
            <Icon name="settings" /> <span>Settings</span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
