import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPayday } from "./stats";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10).getTime();
const day = (r: { date: Date }) => `${r.date.getMonth() + 1}/${r.date.getDate()}`;

test("monthly", () => {
  assert.equal(day(nextPayday({ payFreq: "monthly", payday: [25] }, at(2026, 11, 18))), "11/25");
  assert.equal(day(nextPayday({ payFreq: "monthly", payday: [10] }, at(2026, 11, 18))), "12/10");
});

test("twice a month (kinsenas), 30th clamps to month end", () => {
  assert.equal(day(nextPayday({ payFreq: "semimonthly", payday: [15, 30] }, at(2026, 11, 18))), "11/30");
  assert.equal(day(nextPayday({ payFreq: "semimonthly", payday: [15, 30] }, at(2027, 2, 16))), "2/28");
  assert.equal(nextPayday({ payFreq: "semimonthly", payday: [15, 30] }, at(2026, 11, 15)).daysLeft, 0);
});

test("old data without payFreq is inferred", () => {
  assert.equal(day(nextPayday({ payday: [15, 30] }, at(2026, 11, 18))), "11/30");
  assert.equal(day(nextPayday({ payday: [5] }, at(2026, 11, 18))), "12/5");
});

test("weekly", () => {
  // Wed Nov 18, 2026 -> next Friday Nov 20
  const r = nextPayday({ payFreq: "weekly", payday: [], payWeekday: 5 }, at(2026, 11, 18));
  assert.equal(day(r), "11/20");
  assert.equal(r.daysLeft, 2);
});

test("every 2 weeks lines up with a known payday", () => {
  // Known payday Fri Nov 13 -> next is Fri Nov 27, not Nov 20
  assert.equal(day(nextPayday({ payFreq: "biweekly", payday: [], payWeekday: 5, payAnchor: at(2026, 11, 13) }, at(2026, 11, 18))), "11/27");
  // Known payday Fri Nov 6 -> Nov 20
  assert.equal(day(nextPayday({ payFreq: "biweekly", payday: [], payWeekday: 5, payAnchor: at(2026, 11, 6) }, at(2026, 11, 18))), "11/20");
});
