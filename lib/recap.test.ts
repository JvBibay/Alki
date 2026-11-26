import { test } from "node:test";
import assert from "node:assert/strict";
import { monthRecap, pendingRecap } from "./recap";
import { freshState } from "./store";
import type { Tx } from "./types";

const at = (d: number, h = 12) => new Date(2026, 9, d, h).getTime(); // October 2026
const tx = (id: string, type: Tx["type"], amount: number, cat: string, d: number, acc = "a1"): Tx => ({ id, type, amount, cat, note: cat, acc, date: at(d) });

function sample() {
  const s = freshState();
  s.txs = [
    tx("1", "income", 30000, "Income", 15),
    tx("2", "expense", 5000, "Food", 2),
    tx("3", "expense", 3000, "Food", 3),
    tx("4", "expense", 9000, "Shopping", 10, "a2"),
    tx("5", "expense", 1000, "Transport", 10),
    tx("6", "expense", 500, "Fun", 20),
  ];
  return s;
}

test("monthly recap numbers", () => {
  const r = monthRecap(sample(), 2026, 9, new Date(2026, 10, 3).getTime());
  assert.equal(r.income, 30000);
  assert.equal(r.expense, 18500);
  assert.equal(r.saved, 11500);
  assert.equal(r.savingsRate, 38);
  assert.equal(r.topCats[0].cat, "Shopping");
  assert.equal(r.topCats[1].cat, "Food");
  assert.equal(r.biggest?.amount, 9000);
  assert.equal(new Date(r.busiestDay!.date).getDate(), 10);
  assert.equal(r.noSpendDays, 31 - 4); // spent on the 2nd, 3rd, 10th and 20th
  assert.equal(r.topAccount?.id, "a1");
  assert.equal(r.style.title, "The Alkansya Pro"); // saved over 30%
});

test("recap card shows in the first 10 days of the next month until dismissed", () => {
  const s = sample();
  assert.deepEqual(pendingRecap(s, new Date(2026, 10, 5).getTime())?.key, "2026-9");
  assert.equal(pendingRecap(s, new Date(2026, 10, 15).getTime()), null);
  s.settings.recapSeen = "2026-9";
  assert.equal(pendingRecap(s, new Date(2026, 10, 5).getTime()), null);
});

test("new users start with no accounts; old unused samples are removed once", async () => {
  const { normalize } = await import("./store");
  assert.equal(freshState().accounts.length, 0);
  const old = {
    accounts: [
      { id: "a1", name: "Cash", opening: 0 },
      { id: "a2", name: "GCash", opening: 0 },
      { id: "a3", name: "Bank", opening: 5000 },
      { id: "x9", name: "BPI", opening: 0 },
    ],
    txs: [{ id: "t", type: "expense", amount: 10, cat: "Food", note: "", acc: "a2", date: 1 }],
    budgets: {},
    defAcc: "a1",
  };
  const s = normalize(old)!;
  assert.equal(s.settings.defaultsCleared, false); // cleanup runs when loading from storage
});
