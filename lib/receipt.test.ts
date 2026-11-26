import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReceipt } from "./receipt";

const NOW = new Date(2026, 10, 18, 15).getTime();

test("supermarket receipt: picks TOTAL, not subtotal, cash or change", () => {
  const text = `PUREGOLD PRICE CLUB INC
Puregold Jr. Taft
VAT REG TIN 000-123-456-000
11/18/2026 2:41PM
NESCAFE 3IN1 28G 10S      89.50
LUCKY ME PANCIT CANTON    15.25
EGGS LARGE 12S           112.00
SUBTOTAL                 216.75
TOTAL                    216.75
CASH                     500.00
CHANGE                   283.25
VATABLE SALES            193.53`;
  const r = parseReceipt(text, NOW);
  assert.equal(r.amount, 216.75);
  assert.equal(r.how, "total-line");
  assert.equal(r.merchant, "Puregold Price Club");
  assert.equal(r.cat, "Food");
  assert.equal(new Date(r.date!).getDate(), 18);
});

test("restaurant: AMOUNT DUE beats a plain total, thousands with commas", () => {
  const text = `Samgyupsal Republic
Date: Nov 15, 2026
Unli Pork Set x3        1,497.00
Total                   1,497.00
Service Charge             149.70
AMOUNT DUE              1,646.70`;
  const r = parseReceipt(text, NOW);
  assert.equal(r.amount, 1646.7);
  assert.equal(new Date(r.date!).getDate(), 15);
});

test("pharmacy and gas station categories", () => {
  assert.equal(parseReceipt("MERCURY DRUG CORP\nBIOGESIC 500MG 10S 45.00\nTOTAL 45.00", NOW).cat, "Health");
  assert.equal(parseReceipt("SHELL PILIPINAS\nV-POWER 20.5L\nAMOUNT DUE 1,230.00", NOW).cat, "Transport");
});

test("no total line: falls back to the largest amount", () => {
  const r = parseReceipt("Kape Tayo\nLatte 160.00\nCroissant 95.00\n255.00\nCash 300.00\nChange 45.00", NOW);
  assert.equal(r.amount, 255);
  assert.equal(r.how, "largest");
});

test("OCR quirks: comma as decimal, peso sign, amount on next line", () => {
  assert.equal(parseReceipt("TOTAL\n₱ 89,50", NOW).amount, 89.5);
  assert.equal(parseReceipt("GRAND TOTAL P1 234.00", NOW).amount, 1234);
});

test("ignores future or very old dates", () => {
  assert.equal(parseReceipt("TOTAL 10.00\n12/25/2027", NOW).date, undefined);
});
