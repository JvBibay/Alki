import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "./store";
import { balance, sumRange } from "./stats";
import { creditInfo } from "./cards";
import { dueInterest } from "./interest";

const DAY = 86_400_000;
const now = Date.now();

function make(txs: unknown[], extra: Record<string, unknown> = {}) {
  const s = normalize({
    accounts: [{ id: "c1", name: "Maya Landers", opening: 0, kind: "credit", color: "#000", limit: 19_000, ...extra }],
    txs,
  });
  assert.ok(s);
  return s!;
}

const real = { id: "t1", type: "expense", amount: 3_186.7, cat: "Shopping", note: "Real card charges", acc: "c1", date: now - DAY };
const lent = [51, 81, 96.1].map((amount, i) => ({ id: `l${i}`, type: "expense", amount, cat: "Debt", note: "Lent to a friend", acc: "c1", date: now - 2 * DAY, track: true }));

test("track-only entries keep their account but never change its balance", () => {
  const s = make([real, ...lent]);
  assert.equal(Math.round(balance(s, s.accounts[0]) * 100) / 100, -3_186.7, "only the real charges count");
  assert.equal(s.txs.filter((t) => t.acc === "c1").length, 4, "the lent entries still exist, on the card");
  assert.equal(s.txs.filter((t) => t.track).length, 3);
});

test("without the flag, the same entries would have pushed the card up by ₱228.10", () => {
  const withoutFlag = make([real, ...lent.map((t) => ({ ...t, track: undefined }))]);
  assert.equal(Math.round(balance(withoutFlag, withoutFlag.accounts[0]) * 100) / 100, -3_414.8);
});

test("a card's used credit and available limit ignore track-only entries", () => {
  const s = make([real, ...lent]);
  const ci = creditInfo(s, s.accounts[0]);
  assert.equal(ci.used, 3_186.7);
  assert.equal(ci.available, 19_000 - 3_186.7);
});

test("a track-only expense still counts as spending in your totals and categories", () => {
  const s = make([{ id: "x", type: "expense", amount: 200, cat: "Food", note: "Lunch", acc: "c1", date: now - DAY, track: true }]);
  const sums = sumRange(s, now - 2 * DAY, now + DAY);
  assert.equal(sums.expense, 200);
  assert.equal(sums.cats.Food, 200);
  assert.equal(balance(s, s.accounts[0]), 0);
});

test("track-only income doesn't add to a balance or earn interest", () => {
  const acct = { id: "b1", name: "Savings", opening: 10_000, kind: "bank", color: "#0ea5e9", rate: 3.65, tax: 0, interestFreq: "daily", interestFrom: new Date(2026, 10, 1).getTime() };
  const state = (track: boolean) =>
    normalize({ accounts: [acct], txs: [{ id: "i1", type: "income", amount: 100_000, cat: "Income", note: "Reference only", acc: "b1", date: new Date(2026, 10, 1, 8).getTime(), track }] })!;
  const withTrack = dueInterest(state(true), new Date(2026, 10, 3, 9).getTime())!;
  const withoutTrack = dueInterest(state(false), new Date(2026, 10, 3, 9).getTime())!;
  const sum = (s: typeof withTrack) => s.state.txs.filter((t) => t.cat === "Interest").reduce((a, t) => a + t.amount, 0);
  assert.equal(sum(withTrack), 2, "two days on ₱10,000 at 3.65% is ₱2.00");
  assert.ok(sum(withoutTrack) > 20, "counting the ₱100,000 would have earned far more");
});

test("the track-only flag survives saving and restoring", () => {
  const s = make([...lent]);
  const again = normalize(JSON.parse(JSON.stringify(s)))!;
  assert.equal(again.txs.every((t) => t.track === true), true);
});
