import { test } from "node:test";
import assert from "node:assert/strict";
import { billMatch, paidAmount, unpay } from "./bills";
import { upcoming } from "./stats";
import { freshState } from "./store";
import type { State, Tx } from "./types";

const NOW = new Date(2026, 10, 24, 12).getTime(); // Tue Nov 24 2026
const D = 86_400_000;
const base = (): State => {
  const s = freshState();
  s.accounts = [{ id: "a1", name: "BPI", opening: 50000, kind: "bank", color: "#0f766e" }];
  s.defAcc = "a1";
  s.planned = [{ id: "p1", name: "Meralco", type: "expense", amount: 3400, cat: "Bills", acc: "a1", day: 27, done: [] }];
  return s;
};
const tx = (over: Partial<Tx>): Tx => ({ id: "t1", type: "expense", amount: 3421, cat: "Bills", note: "Meralco", acc: "a1", date: NOW - 2 * D, ...over });

test("a logged Meralco payment near the due date is suggested for the bill", () => {
  const s = base();
  s.txs = [tx({})];
  const u = upcoming(s, NOW)[0];
  assert.equal(billMatch(s, u)?.id, "t1");
});

test("no match when the name, amount or date is off, or it's already linked", () => {
  const s = base();
  const u = () => upcoming(s, NOW)[0];
  s.txs = [tx({ note: "Jollibee" })];
  assert.equal(billMatch(s, u()), undefined);
  s.txs = [tx({ amount: 5000 })];
  assert.equal(billMatch(s, u()), undefined);
  s.txs = [tx({ date: NOW - 20 * D })];
  assert.equal(billMatch(s, u()), undefined);
  s.txs = [tx({ bill: { id: "p1", key: "2026-10" } })];
  assert.equal(billMatch(s, u()), undefined);
  s.txs = [tx({ type: "income" })];
  assert.equal(billMatch(s, u()), undefined);
});

test("undo of a bill Kwenta logged deletes that entry; a linked one is only unlinked", () => {
  const s = base();
  s.txs = [tx({ id: "mine", bill: { id: "p1", key: "2026-10" } }), tx({ id: "made", bill: { id: "p1", key: "2026-9" } })];
  s.planned[0].done = ["2026-10", "2026-9"];
  s.planned[0].paid = {
    "2026-10": { txId: "mine", amount: 3421, date: NOW, created: false },
    "2026-9": { txId: "made", amount: 3421, date: NOW, created: true },
  };
  const a = unpay(s, "p1", "2026-10");
  assert.deepEqual(a.txs.map((t) => t.id), ["mine", "made"]);
  assert.equal(a.txs[0].bill, undefined);
  assert.deepEqual(a.planned[0].done, ["2026-9"]);
  const b = unpay(s, "p1", "2026-9");
  assert.deepEqual(b.txs.map((t) => t.id), ["mine"]);
});

test("paid amount is what was actually paid, else the expected amount", () => {
  const s = base();
  assert.equal(paidAmount(s.planned[0], "2026-10"), 3400);
  s.planned[0].paid = { "2026-10": { txId: "t", amount: 3421, date: NOW, created: true } };
  assert.equal(paidAmount(s.planned[0], "2026-10"), 3421);
});

test("bills get an icon that fits their name, falling back to the category's", async () => {
  const { billEmoji } = await import("./billicons");
  assert.equal(billEmoji("Converge Internet", "Bills"), "📶");
  assert.equal(billEmoji("Meralco", "Bills"), "💡");
  assert.equal(billEmoji("Anytime Fitness gym", "Health"), "🏋️");
  assert.equal(billEmoji("Netflix", "Fun"), "📺");
  assert.equal(billEmoji("Spotify", "Fun"), "🎵");
  assert.equal(billEmoji("Maynilad", "Bills"), "💧");
  assert.equal(billEmoji("Health insurance", "Bills"), "🛡️");
  assert.equal(billEmoji("Dog groomer", "Other"), "📦"); // no rule: the category's icon
});
