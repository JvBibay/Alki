import { test } from "node:test";
import assert from "node:assert/strict";
import { importFile, toCSV } from "./backup";
import { freshState } from "./store";

const base = () => {
  const s = freshState();
  s.accounts = [{ id: "a1", name: "Cash", opening: 0, kind: "cash", color: "#2e7d4f" }];
  s.defAcc = "a1";
  s.photoKey = "k".repeat(44);
  s.txs = [{ id: "t1", type: "expense", amount: 120, cat: "Food", note: "Lunch", acc: "a1", date: 1, photo: "ph_abc123" }];
  return s;
};

test("a backup with photos hands them back for restoring, and keeps the photo link and key", () => {
  const photos = { ph_abc123: { iv: "aXY=", data: "ZGF0YQ==", type: "image/jpeg", created: 5 } };
  const r = importFile(JSON.stringify({ ...base(), photos }), freshState());
  assert.deepEqual(r.photos, photos);
  assert.match(r.message, /1 receipt photo\b/);
  assert.equal(r.state.txs[0].photo, "ph_abc123");
  assert.equal(r.state.photoKey, "k".repeat(44));
  assert.equal("photos" in r.state, false, "photos never end up inside the app data");
});

test("older backups without photos still import", () => {
  const r = importFile(JSON.stringify(base()), freshState());
  assert.equal(r.photos, undefined);
  assert.doesNotMatch(r.message, /photo/);
  assert.equal(r.state.txs.length, 1);
});

test("CSV export defuses formulas, and importing it gives the original notes back", () => {
  const s = base();
  const notes = ['=HYPERLINK("http://evil.example","click")', "@SUM(A1)", "-50 snacks", "+63 load", "plain note"];
  s.txs = notes.map((note, i) => ({ id: "x" + i, type: "expense" as const, amount: 10 + i, cat: "Other", note, acc: "a1", date: 1000 + i }));
  const csv = toCSV(s);
  const cells = csv.split("\n").slice(1).map((l) => l.split(",")[4] ?? "");
  // No text cell may start with a formula character.
  for (const c of cells) assert.doesNotMatch(c.replace(/^"/, ""), /^[=+\-@]/);
  const back = importFile(csv, freshState());
  assert.deepEqual(back.state.txs.map((t) => t.note), notes);
});

test("CSV import skips absurd amounts, and a backup with a non-finite amount drops that entry", () => {
  const csv = "date,type,amount,category,note,account\n2026-01-01,expense,5,Food,ok,Cash\n2026-01-02,expense,99999999999999,Food,huge,Cash";
  assert.deepEqual(importFile(csv, freshState()).state.txs.map((t) => t.note), ["ok"]);
  const raw = { ...base(), txs: [...base().txs, { id: "bad", type: "expense", amount: null, cat: "Food", note: "x", acc: "a1", date: 1 }] };
  assert.equal(importFile(JSON.stringify(raw), freshState()).state.txs.length, 1);
});
