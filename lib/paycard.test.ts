import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "./store";
import { payOptions } from "./cards";
import { balanceAfterSpend } from "./stats";

const DAY = 86_400_000;
const now = Date.now();
const dayOfMonth = (ts: number) => new Date(ts).getDate();

function card(txs: unknown[], extra: Record<string, unknown> = {}) {
  const s = normalize({
    accounts: [
      {
        id: "c",
        name: "UB Rewards",
        opening: 0,
        kind: "credit",
        color: "#f59e0b",
        limit: 30_000,
        statementDay: dayOfMonth(now - DAY), // the statement closed yesterday
        dueDay: dayOfMonth(now + 10 * DAY),
        openingAt: now - 120 * DAY,
        ...extra,
      },
    ],
    txs,
  })!;
  return { s, a: s.accounts[0] };
}

const spend = (amount: number, daysAgo: number, extra: Record<string, unknown> = {}) => ({ id: `t${daysAgo}-${amount}`, type: "expense", amount, cat: "Shopping", note: "Purchase", acc: "c", date: now - daysAgo * DAY, ...extra });

test("new charges after the last statement: nothing is due, but the suggestion is everything owed", () => {
  const { s, a } = card([spend(1_591.7, 0)]);
  const o = payOptions(s, a);
  assert.equal(o.used, 1_591.7);
  assert.equal(o.left, 0, "the last statement was clear");
  assert.equal(o.suggested, 1_591.7, "so suggest paying what the card owes now");
});

test("charges before the statement: the suggestion is what's left of the statement", () => {
  const { s, a } = card([spend(2_000, 20), spend(300, 0)]);
  const o = payOptions(s, a);
  assert.equal(o.used, 2_300);
  assert.equal(o.left, 2_000);
  assert.equal(o.suggested, 2_000);
  assert.ok(o.minLeft > 0 && o.minLeft <= 2_000);
});

test("a partial payment lowers what's owed and what's left", () => {
  const pay = { id: "p", type: "transfer", amount: 500, cat: "Transfer", note: "Payment", acc: "x", to: "c", date: now };
  const s = normalize({
    accounts: [
      { id: "x", name: "MariBank", opening: 5_000, kind: "ewallet", color: "#000" },
      { id: "c", name: "UB Rewards", opening: 0, kind: "credit", color: "#f59e0b", limit: 30_000, statementDay: dayOfMonth(now - DAY), dueDay: dayOfMonth(now + 10 * DAY), openingAt: now - 120 * DAY },
    ],
    txs: [spend(2_000, 20), pay],
  })!;
  const o = payOptions(s, s.accounts[1]);
  assert.equal(o.used, 1_500);
  assert.equal(o.left, 1_500);
  assert.equal(o.suggested, 1_500);
});

test("a card with no billing days still suggests everything owed", () => {
  const { s, a } = card([spend(750, 3)], { statementDay: undefined, dueDay: undefined });
  const o = payOptions(s, a);
  assert.equal(o.cycle, null);
  assert.equal(o.suggested, 750);
  assert.equal(o.minLeft, 0);
});

test("a fully paid card suggests nothing", () => {
  const { s, a } = card([]);
  assert.equal(payOptions(s, a).suggested, 0);
});

// ---- the heads-up when an entry would take an account below zero ----

function wallet(txs: unknown[]) {
  const s = normalize({ accounts: [{ id: "w", name: "MariBank", opening: 100, kind: "ewallet", color: "#000" }, { id: "x", name: "Cash", opening: 0, kind: "cash", color: "#000" }], txs })!;
  return { s, a: s.accounts[0] };
}
const entry = (extra: Record<string, unknown>) => ({ id: "e", type: "expense", amount: 80, cat: "Food", note: "Lunch", acc: "w", date: now - DAY, ...extra });

test("spending more than an account has would leave it below zero", () => {
  const { s, a } = wallet([]);
  assert.equal(balanceAfterSpend(s, a, 60), 40);
  assert.equal(balanceAfterSpend(s, a, 150), -50);
});

test("editing an entry doesn't count its old amount twice", () => {
  const { s, a } = wallet([entry({})]); // balance is now 20
  const old = s.txs[0];
  assert.equal(balanceAfterSpend(s, a, 90), -70, "as a brand-new entry it would overdraw");
  assert.equal(balanceAfterSpend(s, a, 90, old), 10, "but editing the ₱80 lunch to ₱90 only needs ₱90 of the original ₱100");
  assert.equal(balanceAfterSpend(s, a, 120, old), -20);
});

test("editing an income or a transfer in puts the old effect back correctly", () => {
  const income = wallet([entry({ type: "income", amount: 50, cat: "Income" })]); // balance 150
  assert.equal(balanceAfterSpend(income.s, income.a, 100, income.s.txs[0]), 0, "taking back the ₱50 income leaves ₱100 to spend");
  assert.equal(balanceAfterSpend(income.s, income.a, 150, income.s.txs[0]), -50);
  const into = wallet([entry({ type: "transfer", amount: 40, acc: "x", to: "w", cat: "Transfer" })]); // balance 140
  assert.equal(balanceAfterSpend(into.s, into.a, 100, into.s.txs[0]), 0, "editing a transfer into the account removes its ₱40 first");
});

test("track-only entries never moved the balance, so editing them changes nothing", () => {
  const { s, a } = wallet([entry({ track: true })]); // still 100
  assert.equal(balanceAfterSpend(s, a, 90, s.txs[0]), 10);
});
