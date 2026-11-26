"use client";

import { useEffect, useState } from "react";
import { loadPhoto } from "@/lib/photos";
import { Modal } from "./Sheet";
import Emoji from "./Emoji";

/** Loads an encrypted receipt photo from the device and shows it (thumbnail, tap for full size). */
export default function ReceiptPhoto({ id, keyB64, onRemove }: { id: string; keyB64?: string; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [big, setBig] = useState(false);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    if (!keyB64) {
      setMissing(true);
      return;
    }
    loadPhoto(id, keyB64)
      .then((u) => {
        made = u;
        if (!alive) return;
        if (u) setUrl(u);
        else setMissing(true);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, keyB64]);

  return (
    <div className="receipt">
      {missing ? (
        <span className="sub"><Emoji e="📎" /> Photo isn’t on this device. It may be from a backup made before photos were included.</span>
      ) : url ? (
        <button type="button" className="receiptthumb" onClick={() => setBig(true)} aria-label="View receipt photo">
          <img src={url} alt="Receipt" />
        </button>
      ) : (
        <span className="sub">Loading photo…</span>
      )}
      <span className="receiptbtns">
        {url && (
          <button type="button" className="btn ghost sm" onClick={() => setBig(true)}>
            View
          </button>
        )}
        {onRemove && (
          <button type="button" className="btn ghost sm" onClick={onRemove}>
            Remove
          </button>
        )}
      </span>
      {big && url && (
        <Modal title="Receipt" onClose={() => setBig(false)}>
          <img src={url} alt="Receipt" className="receiptfull" />
        </Modal>
      )}
    </div>
  );
}
