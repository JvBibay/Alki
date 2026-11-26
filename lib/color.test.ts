import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast, hexToHsv, hsvToHex, luminance, normalizeHex, readableOn } from "./color";

test("normalizeHex accepts 3- and 6-digit hex, with or without #, any case", () => {
  assert.equal(normalizeHex("#D6B6C2"), "#d6b6c2");
  assert.equal(normalizeHex("d6b6c2"), "#d6b6c2");
  assert.equal(normalizeHex(" #abc "), "#aabbcc");
  assert.equal(normalizeHex("F0A"), "#ff00aa");
});

test("normalizeHex rejects anything else", () => {
  for (const bad of ["", "#", "#12", "#1234", "#12345", "#1234567", "#ggg", "red", "#12 345", "##abc"]) assert.equal(normalizeHex(bad), null, bad);
});

test("known colors convert to the expected hue, saturation and brightness", () => {
  assert.deepEqual(hexToHsv("#ff0000"), { h: 0, s: 100, v: 100 });
  assert.deepEqual(hexToHsv("#00ff00"), { h: 120, s: 100, v: 100 });
  assert.deepEqual(hexToHsv("#0000ff"), { h: 240, s: 100, v: 100 });
  assert.deepEqual(hexToHsv("#ffffff"), { h: 0, s: 0, v: 100 });
  assert.deepEqual(hexToHsv("#000000"), { h: 0, s: 0, v: 0 });
  assert.deepEqual(hexToHsv("#808080"), { h: 0, s: 0, v: 50 });
  // The color in the reference screenshot: #D6B6C2 is hue 338, saturation 15%, brightness 84%.
  assert.deepEqual(hexToHsv("#d6b6c2"), { h: 338, s: 15, v: 84 });
  // Kwenta's default custom color.
  assert.deepEqual(hexToHsv("#d6457b"), { h: 338, s: 68, v: 84 });
});

test("hsvToHex is the inverse for the same known colors", () => {
  assert.equal(hsvToHex({ h: 0, s: 100, v: 100 }), "#ff0000");
  assert.equal(hsvToHex({ h: 120, s: 100, v: 100 }), "#00ff00");
  assert.equal(hsvToHex({ h: 240, s: 100, v: 100 }), "#0000ff");
  assert.equal(hsvToHex({ h: 60, s: 100, v: 100 }), "#ffff00");
  assert.equal(hsvToHex({ h: 0, s: 0, v: 100 }), "#ffffff");
  assert.equal(hsvToHex({ h: 123, s: 50, v: 0 }), "#000000");
  assert.equal(hsvToHex({ h: 338, s: 15, v: 84 }), "#d6b6c2");
});

test("out-of-range values are clamped and hue wraps", () => {
  assert.equal(hsvToHex({ h: 360, s: 100, v: 100 }), "#ff0000");
  assert.equal(hsvToHex({ h: -120, s: 100, v: 100 }), "#0000ff");
  assert.equal(hsvToHex({ h: 0, s: 500, v: 500 }), "#ff0000");
  assert.equal(hsvToHex({ h: 0, s: -5, v: -5 }), "#000000");
});

test("hex -> HSV -> hex stays within one step per channel for every color we sample", () => {
  // HSV is held in whole numbers, so a round trip may move a channel by a few units; it must never jump further.
  let worst = 0;
  for (let r = 0; r < 256; r += 15) {
    for (let g = 0; g < 256; g += 15) {
      for (let b = 0; b < 256; b += 15) {
        const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
        const back = hsvToHex(hexToHsv(hex));
        for (let i = 0; i < 3; i++) worst = Math.max(worst, Math.abs(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) - parseInt(back.slice(1 + i * 2, 3 + i * 2), 16)));
      }
    }
  }
  assert.ok(worst <= 6, `largest channel drift ${worst}`);
});

test("a gray keeps the hue you were on", () => {
  assert.equal(hexToHsv("#000000", 200).h, 200);
  assert.equal(hexToHsv("#ffffff", 200).h, 200);
  assert.equal(hexToHsv("#ff0000", 200).h, 0, "a real color ignores the fallback");
});

test("contrast and readable text", () => {
  assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01);
  assert.equal(luminance("#000000"), 0);
  assert.ok(Math.abs(luminance("#ffffff") - 1) < 1e-9);
  assert.equal(readableOn("#ffffff"), "#000000");
  assert.equal(readableOn("#000000"), "#ffffff");
  assert.equal(readableOn("#d6b6c2"), "#000000", "the pale pink in the screenshot needs dark text");
  assert.equal(readableOn("#2f7a4d"), "#ffffff", "Forest green needs white text");
});
