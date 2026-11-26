import { test } from "node:test";
import assert from "node:assert/strict";
import { alkiMood } from "./mood";
import { freshState } from "./store";
import type { State, Tx } from "./types";

const NOW = new Date(2026, 10, 18, 12).getTime(); // Wed Nov 18 2026
const D = 86_400_000;
let n = 0;
const tx = (type: Tx["type"], amount: number, cat: string, daysAgo = 0): Tx => ({ id: String(n++), type, amount, cat, note: cat, acc: "a1", date: NOW - daysAgo * D });
const base = (): State => {
  const s = freshState();
  s.accounts = [{ id: "a1", name: "Cash", opening: 50000, kind: "cash", color: "#0f766e" }];
  s.defAcc = "a1";
  return s;
};

test("angry when a budget is blown past 125%", () => {
  const s = base();
  s.budgets = { Shopping: 1000 };
  s.txs = [tx("expense", 1500, "Shopping")];
  assert.equal(alkiMood(s, NOW).mood, "angry");
});

test("sad when slightly over budget", () => {
  const s = base();
  s.budgets = { Food: 1000 };
  s.txs = [tx("expense", 1100, "Food")];
  assert.equal(alkiMood(s, NOW).mood, "sad");
});

test("worried when a bill is due tomorrow", () => {
  const s = base();
  s.txs = [tx("expense", 100, "Food")];
  s.planned = [{ id: "p", name: "Globe", type: "expense", amount: 999, cat: "Bills", acc: "a1", day: 19, done: [] }];
  const m = alkiMood(s, NOW);
  assert.equal(m.mood, "worried");
  assert.match(m.line, /Globe is due tomorrow/);
});

test("sleepy when nothing was logged for days", () => {
  const s = base();
  s.txs = [tx("expense", 100, "Food", 4)];
  assert.equal(alkiMood(s, NOW).mood, "sleepy");
});

test("happy on a streak", () => {
  const s = base();
  s.txs = [tx("expense", 100, "Food", 0), tx("expense", 100, "Food", 1), tx("expense", 100, "Food", 2)];
  assert.equal(alkiMood(s, NOW).mood, "happy");
});

test("excited on sweldo day", () => {
  const s = base();
  s.settings.payday = [18];
  s.settings.payFreq = "monthly";
  s.txs = [tx("expense", 100, "Food")];
  assert.equal(alkiMood(s, NOW).mood, "excited");
});

test("neutral for a brand new user", () => {
  assert.equal(alkiMood(base(), NOW).mood, "neutral");
});
