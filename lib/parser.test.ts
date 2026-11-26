import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntry } from "./parser";

const accounts = [
  { id: "cash", name: "Cash" },
  { id: "gcash", name: "GCash" },
  { id: "bank", name: "Bank" },
];
const NOW = Date.UTC(2026, 10, 17, 12);

test("simple expense uses default account and guesses category", () => {
  const r = parseEntry("lunch 180", accounts, "cash", NOW)!;
  assert.equal(r.type, "expense");
  assert.equal(r.amount, 180);
  assert.equal(r.cat, "Food");
  assert.equal(r.acc, "cash");
  assert.equal(r.note, "Lunch");
});

test("named account overrides the default", () => {
  const r = parseEntry("grab 250 gcash", accounts, "cash", NOW)!;
  assert.equal(r.cat, "Transport");
  assert.equal(r.acc, "gcash");
  assert.equal(r.note, "Grab");
});

test("income with k suffix", () => {
  const r = parseEntry("salary 25k bank", accounts, "cash", NOW)!;
  assert.equal(r.type, "income");
  assert.equal(r.amount, 25000);
  assert.equal(r.acc, "bank");
});

test("transfer in both word orders", () => {
  const a = parseEntry("transfer 500 bank to gcash", accounts, "cash", NOW)!;
  assert.deepEqual([a.type, a.acc, a.to], ["transfer", "bank", "gcash"]);
  const b = parseEntry("transfer 500 to gcash from bank", accounts, "cash", NOW)!;
  assert.deepEqual([b.type, b.acc, b.to], ["transfer", "bank", "gcash"]);
});

test("yesterday moves the date back a day", () => {
  const r = parseEntry("coffee 120 yesterday", accounts, "cash", NOW)!;
  assert.equal(r.date, NOW - 86_400_000);
});

test("no amount returns null", () => {
  assert.equal(parseEntry("just coffee", accounts, "cash", NOW), null);
});

test("chat-style sentence drops filler words", () => {
  const r = parseEntry("Spent 225 on lunch", accounts, "cash", NOW)!;
  assert.equal(r.amount, 225);
  assert.equal(r.cat, "Food");
  assert.equal(r.note, "Lunch");
});

test("account named with 'from my ... account'", () => {
  const r = parseEntry("Spent 220 on Starbucks from my GCash account", accounts, "cash", NOW)!;
  assert.equal(r.acc, "gcash");
  assert.equal(r.cat, "Food");
  assert.equal(r.note, "Starbucks");
});

test("last <weekday> moves the date back", () => {
  // NOW is Tuesday 2026-11-17; last Friday is 4 days earlier.
  const r = parseEntry("Paid 3,421 for my electric bill last Friday", accounts, "cash", NOW)!;
  assert.equal(r.amount, 3421);
  assert.equal(r.cat, "Bills");
  assert.equal(r.note, "Electric bill");
  assert.equal(r.date, NOW - 4 * 86_400_000);
});

test("n days ago", () => {
  const r = parseEntry("jeep 13 2 days ago", accounts, "cash", NOW)!;
  assert.equal(r.amount, 13);
  assert.equal(r.date, NOW - 2 * 86_400_000);
});

test("custom categories by name or keyword", () => {
  const extra = [{ name: "Milk tea", keywords: ["boba", "chatime"] }, { name: "Pets" }];
  assert.equal(parseEntry("milk tea 120", accounts, "cash", NOW, extra)!.cat, "Milk tea");
  assert.equal(parseEntry("chatime 150 gcash", accounts, "cash", NOW, extra)!.cat, "Milk tea");
  assert.equal(parseEntry("pets 500", accounts, "cash", NOW, extra)!.cat, "Pets");
  assert.equal(parseEntry("lunch 180", accounts, "cash", NOW, extra)!.cat, "Food");
});
