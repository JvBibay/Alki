import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "./store";
import { balance, forecast, keptBase, sumRange } from "./stats";

const DAY = 86_400_000;
const now = Date.now();

function make(extra: Record<string, unknown> = {}) {
  const s = normalize({
    accounts: [{ id: "a1", name: "BPI Savings", opening: 10_000, kind: "bank", color: "#e11d48", ...extra }],
    txs: [
      { id: "t1", type: "expense", amount: 500, cat: "Food", note: "Lunch", acc: "a1", date: now - DAY },
      { id: "t2", type: "income", amount: 300, cat: "Adjustment", note: "Balance adjustment", acc: "a1", date: now - DAY },
      { id: "t3", type: "expense", amount: 200, cat: "Adjustment", note: "Balance adjustment", acc: "a1", date: now - DAY },
    ],
  });
  assert.ok(s, "state should load");
  return s!;
}

test("balance adjustments change the balance but are not income or spending", () => {
  const s = make();
  // 10,000 − 500 lunch + 300 − 200 adjustments
  assert.equal(balance(s, s.accounts[0]), 9_600);
  const sums = sumRange(s, now - 2 * DAY, now + DAY);
  assert.equal(sums.expense, 500, "only the lunch counts as spending");
  assert.equal(sums.income, 0, "the adjustment is not income");
  assert.deepEqual(Object.keys(sums.cats), ["Food"]);
});

test("a maintaining balance is kept aside from what you can spend", () => {
  const plain = make();
  const kept = make({ maintaining: 2_000 });
  assert.equal(keptBase(plain, plain.accounts[0]), 0);
  assert.equal(keptBase(kept, kept.accounts[0]), 2_000);
  assert.equal(forecast(plain).liquid - forecast(kept).liquid, 2_000);
});

test("maintaining balance and interest settings survive saving and restoring", () => {
  const s = make({ maintaining: 2_000, rate: 3.5, tax: 20 });
  const again = normalize(JSON.parse(JSON.stringify(s)))!;
  const a = again.accounts[0];
  assert.equal(a.maintaining, 2_000);
  assert.equal(a.rate, 3.5);
  assert.equal(a.tax, 20);
});

test("bad values for the new fields are dropped", () => {
  const s = make({ maintaining: -5, rate: "high", tax: -1 });
  const a = s.accounts[0];
  assert.equal(a.maintaining, undefined);
  assert.equal(a.rate, undefined);
  assert.equal(a.tax, undefined);
});
