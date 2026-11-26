"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

/**
 * The Plan tab row. It scrolls sideways when the tabs don't fit, so the edges that still have
 * more tabs fade out (a hint that Debts etc. are further along), and the selected tab scrolls into view.
 */
export default function PlanTabs({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdge((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    // Scroll only this row to the selected tab. (scrollIntoView would also slide the whole page sideways.)
    const sel = el.querySelector<HTMLElement>('[aria-selected="true"]');
    if (sel) el.scrollLeft = Math.max(0, sel.offsetLeft - (el.clientWidth - sel.offsetWidth) / 2);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, children]);

  return (
    <div
      ref={ref}
      className={`seg onband plantabs${edge.left ? " fadel" : ""}${edge.right ? " fader" : ""}`}
      role="tablist"
      onScroll={measure}
    >
      {children}
    </div>
  );
}
