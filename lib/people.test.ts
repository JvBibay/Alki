import { test } from "node:test";
import assert from "node:assert/strict";
import { avatarLabels, initials, peopleSummary, personKey, personReminder } from "./people";
import { freshState } from "./store";
import type { Debt } from "./types";

const debt = (p: Partial<Debt>): Debt => ({ id: Math.random().toString(36), person: "Eirron", direction: "owed", amount: 100, note: "", created: 1, payments: [], ...p });

test("names match regardless of spacing and capitals", () => {
  assert.equal(personKey("  ate   Joy "), personKey("Ate Joy"));
});

test("initials skip titles like Ma'am and Ate", () => {
  assert.equal(initials("Ma'am Joms"), "J");
  assert.equal(initials("Ate Joy Cruz"), "JC");
  assert.equal(initials("Eirron"), "E");
  assert.equal(initials(""), "?");
});

test("one card per person, netting both directions", () => {
  const s = freshState();
  s.debts = [
    debt({ amount: 2673.83, payments: [] }),
    debt({ person: "eirron ", direction: "owe", amount: 73.34 }),
    debt({ person: "Luis", amount: 500, payments: [{ id: "p", amount: 200, date: 2 }] }),
    debt({ person: "Ben", amount: 50, payments: [{ id: "q", amount: 50, date: 3 }] }),
  ];
  const ppl = peopleSummary(s);
  const e = ppl.find((p) => p.key === "eirron")!;
  assert.equal(e.open.length, 2);
  assert.equal(e.owedLeft, 2673.83);
  assert.equal(e.oweLeft, 73.34);
  assert.equal(e.net, 2600.49);
  const l = ppl.find((p) => p.key === "luis")!;
  assert.deepEqual([l.collected, l.collectTarget, l.net], [200, 500, 300]);
  const b = ppl.find((p) => p.key === "ben")!;
  assert.equal(b.open.length, 0);
  assert.equal(b.settled.length, 1);
  assert.equal(ppl[ppl.length - 1].key, "ben", "settled people sort last");
});

test("profiles show up even without debts and keep their name", () => {
  const s = freshState();
  s.people = [{ id: "x", name: "Ma'am Joms", payHandle: "GCash 0917" }];
  s.debts = [debt({ person: "ma'am joms" })];
  const [p] = peopleSummary(s);
  assert.equal(p.name, "Ma'am Joms");
  assert.equal(p.profile?.payHandle, "GCash 0917");
  assert.match(personReminder(p, (n) => `₱${n}`, p.profile?.payHandle), /GCash 0917/);
});

test("avatar labels never repeat when initials clash", () => {
  const l = avatarLabels(["Aaron", "Alex", "Ana", "Ben", "Kuya Dan"]);
  assert.equal(l.get("ben"), "B");
  assert.equal(l.get("kuya dan"), "D");
  const as = ["aaron", "alex", "ana"].map((k) => l.get(k));
  assert.deepEqual(as, ["Aa", "Al", "An"]);
});
