import { test } from "node:test";
import assert from "node:assert/strict";
import { respond } from "./assistant";
import { freshState } from "./store";
import type { State } from "./types";

const NOW = new Date(2026, 10, 24, 12).getTime(); // Tue Nov 24 2026
const D = 86_400_000;

function base(): State {
  const s = freshState();
  s.accounts = [
    { id: "cash", name: "Cash", opening: 5000, kind: "cash", color: "#000" },
    { id: "gcash", name: "GCash", opening: 5000, kind: "ewallet", color: "#000" },
    { id: "bpi", name: "BPI Savings", opening: 50000, kind: "bank", color: "#000" },
  ];
  s.defAcc = "cash";
  s.planned = [
    { id: "p1", name: "Meralco", type: "expense", amount: 3400, cat: "Bills", acc: "bpi", day: 27, done: [] },
    { id: "p2", name: "Sweldo", type: "income", amount: 32000, cat: "Income", acc: "bpi", day: 30, done: [] },
  ];
  s.debts = [
    { id: "d1", person: "Ate Rica", direction: "owe", amount: 800, note: "Groceries", created: NOW - 10 * D, payments: [] },
    { id: "d2", person: "Migs", direction: "owed", amount: 600, note: "Dinner", created: NOW - 5 * D, payments: [] },
  ];
  return s;
}

test("jollibee 185 cash kanina: expense, Food, Cash", () => {
  const r = respond("jollibee 185 cash kanina", base(), NOW);
  assert.equal(r.tx?.amount, 185);
  assert.equal(r.tx?.cat, "Food");
  assert.equal(r.tx?.acc, "cash");
});

test("bayad meralco 3400 bpi: pays the Meralco bill from BPI", () => {
  const r = respond("bayad meralco 3400 bpi", base(), NOW);
  assert.equal(r.intent?.kind, "bill");
  if (r.intent?.kind !== "bill") return;
  assert.equal(r.intent.item.item.id, "p1");
  assert.equal(r.intent.amount, 3400);
  assert.equal(r.intent.acc, "bpi");
});

test("bill amount can differ from the expected one (actual paid wins)", () => {
  const r = respond("paid meralco 3421", base(), NOW);
  assert.equal(r.intent?.kind, "bill");
  if (r.intent?.kind === "bill") {
    assert.equal(r.intent.amount, 3421);
    assert.equal(r.intent.acc, "bpi"); // the bill's own account when none is named
  }
});

test("sweldo 32000: marks the Sweldo income as received", () => {
  const r = respond("sweldo 32000", base(), NOW);
  assert.equal(r.intent?.kind, "bill");
  if (r.intent?.kind === "bill") assert.equal(r.intent.item.item.type, "income");
});

test("hati kami ni migs 1200: equal split with Migs, reusing his name", () => {
  const r = respond("hati kami ni migs 1200", base(), NOW);
  assert.equal(r.intent?.kind, "split");
  if (r.intent?.kind !== "split") return;
  assert.deepEqual(r.intent.people, [{ name: "Migs", share: 600 }]);
  assert.equal(r.intent.myShare, 600);
  assert.equal(r.intent.total, 1200);
});

test("split with several people, names split on 'at' and 'and'", () => {
  const r = respond("split dinner 2000 with Migs at Ana and Ben gcash", base(), NOW);
  assert.equal(r.intent?.kind, "split");
  if (r.intent?.kind !== "split") return;
  assert.deepEqual(r.intent.people.map((p) => p.name), ["Migs", "Ana", "Ben"]);
  assert.equal(r.intent.myShare, 500);
  assert.equal(r.intent.title, "Dinner");
  assert.equal(r.intent.cat, "Food");
  assert.equal(r.intent.acc, "gcash");
});

test("grab 250 gcash kahapon: yesterday", () => {
  const r = respond("grab 250 gcash kahapon", base(), NOW);
  assert.equal(r.tx?.acc, "gcash");
  assert.equal(r.tx?.date, NOW - D);
});

test("binayaran ko si ate rica 500: partial settlement of what I owe her", () => {
  const r = respond("binayaran ko si ate rica 500", base(), NOW);
  assert.equal(r.intent?.kind, "settle");
  if (r.intent?.kind !== "settle") return;
  assert.equal(r.intent.direction, "owe");
  assert.deepEqual(r.intent.pays, [{ debtId: "d1", amount: 500 }]);
});

