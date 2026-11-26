import { test } from "node:test";
import assert from "node:assert/strict";
import { balance, netWorth, sumRange } from "./stats";
import { debtTotals } from "./debts";
import { freshState } from "./store";

// What "Someone else paid" saves: the user's share as a track-only expense, plus an "owe" debt for that share.
test("someone else paid: share counts as spending, no cash moves, and you owe them", () => {
  const s = freshState();
  s.accounts = [{ id: "a", name: "BPI", opening: 10000, kind: "bank", color: "#000" }];
  s.txs = [{ id: "t", type: "expense", amount: 500, cat: "Food", note: "Dinner", acc: "a", date: 1000, track: true }];
  s.debts = [{ id: "d", person: "Migs", direction: "owe", amount: 500, note: "Dinner (your share)", created: 1000, payments: [] }];

  assert.equal(balance(s, s.accounts[0]), 10000); // nothing left the account
  assert.equal(sumRange(s, 0, 2000).expense, 500); // but it counts toward budgets and stats
  assert.equal(sumRange(s, 0, 2000).cats.Food, 500);
  assert.equal(debtTotals(s).owe, 500);
  assert.equal(netWorth(s).net, 9500); // you're ₱500 poorer on paper

  // Paying Migs back later moves real money (logged as a debt payment, not new spending), and net worth stays put.
  s.debts[0].payments = [{ id: "p", amount: 500, date: 3000, txId: "pay" }];
  s.txs.push({ id: "pay", type: "expense", amount: 500, cat: "Debt", note: "Paid back Migs", acc: "a", date: 3000 });
  assert.equal(balance(s, s.accounts[0]), 9500);
  assert.equal(sumRange(s, 0, 4000).expense, 500); // still just the one ₱500 of spending
  assert.equal(netWorth(s).net, 9500);
});
