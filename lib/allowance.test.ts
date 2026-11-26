import { test } from "node:test";
import assert from "node:assert/strict";
import { forecast, monthChange } from "./stats";
import { freshState } from "./store";
import type { Account, State } from "./types";

const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
const NOW = at(11, 10); // payday is the 15th and 30th
const bank: Account = { id: "b", name: "BPI", opening: 20000, kind: "bank", color: "#000" };
const card: Account = { id: "c", name: "RCBC Visa", opening: 0, kind: "credit", color: "#000", limit: 100000, statementDay: 25, dueDay: 15 };
function base(): State {
  const s = freshState();
  s.accounts = [bank];
  s.defAcc = "b";
  s.settings.payday = [15, 30];
  return s;
}

test("allowance is the money left after bills, split over the days until payday", () => {
  const s = base();
  s.planned = [{ id: "p", name: "Meralco", type: "expense", amount: 3000, cat: "Bills", acc: "b", day: 12, done: [] }];
  const f = forecast(s, NOW);
  assert.equal(f.pay.daysLeft, 5);
  assert.equal(f.available, 17000);
  assert.equal(f.safeDaily, 3400);
  assert.equal(f.over, 0);
});

test("salary arriving on payday isn't counted as money you can spend before it", () => {
  const s = base();
  s.planned = [{ id: "s", name: "Sweldo", type: "income", amount: 30000, cat: "Income", acc: "b", day: 15, done: [] }];
  const f = forecast(s, NOW);
  assert.equal(f.available, 20000);
  assert.equal(f.safeDaily, 4000);
});

test("a card payment due before payday is subtracted", () => {
  const s = base();
  s.accounts = [bank, card];
  s.txs = [{ id: "1", type: "expense", amount: 8000, cat: "Shopping", note: "Shoes", acc: "c", date: at(10, 20) }];
  const f = forecast(s, NOW); // statement of ₱8,000 is due Nov 15
  assert.equal(f.cards, 8000);
  assert.equal(f.available, 12000);
});

test("overspent: shows how much over, and the allowance is 0, never negative", () => {
  const s = base();
  s.planned = [{ id: "p", name: "Rent", type: "expense", amount: 25000, cat: "Bills", acc: "b", day: 12, done: [] }];
  const f = forecast(s, NOW);
  assert.equal(f.over, 5000);
  assert.equal(f.safeDaily, 0);
});

test("payday today: no division by zero", () => {
  const f = forecast(base(), at(11, 15));
  assert.equal(f.pay.daysLeft, 0);
  assert.ok(Number.isFinite(f.safeDaily));
});

test("month change: no baseline, tiny baseline, normal, and capped", () => {
  assert.deepEqual(monthChange(5000, 0, "expense"), { kind: "first" });
  assert.deepEqual(monthChange(15000, 1000 - 1, "expense"), { kind: "diff", diff: 14001, tone: "bad" });
  assert.deepEqual(monthChange(12000, 10000, "expense"), { kind: "pct", pct: 20, capped: false, tone: "bad" });
  assert.deepEqual(monthChange(12000, 10000, "income"), { kind: "pct", pct: 20, capped: false, tone: "good" });
  assert.deepEqual(monthChange(8000, 10000, "expense"), { kind: "pct", pct: -20, capped: false, tone: "good" });
  assert.deepEqual(monthChange(100000, 10000, "expense"), { kind: "pct", pct: 500, capped: true, tone: "bad" });
});

test("an installment already billed on the card's statement isn't counted twice before payday", () => {
  const s = base();
  s.accounts = [bank, card];
  // ₱12,000 bought on the card in September, 6 monthly bills of ₱2,000 starting Oct 20 (before the Oct 25 cut-off)
  s.txs = [{ id: "buy", type: "expense", amount: 12000, cat: "Shopping", note: "Tablet", acc: "c", date: at(9, 5) }];
  s.installments = [{ id: "i", acc: "c", name: "Tablet", kind: "purchase", principal: 12000, rate: 0, months: 6, fee: 0, start: at(10, 20), paid: 0, cat: "Shopping", program: "0%", created: at(9, 5), txIds: { principal: "buy", interest: [] } }];
  const f = forecast(s, NOW);
  assert.equal(f.cards, 2000); // the statement already holds this month's ₱2,000
  assert.equal(f.bills, 0); // so it isn't a separate bill as well
  assert.equal(f.available, f.liquid - f.bills - f.cards);
});
