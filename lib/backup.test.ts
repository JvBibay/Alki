import { test } from "node:test";
import assert from "node:assert/strict";
import { importFile } from "./backup";
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
