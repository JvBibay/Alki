"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./Sheet";
import Icon from "./Icon";
import { assertImage } from "@/lib/upload";
import { cropToCanvas, detectInImage, scans, toStoredPng, withMargin, type Box } from "@/lib/qr";

type Phase = "loading" | "found" | "adjust";

const MIN = 60;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/**
 * Crops a screenshot of a payment QR. Kwenta looks for the QR and crops it for you; if it can't, or you'd
 * rather, drag the box over it and pull the corner to resize. The result is checked to still scan.
 */
export default function QrCrop({ file, onDone, onClose }: { file: File; onDone: (dataUrl: string) => void; onClose: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [src, setSrc] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [box, setBox] = useState<Box | null>(null);
  const [wasAuto, setWasAuto] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; ok: boolean } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "resize"; x: number; y: number; box: Box } | null>(null);
  const autoBox = useRef<Box | null>(null);

  // Load the picture.
  useEffect(() => {
    // In development React runs this twice and tears down the first run (revoking its URL) before it loads;
    // `alive` stops that abandoned load from reporting a false "isn't a picture" error.
    let alive = true;
    let url = "";
    setError("");
    // Check the real file type and size first; only then is the browser asked to open it.
    void assertImage(file).then(
      () => {
        if (!alive) return;
        url = URL.createObjectURL(file);
        setSrc(url);
        const im = new Image();
        im.onload = () => alive && setImg(im);
        im.onerror = () => alive && setError("That file isn’t a picture.");
        im.src = url;
      },
      (e: unknown) => alive && setError(e instanceof Error ? e.message : "That file isn’t a picture."),
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  // Look for the QR as soon as the picture is ready.
  useEffect(() => {
    if (!img) return;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    // A short pause lets "Looking for your QR…" paint before the (brief) detection work.
    const t = setTimeout(() => {
      const f = detectInImage(img);
      if (f) {
        const b = withMargin(f.box, f.modules, W, H);
        autoBox.current = b;
        setBox(b);
        setWasAuto(true);
        setPhase("found");
      } else {
        const s = Math.round(Math.min(W, H) * 0.6);
        setBox({ x: (W - s) / 2, y: (H - s) / 2, size: s });
        setPhase("adjust");
      }
    }, 30);
    return () => clearTimeout(t);
  }, [img]);

  // Show what the crop will look like, and check that it still scans (after a pause while dragging).
  useEffect(() => {
    if (!img || !box) return;
    const t = setTimeout(() => {
      const c = cropToCanvas(img, box);
      setResult({ url: c.toDataURL("image/png"), ok: scans(c) });
    }, 180);
    return () => clearTimeout(t);
  }, [img, box]);

  function start(mode: "move" | "resize", e: React.PointerEvent) {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, box: { ...box } };
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    const el = stage.current;
    if (!d || !el || !img) return;
    const k = img.naturalWidth / el.clientWidth;
    const dx = (e.clientX - d.x) * k;
    const dy = (e.clientY - d.y) * k;
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    if (d.mode === "move") setBox({ ...d.box, x: clamp(d.box.x + dx, 0, W - d.box.size), y: clamp(d.box.y + dy, 0, H - d.box.size) });
    else setBox({ ...d.box, size: clamp(d.box.size + (dx + dy) / 2, MIN, Math.min(W - d.box.x, H - d.box.y)) });
  }
  const end = () => {
    drag.current = null;
  };

  function use() {
    if (!img || !box) return;
    onDone(toStoredPng(cropToCanvas(img, box)));
  }

  const W = img?.naturalWidth ?? 1;
  const H = img?.naturalHeight ?? 1;

  return (
    <Modal title="Your payment QR" onClose={onClose}>
      <div className="form">
        {error && <p className="warnt">{error}</p>}
        {phase === "loading" && !error && <p className="sub">Looking for your QR…</p>}

        {phase === "found" && result && (
          <>
            <div className="qc-result">
              <img src={result.url} alt="Your QR, cropped" />
            </div>
            <p className="sub" role="status">
              {result.ok ? (
                <>
                  <b>Found your QR and cropped it.</b> It scans correctly.
                </>
              ) : (
                <>
                  <b>Found a QR and cropped it,</b> but this picture doesn’t read back cleanly. Adjust the crop, or try a sharper screenshot.
                </>
              )}
            </p>
            <button className="btn" onClick={use}>
              <Icon name="check" size={18} /> Use this QR
            </button>
            <button className="btn ghost" onClick={() => setPhase("adjust")}>
              Adjust the crop
            </button>
          </>
        )}

        {phase === "adjust" && box && (
          <>
            <p className="sub">
              {wasAuto
                ? "Drag the box to move it, and pull the round handle to resize. It should hold the whole QR."
                : "We couldn’t find a QR automatically. Drag the box over it and pull the round handle to resize."}
            </p>
            <div className="qc-stage" ref={stage} style={{ aspectRatio: `${W} / ${H}`, width: `min(100%, calc(50vh * ${W / H}))` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Your screenshot" draggable={false} />
              <div
                className="qc-box"
                style={{ left: `${(box.x / W) * 100}%`, top: `${(box.y / H) * 100}%`, width: `${(box.size / W) * 100}%`, height: `${(box.size / H) * 100}%` }}
                onPointerDown={(e) => start("move", e)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
              >
                <span className="qc-handle" onPointerDown={(e) => start("resize", e)} aria-label="Resize the box" role="slider" aria-valuenow={Math.round(box.size)} />
              </div>
            </div>
            {result && (
              <p className="sub" role="status">
                {result.ok ? <b>✓ This crop scans correctly.</b> : "This crop doesn’t scan yet. Make sure the whole QR is inside the box."}
              </p>
            )}
            <button className="btn" onClick={use} disabled={!result}>
              <Icon name="check" size={18} /> Use this crop
            </button>
            {autoBox.current && (
              <button
                className="btn ghost"
                onClick={() => {
                  setBox(autoBox.current);
                  setPhase("found");
                }}
              >
                Back to the automatic crop
              </button>
            )}
          </>
        )}

        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
