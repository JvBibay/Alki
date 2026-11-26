import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform } from "./install";

test("phones are recognised, including iPads that look like Macs", () => {
  assert.equal(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120", 5), "android");
  assert.equal(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", 5), "ios");
  assert.equal(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 5), "ios", "iPadOS");
  assert.equal(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120", 0), "other", "a real Mac");
  assert.equal(detectPlatform("Mozilla/5.0 (Windows NT 10.0) Chrome/120", 0), "other");
});
