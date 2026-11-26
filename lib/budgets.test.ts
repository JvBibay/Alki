import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetList, periodBounds } from "./budgets";
import { freshState } from "./store";

const NOW = new Date(2026, 10, 18, 12).getTime(); // Wed Nov 18 2026
const D = 86_400_000;
const day = (ts: number) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; };

test("period bounds", () => {
  assert.deepEqual(periodBounds("daily", NOW).map(day), ["11/18", "11/19"]);
  assert.deepEqual(periodBounds("weekly", NOW).map(day), ["11/16", "11/23"]); // Mon–Sun
  assert.deepEqual(periodBounds("monthly", NOW).map(day), ["11/1", "12/1"]);
  assert.deepEqual(periodBounds("yearly", NOW).map(day), ["1/1", "1/1"]);
  const [a, b] = periodBounds("biweekly", NOW);
  assert.equal(Math.round((b - a) / D), 14);
  assert.equal(new Date(a).getDay(), 1); // starts on a Monday
  assert.ok(a <= NOW && NOW < b);
});

test("each budget counts only its own period", () => {
  const s = freshState();
  s.budgets = { Food: 1000, Fun: 500 };
  s.budgetPeriods = { Food: "weekly" };
  s.txs = [
    { id: "1", type: "expense", amount: 300, cat: "Food", note: "", acc: "a1", date: NOW - 1 * D }, // this week
    { id: "2", type: "expense", amount: 400, cat: "Food", note: "", acc: "a1", date: NOW - 6 * D }, // last week
    { id: "3", type: "expense", amount: 450, cat: "Fun", note: "", acc: "a1", date: NOW - 10 * D }, // this month
  ];
  const [food, fun] = budgetList(s, NOW);
  assert.equal(food.period, "weekly");
  assert.equal(food.spent, 300);
  assert.equal(fun.period, "monthly");
  assert.equal(fun.spent, 450);
  assert.equal(Math.round(fun.pct), 90);
});

test("pace: on track at or under the elapsed share, fast when ahead, over past the limit", async () => {
  const { paceOf } = await import("./budgets");
  const b = (spent: number, elapsed: number) => ({ spent, limit: 1000, pct: (spent / 1000) * 100, elapsed });
  assert.equal(paceOf(b(400, 0.5)), "ok"); // 40% spent, half the period gone
  assert.equal(paceOf(b(520, 0.5)), "ok"); // within the 5-point slack
  assert.equal(paceOf(b(700, 0.5)), "fast"); // ahead of the clock
  assert.equal(paceOf(b(1200, 0.9)), "over");
});

test("weekday labels are two letters, so Tuesday and Thursday differ", async () => {
  const { weekdayShort } = await import("./format");
  const days = [24, 25, 26, 27, 28, 29, 30].map((d) => weekdayShort(new Date(2026, 10, d, 12)));
  assert.deepEqual(days, ["Tu", "We", "Th", "Fr", "Sa", "Su", "Mo"]);
});
