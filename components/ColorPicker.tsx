"use client";

import { useState } from "react";
import { Modal } from "@/components/Sheet";
import { contrast, hexToHsv, hsvToHex, normalizeHex, readableOn, type Hsv } from "@/lib/color";

const RAINBOW = "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";

/**
 * Pick any app color: type a hex code, or drag hue, saturation and brightness.
 * Nothing changes in the app until "Use color"; Cancel (or Escape, or tapping outside) leaves it as it was.
 */
export default function ColorPicker({ value, onUse, onClose }: { value: string; onUse: (hex: string) => void; onClose: () => void }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const hex = hsvToHex(hsv);
  const [text, setText] = useState(hex.toUpperCase());
  const invalid = text.trim() !== "" && normalizeHex(text) === null;

  function slide(part: keyof Hsv, v: number) {
    const next = { ...hsv, [part]: v };
    setHsv(next);
    setText(hsvToHex(next).toUpperCase());
  }

  function typed(raw: string) {
    setText(raw);
    const n = normalizeHex(raw);
    if (n) setHsv(hexToHsv(n, hsv.h)); // a gray has no hue of its own, so keep the one you were on
  }

  // The header and buttons put white text on this color, so a very light one is hard to read.
  const tooLight = contrast(hex, "#ffffff") < 3;

  const sliders: { part: keyof Hsv; label: string; max: number; unit: string; track: string }[] = [
    { part: "h", label: "Hue", max: 360, unit: "°", track: RAINBOW },
    { part: "s", label: "Saturation", max: 100, unit: "%", track: `linear-gradient(to right, ${hsvToHex({ ...hsv, s: 0 })}, ${hsvToHex({ ...hsv, s: 100 })})` },
    { part: "v", label: "Brightness", max: 100, unit: "%", track: `linear-gradient(to right, #000000, ${hsvToHex({ ...hsv, v: 100 })})` },
  ];

  return (
    <Modal title="Custom app color" onClose={onClose}>
      <div className="form cpick">
        <p className="sub">Pick any color for buttons, highlights and charts across Kwenta.</p>

        <div className="cpick-top">
          <div className="cpick-swatch" style={{ background: hex, color: readableOn(hex) }} aria-hidden="true">
            {hex.slice(1).toUpperCase()}
          </div>
          <label className="cpick-hex">
            <span className="cpick-cap">Hex</span>
            <input
              value={text}
              onChange={(e) => typed(e.target.value)}
              onBlur={() => setText(hex.toUpperCase())}
              maxLength={7}
              spellCheck={false}
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              aria-invalid={invalid}
              aria-describedby="cpick-hint"
            />
            <small id="cpick-hint" className={invalid ? "warnt" : "hint"}>
              {invalid ? "Enter 3 or 6 hex digits, like #D6457B." : "3- or 6-digit hex supported."}
            </small>
          </label>
        </div>

        {sliders.map(({ part, label, max, unit, track }) => (
          <label key={part} className="cpick-row">
            <span className="cpick-label">
              <b>{label}</b>
              <span>
                {hsv[part]}
                {unit}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={hsv[part]}
              onChange={(e) => slide(part, Number(e.target.value))}
              aria-valuetext={`${hsv[part]}${unit === "°" ? " degrees" : " percent"}`}
              style={{ background: track }}
            />
          </label>
        ))}

        {tooLight && <p className="warnt cpick-warn">This color is quite light, so white text on the header and buttons will be hard to read. A deeper color works better.</p>}

        <div className="cpick-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" style={{ background: hex, color: readableOn(hex) }} onClick={() => onUse(hex)}>
            Use color
          </button>
        </div>
      </div>
    </Modal>
  );
}
