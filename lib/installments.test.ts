import { test } from "node:test";
import assert from "node:assert/strict";
import { dueDate, programsFor, quote, rateFor } from "./installments";

test("add-on math: ₱12,000 over 12 months at 1%", () => {
  const q = quote(12000, 1, 12, 350);
  assert.equal(q.monthly, 1120);
  assert.equal(q.interestPart, 120);
  assert.equal(q.totalInterest, 1440);
  assert.equal(q.totalCost, 12000 + 1440 + 350);
});

test("effective rate matches BDO's published figures for 1% add-on", () => {
  // BDO Cash Installment calculator: 17.92% a year at 3 months, 21.58% at 24 months.
  assert.ok(Math.abs(quote(10000, 1, 3).effAnnual - 17.92) < 0.1, String(quote(10000, 1, 3).effAnnual));
  assert.ok(Math.abs(quote(10000, 1, 24).effAnnual - 21.58) < 0.1, String(quote(10000, 1, 24).effAnnual));
});

test("0% installment has no interest", () => {
  const q = quote(9000, 0, 6);
  assert.equal(q.monthly, 1500);
  assert.equal(q.effMonthly, 0);
});

test("bank programs and per-term rates", () => {
  const bpi = programsFor("bpi-cc").find((p) => p.id === "bpi-balance-transfer")!;
  assert.equal(rateFor(bpi, 36), 0.99);
  assert.equal(rateFor(bpi, 12), 1);
  const bdo = programsFor("bdo-cc").find((p) => p.id === "bdo-purchase-convert")!;
  assert.equal(bdo.fee(15000), 100);
  assert.equal(bdo.fee(25000), 200);
  assert.equal(programsFor("hsbc-cc")[1].id, "generic");
});

test("due dates keep the day and clamp short months", () => {
  const start = new Date(2026, 0, 31).getTime();
  assert.equal(dueDate(start, 1).getDate(), 28); // Feb 2026
  assert.equal(dueDate(start, 2).getDate(), 31); // Mar
});
