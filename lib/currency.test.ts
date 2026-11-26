import { test } from "node:test";
import assert from "node:assert/strict";
import { coinSymbol, convert, defaultFx, formatMoney, pairRate } from "./currency";

const fx = defaultFx();

test("converts via USD rates", () => {
  assert.equal(convert(100, "USD", "USD", fx), 100);
  assert.ok(Math.abs(convert(1, "USD", "PHP", fx) - 63.684) < 0.001);
  assert.ok(Math.abs(convert(63.684, "PHP", "USD", fx) - 1) < 0.0001);
  // SAR is pegged at 3.75/USD
  assert.ok(Math.abs(pairRate("SAR", "PHP", fx) - 63.684 / 3.75) < 0.001);
});

test("formats with each currency's symbol and decimals", () => {
  assert.equal(formatMoney(1250.5, "PHP"), "₱1,250.50");
  assert.equal(formatMoney(1250, "PHP"), "₱1,250");
  assert.equal(coinSymbol("PHP"), "₱");
  assert.equal(coinSymbol("HKD"), "$");
  assert.equal(coinSymbol("CNY"), "¥");
  assert.equal(coinSymbol("MYR"), "RM");
  assert.equal(coinSymbol("AED"), "AED");
  assert.equal(coinSymbol(undefined), "₱");
  assert.equal(formatMoney(12000.4, "JPY"), "¥12,000");
  assert.equal(formatMoney(1.25, "KWD"), "KWD 1.250");
  assert.equal(formatMoney(-50, "USD"), "−$50");
});
