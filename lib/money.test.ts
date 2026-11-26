import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMoney, formatMoneyTyping } from "./money";

test("cleans typed amounts", () => {
  assert.equal(cleanMoney("₱25,000.50"), "25000.50");
  assert.equal(cleanMoney("1,2,3"), "123");
  assert.equal(cleanMoney("12.345"), "12.34");
  assert.equal(cleanMoney("1.2.3"), "1.23");
  assert.equal(cleanMoney(".5"), "0.5");
  assert.equal(cleanMoney("0005"), "5");
  assert.equal(cleanMoney("abc"), "");
});

test("adds commas while typing", () => {
  assert.equal(formatMoneyTyping("25000"), "25,000");
  assert.equal(formatMoneyTyping("1234567.8"), "1,234,567.8");
  assert.equal(formatMoneyTyping("25000."), "25,000.");
  assert.equal(formatMoneyTyping("999"), "999");
  assert.equal(formatMoneyTyping(""), "");
});

test("respects currency decimals", () => {
  assert.equal(cleanMoney("12000.5", 0), "12000"); // yen: no decimals
  assert.equal(cleanMoney("1.2345", 3), "1.234");
});
