import { test } from "node:test";
import assert from "node:assert/strict";
import { dueSoon } from "./reminders";
import { upcoming } from "./stats";
import { freshState } from "./store";

// The Home "Upcoming" list drops anything "Due soon" already shows, using these ids.
test("a bill due within two days appears in Due soon under the id Home uses to dedupe Upcoming", () => {
  const now = new Date(2026, 10, 25, 9).getTime();
  const s = freshState();
  s.accounts = [{ id: "a", name: "BPI", opening: 5000, kind: "bank", color: "#000" }];
  s.planned = [
    { id: "meralco", name: "Meralco", type: "expense", amount: 3400, cat: "Bills", acc: "a", day: 27, done: [] },
    { id: "rent", name: "Rent", type: "expense", amount: 9000, cat: "Bills", acc: "a", day: 5, done: ["2026-10"] },
  ];
  const ids = new Set(dueSoon(s, now).map((d) => d.id));
  assert.ok(ids.has("p-meralco"));
  assert.ok(!ids.has("p-rent"));
  const rest = upcoming(s, now).filter((u) => !ids.has(`p-${u.item.id}`));
  assert.deepEqual(rest.map((u) => u.item.id), ["rent"]);
});
