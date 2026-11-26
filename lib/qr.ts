import jsQR from "jsqr";

/**
 * Finding and cropping a QR code in a screenshot. The QR is located with a small decoder (jsQR), the
 * picture is cropped to it, and a white margin is added so it scans easily when shown on a reminder card.
 * Everything happens on this device.
 */

export interface Box {
  x: number;
  y: number;
  /** Side length: a QR code is square. */
  size: number;
}

export interface Found {
  box: Box;
  /** Modules per side, when known (used to size the margin). */
  modules: number | null;
}

/** Looks for a QR code in raw RGBA pixels. Returns a square box around the symbol, or null if none is found. */
export function findQrBox(data: Uint8ClampedArray, width: number, height: number): Found | null {
  const r = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  if (!r) return null;
  const { topLeftCorner: a, topRightCorner: b, bottomRightCorner: c, bottomLeftCorner: d } = r.location;
  const xs = [a.x, b.x, c.x, d.x];
  const ys = [a.y, b.y, c.y, d.y];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const size = Math.max(maxX - minX, maxY - minY);
  if (!(size > 8)) return null;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { box: { x: cx - size / 2, y: cy - size / 2, size }, modules: typeof r.version === "number" && r.version > 0 ? 17 + 4 * r.version : null };
}

/** Pixels of an image, optionally shrunk so its longest side is at most `max` (detection stays fast on big screenshots). */
function pixels(img: HTMLImageElement, max: number) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h, s };
}

/** Finds the QR in a picture, trying a shrunk copy first (fast) and then the full size. Boxes are in the picture's own pixels. */
export function detectInImage(img: HTMLImageElement): Found | null {
  for (const max of [1400, 3000]) {
    const { data, w, h, s } = pixels(img, max);
    const f = findQrBox(data, w, h);
    if (f) return { box: { x: f.box.x / s, y: f.box.y / s, size: f.box.size / s }, modules: f.modules };
    if (s === 1) break; // already at full size
  }
  return null;
}

/** The part of the image to keep, with the QR's own quiet-zone margin added (bounded to the picture). */
export function withMargin(box: Box, modules: number | null, imgW: number, imgH: number): Box {
  const margin = modules ? (box.size / modules) * 2 : box.size * 0.04;
  const size = Math.min(box.size + 2 * margin, imgW, imgH);
  const x = Math.min(Math.max(0, box.x - (size - box.size) / 2), imgW - size);
  const y = Math.min(Math.max(0, box.y - (size - box.size) / 2), imgH - size);
  return { x, y, size };
}

/**
 * Draws the chosen square onto a white canvas with a clean white border around it, so the QR keeps the
 * empty "quiet zone" scanners need even when the crop was tight or the original had a coloured frame.
 */
export function cropToCanvas(img: HTMLImageElement, box: Box, pad = 0.1): HTMLCanvasElement {
  const border = Math.round(box.size * pad);
  const side = Math.round(box.size) + 2 * border;
  const c = document.createElement("canvas");
  c.width = side;
  c.height = side;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, side, side);
  // Keep the source inside the picture (a box dragged past the edge would otherwise draw nothing).
  const sx = Math.max(0, box.x);
  const sy = Math.max(0, box.y);
  const sw = Math.min(img.naturalWidth - sx, box.size - (sx - box.x));
  const sh = Math.min(img.naturalHeight - sy, box.size - (sy - box.y));
  if (sw > 0 && sh > 0) ctx.drawImage(img, sx, sy, sw, sh, border + (sx - box.x), border + (sy - box.y), sw, sh);
  cleanGrays(c);
  return c;
}

/**
 * Screenshots (especially JPEGs) put faint grey noise around the black squares of a QR, which makes the saved
 * picture big and slightly blurry. Greys are snapped to pure black or white; coloured pixels (a bank's logo in
 * the middle, for example) are left alone.
 */
function cleanGrays(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) < 48) {
      const v = (r * 299 + g * 587 + b * 114) / 1000 < 140 ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(im, 0, 0);
}

/** A small PNG data URL of the canvas (QR codes are two-colour, so PNG stays crisp and compact). */
export function toStoredPng(canvas: HTMLCanvasElement): string {
  let url = "";
  for (const max of [720, 560, 420]) {
    const s = Math.min(1, max / canvas.width);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(canvas.width * s));
    c.height = Math.max(1, Math.round(canvas.height * s));
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false; // keep the squares sharp
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    url = c.toDataURL("image/png");
    if (url.length <= 350_000) return url;
  }
  return url;
}

/** Whether a canvas still decodes as a QR code (checked on the final picture, so the user knows it works). */
export function scans(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return findQrBox(data, width, height) !== null;
}
