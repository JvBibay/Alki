import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "./store";
import { daysSinceChecked, reconcileHints } from "./reconcile";

const DAY = 86_400_000;
const now = Date.now();

function make(extra: Record<string, unknown> = {}) {
  const s = normalize({
    accounts: [{ id: "a1", name: "GCash", opening: 1000, kind: "ewallet", color: "#2563eb", ...extra }],
    txs: [
      { id: "t1", type: "expense", amount: 200, cat: "Food", note: "Lunch", acc: "a1", date: now - DAY },
      { id: "t2", type: "expense", amount: 150, cat: "Transport", note: "Grab", acc: "a1", date: now - 2 * DAY },
      { id: "old", type: "expense", amount: 999, cat: "Shopping", note: "Old", acc: "a1", date: now - 200 * DAY },
    ],
  });
  assert.ok(s);
  return s!;
}

test("a matching balance needs no hints", () => {
  const s = make();
  assert.deepEqual(reconcileHints(s, s.accounts[0], 0, now), []);
});

test("an entry logged as spending that was income is found as flipped", () => {
  const s = make();
  // Lunch (−200) was really +200, so the bank has 400 more than Kwenta.
  const h = reconcileHints(s, s.accounts[0], 400, now);
  assert.equal(h[0].kind, "flipped");
  assert.equal(h[0].tx?.id, "t1");
});

test("an entry the bank doesn't have is found as extra", () => {
  const s = make();
  // The bank has 150 more than Kwenta: the Grab entry never happened here.
  const h = reconcileHints(s, s.accounts[0], 150, now);
  assert.equal(h[0].kind, "extra");
  assert.equal(h[0].tx?.id, "t2");
});

test("old entries are ignored and an unlogged amount is always offered", () => {
  const s = make();
  const h = reconcileHints(s, s.accounts[0], 999, now);
  assert.deepEqual(h.map((x) => x.kind), ["missing"]);
});

test("floating point sums still match", () => {
  const s = normalize({
    accounts: [{ id: "a1", name: "Bank", opening: 0, kind: "bank", color: "#000" }],
    txs: [{ id: "t", type: "expense", amount: 0.1 + 0.2, cat: "Food", note: "", acc: "a1", date: now }],
  })!;
  assert.equal(reconcileHints(s, s.accounts[0], 0.3, now)[0].kind, "extra");
});

test("last checked survives saving and bad values are dropped", () => {
  const s = make({ checkedAt: now - 3 * DAY });
  const again = normalize(JSON.parse(JSON.stringify(s)))!;
  assert.equal(daysSinceChecked(again.accounts[0], now), 3);
  assert.equal(daysSinceChecked(make({ checkedAt: "x" }).accounts[0], now), null);
});
