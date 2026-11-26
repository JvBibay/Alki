// Runs in its own process (node --test), so the zone set below cannot leak into other test files.
import "./tzNewYork.testsetup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { periodBounds, type BudgetPeriod } from "./budgets";
import { addDays, periodRange } from "./stats";

const DAY = 86_400_000;
const isMidnight = (t: number) => {
  const d = new Date(t);
  return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
};

test("the test really runs in a daylight-saving zone", () => {
  assert.notEqual(new Date(2026, 0, 1).getTimezoneOffset(), new Date(2026, 6, 1).getTimezoneOffset());
});

test("budget periods start and end at local midnight, back to back, across both clock changes", () => {
  for (const p of ["daily", "weekly", "biweekly", "monthly", "yearly"] as BudgetPeriod[]) {
    for (let t = new Date(2026, 0, 1, 13).getTime(); t < new Date(2027, 0, 1).getTime(); t += DAY) {
      const [a, b] = periodBounds(p, t);
      const day = new Date(t).toDateString();
      assert.ok(a <= t && t < b, `${p} ${day}: now is inside its own period`);
      assert.ok(isMidnight(a) && isMidnight(b), `${p} ${day}: bounds are at local midnight`);
      assert.equal(periodBounds(p, b + 3_600_000)[0], b, `${p} ${day}: the next period starts where this one ends`);
    }
  }
});

test("day and week ranges on the spring-forward and fall-back Sundays", () => {
  for (const [y, m, d] of [[2026, 2, 8], [2026, 10, 1]]) {
    const noon = new Date(y, m, d, 12).getTime();
    for (const p of ["day", "week"] as const) {
      const [a, b] = periodRange(p, noon);
      assert.ok(isMidnight(a) && isMidnight(b), `${p} on ${y}-${m + 1}-${d}`);
    }
  }
});

test("addDays keeps the clock time across a clock change", () => {
  const before = new Date(2026, 2, 7, 9, 30).getTime();
  const after = new Date(addDays(before, 2));
  assert.deepEqual([after.getMonth(), after.getDate(), after.getHours(), after.getMinutes()], [2, 9, 9, 30]);
});

test("the monthly recap counts each calendar day once in a month with a 25-hour day", async () => {
  const { monthRecap } = await import("./recap");
  const { freshState } = await import("./store");
  const s = freshState();
  s.accounts = [{ id: "a", name: "Cash", opening: 0, kind: "cash", color: "#000" }];
  s.defAcc = "a";
  // November 2026 in New York has the fall-back day (Nov 1). Spend on 3 other days; the month is over, so Nov 1 must count once as a no-spend day.
  s.txs = [2, 3, 4].map((d, i) => ({ id: "t" + i, type: "expense" as const, amount: 10, cat: "Food", note: "x", acc: "a", date: new Date(2026, 10, d, 12).getTime() }));
  const r = monthRecap(s, 2026, 10, new Date(2026, 11, 5).getTime());
  assert.equal(r.daysInMonth, 30);
  assert.equal(r.noSpendDays, 27, "30 days minus the 3 with spending");
});