test("Migs paying me back settles what he owes, capped at what's left", () => {
  const r = respond("nagbayad si migs 900", base(), NOW);
  assert.equal(r.intent?.kind, "settle");
  if (r.intent?.kind !== "settle") return;
  assert.equal(r.intent.direction, "owed");
  assert.deepEqual(r.intent.pays, [{ debtId: "d2", amount: 600 }]);
  assert.equal(r.intent.leftover, 300);
});

test("settling with someone who isn't on record explains instead of logging junk", () => {
  const r = respond("binayaran ko si Jun 500", base(), NOW);
  assert.equal(r.intent?.kind, "say");
  assert.equal(r.tx, undefined);
});

test("lunch 180 and jeep 24: two entries", () => {
  const r = respond("lunch 180 and jeep 24", base(), NOW);
  assert.equal(r.intent?.kind, "multi");
  if (r.intent?.kind !== "multi") return;
  assert.deepEqual(r.intent.txs.map((t) => [t.amount, t.cat]), [[180, "Food"], [24, "Transport"]]);
});

test("a date or account at the end of a multi message applies to every entry", () => {
  const r = respond("lunch 180, jeep 24 gcash kahapon", base(), NOW);
  assert.equal(r.intent?.kind, "multi");
  if (r.intent?.kind !== "multi") return;
  assert.ok(r.intent.txs.every((t) => t.acc === "gcash" && t.date === NOW - D));
});

test("'spent 100 and 50 on lunch' isn't mistaken for two entries", () => {
  const r = respond("spent 100 and 50 on lunch", base(), NOW);
  assert.notEqual(r.intent?.kind, "multi");
});

test("no account named: uses the one last used for that category, and says so", () => {
  const s = base();
  s.txs = [{ id: "t", type: "expense", amount: 200, cat: "Food", note: "Lunch", acc: "gcash", date: NOW - D }];
  const r = respond("jollibee 185", s, NOW);
  assert.equal(r.tx?.acc, "gcash");
  assert.match(r.hint ?? "", /Food/);
  assert.equal(respond("jollibee 185 cash", s, NOW).tx?.acc, "cash"); // naming one still wins
});

test("questions still get answers, not intents", () => {
  const r = respond("how much did I spend on food this week?", base(), NOW);
  assert.equal(r.intent, undefined);
  assert.match(r.text, /spent/i);
});

test("a category you corrected for a payee is used the next time you type it", () => {
  const s = base();
  s.settings.payeeCats = { jollibee: "Fun" };
  assert.equal(respond("jollibee 185 cash", s, NOW).tx?.cat, "Fun");
  assert.equal(respond("mcdo 185 cash", s, NOW).tx?.cat, "Food"); // others still use the keyword guess
  const multi = respond("jollibee 100 and jeep 24", s, NOW);
  assert.equal(multi.intent?.kind, "multi");
  if (multi.intent?.kind === "multi") assert.deepEqual(multi.intent.txs.map((t) => t.cat), ["Fun", "Transport"]);
});

test("'biggest expense' names the entry instead of repeating the monthly summary", () => {
  const s = base();
  s.txs = [
    { id: "a", type: "expense", amount: 250, cat: "Transport", note: "Grab", acc: "cash", date: NOW - D },
    { id: "b", type: "expense", amount: 90, cat: "Food", note: "Lunch", acc: "cash", date: NOW - 2 * D },
    { id: "c", type: "transfer", amount: 9000, cat: "Transfer", note: "Transfer", acc: "cash", to: "gcash", date: NOW - D },
  ];
  const r = respond("What's my biggest expense?", s, NOW);
  assert.match(r.text, /biggest expense/);
  assert.match(r.text, /₱250/);
  assert.match(r.text, /Grab/);
  assert.doesNotMatch(r.text, /9,000/, "a transfer is not spending");
  assert.match(respond("biggest expense?", base(), NOW).text, /don’t see any expenses/);
});

test("'can I afford 0' asks for a real amount", () => {
  assert.match(respond("can I afford 0?", base(), NOW).text, /how much/);
});
