import { test } from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import { findQrBox, withMargin } from "./qr";

/** Draws a real QR code into a bigger "screenshot" of grey background, with a few distractions around it. */
function screenshot(opts: { w: number; h: number; x: number; y: number; module: number; text: string; invert?: boolean }) {
  const qr = QRCode.create(opts.text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const { w, h } = opts;
  const data = new Uint8ClampedArray(w * h * 4);
  const put = (x: number, y: number, v: number) => {
    const i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, 235); // light grey app background
  // some dark "buttons" and text-like bars, to make sure the finder isn't fooled by them
  for (let y = 40; y < 70; y++) for (let x = 40; x < w - 40; x++) put(x, y, 60);
  for (let y = h - 120; y < h - 60; y++) for (let x = 60; x < w - 60; x++) put(x, y, 90);
  const q = 4 * opts.module; // quiet zone
  for (let y = -q; y < n * opts.module + q; y++) for (let x = -q; x < n * opts.module + q; x++) put(opts.x + x, opts.y + y, opts.invert ? 0 : 255);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const dark = qr.modules.get(r, c) === 1;
      const v = dark !== !!opts.invert ? 0 : 255;
      for (let dy = 0; dy < opts.module; dy++) for (let dx = 0; dx < opts.module; dx++) put(opts.x + c * opts.module + dx, opts.y + r * opts.module + dy, v);
    }
  return { data, w, h, n, side: n * opts.module };
}

const PAYLOAD = "00020101021128670011ph.ppmi.p2m0111GXCHPHM2XXX03153FC0000000012345204601653036085802PH5909JOSE BIBAY6006TAGUIG6304ABCD";

test("finds a QR in a phone-sized screenshot and boxes it", () => {
  const s = screenshot({ w: 540, h: 1200, x: 120, y: 380, module: 6, text: PAYLOAD });
  const f = findQrBox(s.data, s.w, s.h);
  assert.ok(f, "should find the QR");
  const tol = s.side * 0.06;
  assert.ok(Math.abs(f!.box.size - s.side) < tol, `size ${f!.box.size.toFixed(1)} vs ${s.side}`);
  assert.ok(Math.abs(f!.box.x - 120) < tol, `x ${f!.box.x.toFixed(1)}`);
  assert.ok(Math.abs(f!.box.y - 380) < tol, `y ${f!.box.y.toFixed(1)}`);
  assert.equal(f!.modules, s.n, "knows how many modules it has");
});

test("a QR in a different place is found there", () => {
  const s = screenshot({ w: 600, h: 900, x: 300, y: 500, module: 5, text: PAYLOAD });
  const f = findQrBox(s.data, s.w, s.h)!;
  assert.ok(Math.abs(f.box.x - 300) < s.side * 0.06);
  assert.ok(Math.abs(f.box.y - 500) < s.side * 0.06);
});

test("a light-on-dark (inverted) QR is still found", () => {
  const s = screenshot({ w: 540, h: 900, x: 150, y: 300, module: 6, text: PAYLOAD, invert: true });
  assert.ok(findQrBox(s.data, s.w, s.h));
});

test("no QR means null, not a wrong guess", () => {
  const w = 400;
  const h = 600;
  const data = new Uint8ClampedArray(w * h * 4).fill(210);
  for (let y = 100; y < 160; y++) for (let x = 50; x < 350; x++) data.fill(40, (y * w + x) * 4, (y * w + x) * 4 + 3);
  assert.equal(findQrBox(data, w, h), null);
});

test("the crop gets the QR's own margin, and stays inside the picture", () => {
  const box = { x: 100, y: 100, size: 200 };
  const m = withMargin(box, 41, 1000, 1000); // 41 modules: each ~4.9px, two modules of margin each side
  assert.ok(m.size > 200 && m.size < 230);
  assert.ok(m.x < 100 && m.y < 100);
  // near the corner of the picture, it's pushed back inside
  const edge = withMargin({ x: 2, y: 2, size: 200 }, 41, 400, 400);
  assert.ok(edge.x >= 0 && edge.y >= 0 && edge.x + edge.size <= 400 && edge.y + edge.size <= 400);
  // never bigger than the picture
  assert.ok(withMargin({ x: 0, y: 0, size: 300 }, null, 300, 300).size <= 300);
});
