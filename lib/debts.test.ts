import { test } from "node:test";
import assert from "node:assert/strict";
import { debtLeft, debtTotals, equalShares, splitSummary } from "./debts";
import { freshState } from "./store";
import { netWorth, sumRange } from "./stats";
import { dueSoon } from "./reminders";
import type { Debt } from "./types";

test("equal shares add back up to the total, to the centavo", () => {
  const r = equalShares(1000, 2, true); // me + 2 friends
  assert.equal(r.each.length, 2);
  assert.equal(Math.round((r.mine + r.each.reduce((a, b) => a + b, 0)) * 100), 100000);
  assert.deepEqual(r.each, [333.34, 333.33]);
  assert.equal(r.mine, 333.33);
  const notMe = equalShares(900, 3, false);
  assert.deepEqual(notMe.each, [300, 300, 300]);
  assert.equal(notMe.mine, 0);
});

test("debt left and totals", () => {
  const s = freshState();
  const d: Debt = { id: "1", person: "Ate", direction: "owe", amount: 2000, note: "", created: 0, payments: [{ id: "p", amount: 500, date: 0 }] };
  const e: Debt = { id: "2", person: "Ben", direction: "owed", amount: 500, note: "", created: 0, payments: [] };
  s.debts = [d, e];
  assert.equal(debtLeft(d), 1500);
  assert.deepEqual(debtTotals(s), { owe: 1500, owed: 500, open: 2 });
});

test("debt entries are neither income nor spending", () => {
  const s = freshState();
  s.accounts = [{ id: "a1", name: "Cash", opening: 0, kind: "cash", color: "#000" }];
  s.txs = [
    { id: "1", type: "expense", amount: 300, cat: "Food", note: "", acc: "a1", date: 10 },
    { id: "2", type: "expense", amount: 1000, cat: "Debt", note: "Lent to Ben", acc: "a1", date: 10 },
    { id: "3", type: "income", amount: 2000, cat: "Debt", note: "Borrowed", acc: "a1", date: 10 },
  ];
  const r = sumRange(s, 0, 100);
  assert.equal(r.expense, 300);
  assert.equal(r.income, 0);
});

test("hidden and archived accounts are left out of net worth", () => {
  const s = freshState();
  s.accounts = [
    { id: "a", name: "BPI", opening: 1000, kind: "bank", color: "#000" },
    { id: "b", name: "Old card", opening: -5000, kind: "credit", color: "#000", archived: true },
    { id: "c", name: "Emergency", opening: 20000, kind: "bank", color: "#000", excludeFromTotal: true },
  ];
  assert.deepEqual(netWorth(s), { assets: 1000, liabilities: 0, net: 1000 });
});

test("debts with a due date show up in Due soon", () => {
  const now = new Date(2026, 10, 18, 9).getTime();
  const s = freshState();
  s.debts = [{ id: "x", person: "Ate", direction: "owe", amount: 2000, note: "", created: 0, payments: [], due: new Date(2026, 10, 19).getTime() }];
  const d = dueSoon(s, now);
  assert.equal(d[0].title, "You owe Ate");
  assert.equal(d[0].daysLeft, 1);
});

test("split summary text", () => {
  const t = splitSummary("Samgyup", 3000, [{ name: "Ben", share: 1000, paid: true }, { name: "Ana", share: 1000, paid: false }], 1000, (n) => `₱${n}`);
  assert.match(t, /Samgyup: ₱3000/);
  assert.match(t, /Ben: ₱1000 ✅ paid/);
  assert.match(t, /Ana: ₱1000 ⏳/);
});

test("net worth counts what friends owe you and what you owe, as of any date", () => {
  const s = freshState();
  s.accounts = [{ id: "a", name: "BPI", opening: 10000, kind: "bank", color: "#000" }];
  // Lending ₱1,000 takes it out of the account, but it's still yours: net worth shouldn't move.
  s.txs = [{ id: "t", type: "expense", amount: 1000, cat: "Debt", note: "Lent to Migs", acc: "a", date: 1000 }];
  s.debts = [
    { id: "d1", person: "Migs", direction: "owed", amount: 1000, note: "", created: 1000, payments: [{ id: "p", amount: 400, date: 3000 }] },
    { id: "d2", person: "Ate", direction: "owe", amount: 500, note: "", created: 2000, payments: [] },
  ];
  assert.equal(netWorth(s, 500).net, 10000); // before any of it
  assert.equal(netWorth(s, 1500).net, 10000); // lent 1,000: account 9,000 + owed 1,000
  assert.equal(netWorth(s, 2500).net, 9500); // plus borrowed 500 from Ate with no cash logged
  const now = netWorth(s);
  assert.equal(now.assets, 9000 + 600); // Migs paid 400 back in cash we never logged, 600 still owed
  assert.equal(now.liabilities, 500);
});
