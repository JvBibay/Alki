"use client";

import { ReactNode, useEffect } from "react";
import Icon from "./Icon";

/** Full-screen panel that slides over the current tab. */
export default function Sheet({ title, onClose, right, children, className = "" }: { title: string; onClose: () => void; right?: ReactNode; children: ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheethead">
        <button className="iconbtn" onClick={onClose} aria-label="Back">
          <Icon name="back" />
        </button>
        <h1>{title}</h1>
        <div className="sheetright">{right}</div>
      </div>
      <div className="sheetbody">{children}</div>
    </div>
  );
}

/** Small centered dialog for forms. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modalbg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modalhead">
          <h2>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
