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

test("the effective rate counts the one-time fee, and is unchanged without one", () => {
  const noFee = quote(9999.99, 1, 7, 0);
  const withFee = quote(9999.99, 1, 7, 350);
  assert.ok(Math.abs(noFee.effAnnual - 20.65) < 0.1, String(noFee.effAnnual));
  // Hand check: you get 9,649.99 for seven payments of 1,528.57, which is about 2.65% a month (31.8% a year).
  assert.ok(Math.abs(withFee.effAnnual - 31.81) < 0.2, String(withFee.effAnnual));
  assert.ok(withFee.effAnnual > noFee.effAnnual);
  // A 0% plan with a fee still has a real cost.
  assert.ok(quote(6000, 0, 6, 300).effAnnual > 0);
  assert.equal(quote(6000, 0, 6, 0).effAnnual, 0);
});

test("BPI and RCBC programs match what the banks publish", () => {
  for (const id of ["bpi-installment", "bpi-balance-transfer", "bpi-balance-conversion"]) {
    const p = programsFor("bpi-cc").find((x) => x.id === id)!;
    assert.equal(rateFor(p, 36), 0.99, id + " 36 months");
    assert.equal(rateFor(p, 12), 1, id + " 12 months");
    assert.equal(p.fee(50000), 500);
    assert.equal(p.fee(50001), 700);
  }
  // Credit-to-Cash and Balance Transfer start at 6 months (no 3 or 9); Balance Conversion has 3 and 9.
  assert.deepEqual(programsFor("bpi-cc").find((x) => x.id === "bpi-installment")!.terms, [6, 12, 18, 24, 36]);
  assert.ok(programsFor("bpi-cc").find((x) => x.id === "bpi-balance-conversion")!.terms.includes(3));
  const insta = programsFor("rcbc-cc").find((x) => x.id === "rcbc-instacash")!;
  assert.equal(insta.fee(20000), 500);
  assert.equal(Math.max(...insta.terms), 60);
  assert.ok(programsFor("rcbc-cc").some((x) => x.id === "rcbc-balance-conversion"));
});
