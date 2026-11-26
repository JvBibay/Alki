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

test("a sign or peso mark beside the amount does not leak into the note", () => {
  assert.equal(parseEntry("taxi -50", accounts, "cash", NOW)!.note, "Taxi");
  assert.equal(parseEntry("lunch ₱180", accounts, "cash", NOW)!.note, "Lunch");
  assert.equal(parseEntry("lunch 180", accounts, "cash", NOW)!.note, "Lunch");
});

test("amounts are rounded to centavos and absurd ones are refused", () => {
  assert.equal(parseEntry("snack 0.001", accounts, "cash", NOW), null);
  assert.equal(parseEntry("snack 10.456", accounts, "cash", NOW)!.amount, 10.46);
  assert.equal(parseEntry("rent 99999999999999", accounts, "cash", NOW), null);
  assert.equal(parseEntry("bonus 999,999,999.99", accounts, "cash", NOW)!.amount, 999_999_999.99);
});

test("the price is found even when other numbers come first", () => {
  const amt = (s: string) => parseEntry(s, accounts, "cash", NOW)?.amount;
  assert.equal(amt("7-eleven 85"), 85);
  assert.equal(amt("3 shirts 900"), 900);
  assert.equal(amt("2 coffee 150"), 150);
  assert.equal(amt("coffee x2 150"), 150);
  assert.equal(amt("jollibee 2pc chicken 199"), 199);
  assert.equal(amt("lunch with 3 friends 600"), 600);
  assert.equal(amt("lunch 600 with 3 friends"), 600);
  assert.equal(amt("bought 2 burgers for 240"), 240);
  assert.equal(amt("pizza 1/2 dozen 300"), 300);
  assert.equal(amt("paid 1500 for 3 shirts"), 1500);
  assert.equal(amt("dinner 5 pm 450"), 450);
  assert.equal(amt("lunch 180"), 180);
  assert.equal(amt("salary 25k"), 25000);
});

test("a peso-marked number beats an unmarked one", () => {
  assert.equal(parseEntry("2 tickets ₱1,200", accounts, "cash", NOW)!.amount, 1200);
  assert.equal(parseEntry("php 50 for 300 grams rice", accounts, "cash", NOW)!.amount, 50);
});

test("no price means no entry", () => {
  assert.equal(parseEntry("7-eleven", accounts, "cash", NOW), null);
  assert.equal(parseEntry("coffee x2", accounts, "cash", NOW), null);
  assert.equal(parseEntry("coffee " + "9".repeat(400), accounts, "cash", NOW), null);
});

test("currency words and signs are cleaned out of the note", () => {
  const note = (s: string) => parseEntry(s, accounts, "cash", NOW)!.note;
  assert.equal(note("lunch 180php"), "Lunch");
  assert.equal(note("lunch 180 pesos"), "Lunch");
  assert.equal(note("lunch 180."), "Lunch");
  assert.equal(note("-50 snacks"), "Snacks");
  assert.equal(note("7-eleven 85"), "7-eleven");
});

test("explicit and extra date phrases", () => {
  const at = (s: string) => new Date(parseEntry(s, accounts, "cash", NOW)!.date);
  const same = (d: Date, m: number, day: number) => d.getMonth() === m && d.getDate() === day;
  assert.equal(at("coffee 103 on nov 20").getFullYear(), 2025);
  assert.ok(same(at("coffee 104 on 11/15"), 10, 15));
  assert.ok(same(at("coffee 110 nov 3"), 10, 3));
  assert.ok(same(at("coffee 110 3 nov"), 10, 3));
  assert.equal(parseEntry("coffee 110 nov 3", accounts, "cash", NOW)!.note, "Coffee");
  assert.equal(parseEntry("snacks 108 tomorrow", accounts, "cash", NOW)!.date, NOW + 86_400_000);
  assert.equal(parseEntry("coffee 106 last week", accounts, "cash", NOW)!.date, NOW - 7 * 86_400_000);
  assert.ok(same(at("coffee 111 last month"), 9, 17));
  assert.equal(parseEntry("coffee 113 3 araw ang nakaraan", accounts, "cash", NOW)!.date, NOW - 3 * 86_400_000);
  // Nov 17 2026 is a Tuesday, so "noong lunes" is the day before.
  assert.equal(parseEntry("coffee 112 noong lunes", accounts, "cash", NOW)!.date, NOW - 86_400_000);
  // An impossible date is ignored (and a bare fraction is not a date).
  assert.equal(parseEntry("coffee 100 feb 31", accounts, "cash", NOW)!.date, NOW);
  assert.equal(parseEntry("pizza 1/2 dozen 300", accounts, "cash", NOW)!.date, NOW);
});

test("pamasahe is transport", () => {
  assert.equal(parseEntry("pamasahe 50", accounts, "cash", NOW)!.cat, "Transport");
});
