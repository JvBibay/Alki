import { test } from "node:test";
import assert from "node:assert/strict";
import { cardCycle, cardsDue, creditInfo, cycleLabel } from "./cards";
import { freshState } from "./store";
import type { Account, State } from "./types";

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
const card: Account = { id: "c", name: "RCBC Visa", opening: 0, kind: "credit", color: "#000", limit: 100000, statementDay: 25, dueDay: 15 };
function state(): State {
  const s = freshState();
  s.accounts = [card, { id: "b", name: "BPI", opening: 50000, kind: "bank", color: "#000" }];
  s.txs = [
    { id: "1", type: "expense", amount: 8000, cat: "Shopping", note: "Shoes", acc: "c", date: at(10, 20) }, // before Oct 25 cut-off
    { id: "2", type: "expense", amount: 2000, cat: "Food", note: "Dinner", acc: "c", date: at(10, 28) }, // next cycle
  ];
  return s;
}

test("statement and due dates; balance only up to the cut-off", () => {
  const c = cardCycle(state(), card, at(11, 10))!;
  assert.equal(new Date(c.statementDate).getDate(), 25);
  assert.equal(new Date(c.statementDate).getMonth(), 9); // Oct
  assert.equal(new Date(c.dueDate).getMonth(), 10); // Nov 15
  assert.equal(new Date(c.dueDate).getDate(), 15);
  assert.equal(c.statementBalance, 8000);
  assert.equal(c.minDue, 500); // 3% of 8,000 = 240, floor ₱500
  assert.equal(c.daysLeft, 5);
  assert.equal(c.status, "due");
  assert.equal(cycleLabel(c), "Due in 5 days");
});

test("minimum is 3% when that's more than the floor", () => {
  const s = state();
  s.txs[0].amount = 40000;
  assert.equal(cardCycle(s, card, at(11, 10))!.minDue, 1200);
});

test("payments since the statement: minimum, then paid in full", () => {
  const s = state();
  s.txs.push({ id: "p1", type: "transfer", amount: 500, cat: "Transfer", note: "Payment", acc: "b", to: "c", date: at(11, 2) });
  assert.equal(cardCycle(s, card, at(11, 10))!.status, "min");
  s.txs.push({ id: "p2", type: "transfer", amount: 7500, cat: "Transfer", note: "Payment", acc: "b", to: "c", date: at(11, 5) });
  const c = cardCycle(s, card, at(11, 10))!;
  assert.equal(c.status, "paid");
  assert.equal(c.left, 0);
});

test("overdue after the due date, and shows in cards due", () => {
  const s = state();
  const c = cardCycle(s, card, at(11, 18))!;
  assert.equal(c.status, "overdue");
  assert.equal(cardsDue(s, at(11, 18)).length, 1);
  assert.equal(cardsDue(s, at(11, 1)).length, 0); // due Nov 15 is more than 2 days away
});

test("marking a statement paid outside Kwenta", () => {
  const s = state();
  s.accounts[0] = { ...card, paidCycles: ["2026-10"] };
  assert.equal(cardCycle(s, s.accounts[0], at(11, 18))!.status, "paid");
});

test("shared credit limit counts every card in the group", () => {
  const s = freshState();
  const gold: Account = { id: "g", name: "BDO Gold", opening: 0, kind: "credit", color: "#000", limit: 100000 };
  const plat: Account = { id: "p", name: "BDO Platinum", opening: 0, kind: "credit", color: "#000", limitShare: "g" };
  const own: Account = { id: "o", name: "Metrobank", opening: 0, kind: "credit", color: "#000", limit: 50000 };
  s.accounts = [gold, plat, own];
  s.txs = [
    { id: "1", type: "expense", amount: 30000, cat: "Shopping", note: "", acc: "g", date: at(10, 1) },
    { id: "2", type: "expense", amount: 20000, cat: "Shopping", note: "", acc: "p", date: at(10, 2) },
    { id: "3", type: "expense", amount: 5000, cat: "Food", note: "", acc: "o", date: at(10, 3) },
  ];
  for (const a of [gold, plat]) {
    const ci = creditInfo(s, a);
    assert.equal(ci.limit, 100000);
    assert.equal(ci.used, 50000);
    assert.equal(ci.available, 50000);
    assert.equal(ci.shared.length, 1);
  }
  assert.equal(creditInfo(s, own).available, 45000);
  // Archiving the holder: the other card falls back to its own (unset) limit.
  s.accounts[0] = { ...gold, archived: true };
  assert.equal(creditInfo(s, plat).limit, 0);
  // Over the limit shows as negative available.
  s.accounts[0] = gold;
  s.txs.push({ id: "4", type: "expense", amount: 60000, cat: "Shopping", note: "", acc: "p", date: at(10, 4) });
  assert.equal(creditInfo(s, gold).available, -10000);
});

