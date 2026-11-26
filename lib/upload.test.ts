import { test } from "node:test";
import assert from "node:assert/strict";
import { assertImage, assertUploadable, imageSize, MAX_UPLOAD_BYTES, sniffImage } from "./upload";
import { clientKey, rateLimit } from "./ratelimit";

const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};
const jpeg = (w: number, h: number) => {
  const b = new Uint8Array(40);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x0b, 8, h >> 8, h & 255, w >> 8, w & 255, 3]);
  return b;
};
const blob = (b: Uint8Array, type = "image/jpeg") => new Blob([b as BlobPart], { type });

test("file types come from the bytes, not the name or declared type", () => {
  assert.equal(sniffImage(png(10, 10)), "png");
  assert.equal(sniffImage(jpeg(10, 10)), "jpeg");
  assert.equal(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")), null);
  assert.equal(sniffImage(new TextEncoder().encode("MZ\x90\x00 an exe")), null);
  assert.equal(sniffImage(new TextEncoder().encode("%PDF-1.7")), null);
});

test("sizes are read from the header", () => {
  assert.deepEqual(imageSize(png(640, 480), "png"), { w: 640, h: 480 });
  assert.deepEqual(imageSize(jpeg(1280, 720), "jpeg"), { w: 1280, h: 720 });
});

test("assertImage rejects fakes, empties, oversize files and pixel bombs", async () => {
  await assert.doesNotReject(assertImage(blob(png(800, 600), "image/png")));
  await assert.rejects(assertImage(new Blob([])), /empty/);
  await assert.rejects(assertImage(blob(new TextEncoder().encode("<svg></svg>"), "image/png")), /photo or screenshot/);
  await assert.rejects(assertImage(blob(png(50_000, 50_000), "image/png")), /too many pixels/);
  await assert.rejects(assertImage(blob(png(10, 10)), 5), /too large/);
});

test("only a small JPEG may be uploaded to the cloud", async () => {
  await assert.doesNotReject(assertUploadable(blob(jpeg(100, 100))));
  await assert.rejects(assertUploadable(blob(png(10, 10), "image/jpeg")), /JPEG/);
  await assert.rejects(assertUploadable(new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)])), /too large/);
});

test("the rate limiter allows a burst, then block until the window passes", () => {
  assert.equal(rateLimit("t", 1, 1000, 0).ok, true);
  const r = rateLimit("t", 1, 1000, 100);
  assert.equal(r.ok, false);
  assert.equal(r.retryAfter, 1);
  assert.equal(rateLimit("t", 1, 1000, 1200).ok, true);
});

test("a spoofed first x-forwarded-for entry cannot pick the rate-limit key", () => {
  const req = (h: Record<string, string>) => new Request("http://x/api/parse", { headers: h });
  // The client sent "1.1.1.1"; our proxy recorded the real peer last.
  assert.equal(clientKey(req({ "x-forwarded-for": "1.1.1.1, 9.9.9.9" })), "9.9.9.9");
  assert.equal(clientKey(req({ "x-forwarded-for": "2.2.2.2, 9.9.9.9" })), "9.9.9.9");
  // Platform headers win over anything the client could add.
  assert.equal(clientKey(req({ "x-vercel-forwarded-for": "8.8.8.8", "x-forwarded-for": "1.1.1.1" })), "8.8.8.8");
  assert.equal(clientKey(req({})), "unknown");
});
