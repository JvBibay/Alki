import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "./store";
import { previewEffect } from "./preview";

const now = Date.now();
function make() {
  const s = normalize({
    accounts: [
      { id: "g", name: "GCash", opening: 1000, kind: "ewallet", color: "#2563eb" },
      { id: "m", name: "Maribank", opening: 5000, kind: "bank", color: "#7c3aed" },
      { id: "c", name: "Card", opening: -3000, kind: "credit", color: "#000", limit: 20000 },
    ],
    txs: [{ id: "t1", type: "expense", amount: 200, cat: "Food", note: "", acc: "g", date: now }],
  });
  assert.ok(s);
  return s!;
}

test("an expense shows one account going down", () => {
  const [l] = previewEffect(make(), { type: "expense", amount: 100, acc: "g" });
  assert.deepEqual([l.before, l.after, l.dir], [800, 700, "out"]);
});

test("a transfer shows both sides", () => {
  const lines = previewEffect(make(), { type: "transfer", amount: 500, acc: "m", to: "g" });
  assert.deepEqual(lines.map((l) => [l.acc.id, l.before, l.after]), [["m", 5000, 4500], ["g", 800, 1300]]);
});

test("paying a card lowers what you owe", () => {
  const lines = previewEffect(make(), { type: "transfer", amount: 1000, acc: "m", to: "c" });
  const card = lines.find((l) => l.acc.id === "c")!;
  assert.deepEqual([card.before, card.after, card.dir], [3000, 2000, "in"]);
});

test("spending on a card raises what you owe", () => {
  const [l] = previewEffect(make(), { type: "expense", amount: 250, acc: "c" });
  assert.deepEqual([l.before, l.after], [3000, 3250]);
});

test("editing doesn't count the old amount twice", () => {
  const s = make();
  const [l] = previewEffect(s, { type: "expense", amount: 300, acc: "g" }, s.txs[0]);
  assert.deepEqual([l.before, l.after], [1000, 700]);
});

test("track-only and empty amounts preview nothing", () => {
  assert.deepEqual(previewEffect(make(), { type: "expense", amount: 5, acc: "g", track: true }), []);
  assert.deepEqual(previewEffect(make(), { type: "expense", amount: 0, acc: "g" }), []);
});

test("cross-currency transfers use the amount that arrived", () => {
  const lines = previewEffect(make(), { type: "transfer", amount: 100, acc: "m", to: "g", toAmount: 7 });
  assert.equal(lines[1].after, 807);
});

test("a transfer fee comes out of the sending account only", () => {
  const lines = previewEffect(make(), { type: "transfer", amount: 500, acc: "m", to: "g", fee: 15 });
  assert.deepEqual(lines.map((l) => [l.acc.id, l.before, l.after]), [["m", 5000, 4485], ["g", 800, 1300]]);
  // A fee never applies to anything but a transfer.
  const [x] = previewEffect(make(), { type: "expense", amount: 100, acc: "g", fee: 15 });
  assert.equal(x.after, 700);
});
