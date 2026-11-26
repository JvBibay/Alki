import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, depositMath, depositStatus } from "./deposits";
import type { Account } from "./types";

test("interest after 20% tax", () => {
  // ₱50,000 at 6% for 6 months: ₱1,500 gross, ₱300 tax, ₱1,200 net
  assert.deepEqual(depositMath(50000, 6, 6), { gross: 1500, tax: 300, net: 1200, atMaturity: 51200 });
  assert.deepEqual(depositMath(100000, 4.5, 12), { gross: 4500, tax: 900, net: 3600, atMaturity: 103600 });
});

test("maturity keeps the day and clamps short months", () => {
  const d = (ts: number) => { const x = new Date(ts); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`; };
  assert.equal(d(addMonths(new Date(2026, 10, 18).getTime(), 6)), "2027-5-18");
  assert.equal(d(addMonths(new Date(2027, 0, 31).getTime(), 1)), "2027-2-28");
});

test("status: countdown, progress and matured", () => {
  const acc: Account = { id: "t", name: "Maya TD", opening: 0, kind: "locked", color: "#000", deposit: { principal: 50000, rate: 6, months: 6, start: new Date(2026, 10, 18, 12).getTime(), tax: 20, status: "locked" } };
  const s1 = depositStatus(acc, new Date(2026, 10, 18, 9).getTime())!;
  assert.equal(s1.matured, false);
  assert.equal(s1.left, "6 months left");
  assert.equal(s1.progress, 0);
  const s2 = depositStatus(acc, new Date(2027, 0, 30, 9).getTime())!;
  assert.equal(s2.left, "3 months 18 days left"); // Jan 30 → Apr 30 → May 18
  assert.ok(s2.progress > 0.3 && s2.progress < 0.5);
  const s3 = depositStatus(acc, new Date(2027, 4, 18, 9).getTime())!;
  assert.equal(s3.matured, true);
  assert.equal(s3.daysLeft, 0);
});
