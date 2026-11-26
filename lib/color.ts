/** Color maths for the custom app color picker: hex <-> hue / saturation / brightness (HSV). */

export interface Hsv {
  /** 0–360 */
  h: number;
  /** 0–100 */
  s: number;
  /** 0–100 */
  v: number;
}

/** "#abc", "abc", "#AABBCC" or "aabbcc" -> "#aabbcc", or null when it isn't a 3- or 6-digit hex color. */
export function normalizeHex(input: string): string | null {
  const t = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(t)) return ("#" + t.split("").map((c) => c + c).join("")).toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(t)) return ("#" + t).toLowerCase();
  return null;
}

/**
 * Hex -> HSV (whole numbers). A gray has no hue, so `fallbackHue` is kept for it:
 * dragging brightness down to black and back shouldn't snap the hue slider to red.
 */
export function hexToHsv(hex: string, fallbackHue = 0): Hsv {
  const n = normalizeHex(hex) ?? "#000000";
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = fallbackHue;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h: Math.round(h) % 360, s: Math.round(max === 0 ? 0 : (d / max) * 100), v: Math.round(max * 100) };
}

/** HSV -> "#rrggbb". Out-of-range inputs are clamped (hue wraps). */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(100, Math.max(0, s)) / 100;
  const vv = Math.min(100, Math.max(0, v)) / 100;
  const f = (n: number) => {
    const k = (n + hh / 60) % 6;
    return vv - vv * ss * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return "#" + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

/** WCAG relative luminance of a #rrggbb color (0 black … 1 white). */
export function luminance(hex: string): number {
  const n = normalizeHex(hex) ?? "#000000";
  const ch = (i: number) => {
    const c = parseInt(n.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2);
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on top of `bg`. */
export const readableOn = (bg: string) => (contrast(bg, "#ffffff") >= contrast(bg, "#000000") ? "#ffffff" : "#000000");