test("cards on a shared limit keep their own cut-off, due date and statement", () => {
  const s = freshState();
  const gold: Account = { id: "g", name: "BDO Gold", opening: 0, kind: "credit", color: "#000", limit: 100000, statementDay: 5, dueDay: 25 };
  const plat: Account = { id: "p", name: "BDO Platinum", opening: 0, kind: "credit", color: "#000", limitShare: "g", statementDay: 20, dueDay: 10 };
  s.accounts = [gold, plat, { id: "b", name: "BPI", opening: 90000, kind: "bank", color: "#000" }];
  s.txs = [
    { id: "1", type: "expense", amount: 12000, cat: "Shopping", note: "", acc: "g", date: at(11, 2) }, // before Gold's Nov 5 cut-off
    { id: "2", type: "expense", amount: 7000, cat: "Food", note: "", acc: "p", date: at(10, 15) }, // before Platinum's Oct 20 cut-off
    { id: "3", type: "expense", amount: 3000, cat: "Food", note: "", acc: "p", date: at(11, 1) }, // after it: next Platinum bill
  ];
  const now = at(11, 8);
  const cg = cardCycle(s, gold, now)!;
  const cp = cardCycle(s, plat, now)!;
  assert.equal(new Date(cg.statementDate).getDate(), 5);
  assert.equal(new Date(cg.dueDate).getMonth(), 10); // Gold due Nov 25
  assert.equal(new Date(cg.dueDate).getDate(), 25);
  assert.equal(cg.statementBalance, 12000);
  assert.equal(new Date(cp.statementDate).getMonth(), 9); // Platinum: Oct 20 statement
  assert.equal(new Date(cp.dueDate).getMonth(), 10); // due Nov 10
  assert.equal(new Date(cp.dueDate).getDate(), 10);
  assert.equal(cp.statementBalance, 7000);
  assert.equal(cp.daysLeft, 2);
  // Only Platinum is due soon; the limit is still pooled.
  assert.deepEqual(cardsDue(s, now).map((x) => x.a.id), ["p"]);
  assert.equal(creditInfo(s, gold).available, 78000);
  // Paying Platinum's bill doesn't touch Gold's statement, and frees up the shared limit.
  s.txs.push({ id: "4", type: "transfer", amount: 7000, cat: "Transfer", note: "", acc: "b", to: "p", date: at(11, 8, 14) });
  assert.equal(cardCycle(s, plat, at(11, 8, 15))!.status, "paid");
  assert.equal(cardCycle(s, gold, at(11, 8, 15))!.status, "due");
  assert.equal(creditInfo(s, plat).available, 85000);
});

test("amount owed at start isn't billed until the next cut-off; bank figure overrides", () => {
  const s = freshState();
  // Like a Maya card added on Nov 17 with ₱3,017.06 owed, cut-off 26th, due 16th.
  const maya: Account = { id: "m", name: "Maya", opening: -3017.06, openingAt: at(11, 17), kind: "credit", color: "#000", limit: 19000, statementDay: 26, dueDay: 16 };
  s.accounts = [maya];
  const now = at(11, 18);
  const c = cardCycle(s, maya, now)!;
  assert.equal(c.statementBalance, 0);
  assert.equal(c.status, "none");
  assert.equal(cycleLabel(c), "No payment due");
  assert.equal(cardsDue(s, now).length, 0);
  // After the Nov 26 cut-off it's on the statement, due Dec 16.
  const next = cardCycle(s, maya, at(11, 28))!;
  assert.equal(next.statementBalance, 3017.06);
  assert.equal(new Date(next.dueDate).getMonth(), 11);
  assert.equal(next.status, "due");
  // Typing the bank's statement amount overrides the estimate for that statement only.
  s.accounts[0] = { ...maya, stmtFix: { key: next.key, amount: 2500 } };
  assert.equal(cardCycle(s, s.accounts[0], at(11, 28))!.statementBalance, 2500);
  assert.equal(cardCycle(s, s.accounts[0], now)!.statementBalance, 0);
});
