import { test } from "node:test";
import assert from "node:assert/strict";
import { addNotices, newBadgeNotices, unreadCount } from "./notices";
import { freshState } from "./store";
import type { Tx } from "./types";

const NOW = new Date(2026, 10, 18, 12).getTime();
const tx = (id: string): Tx => ({ id, type: "expense", amount: 100, cat: "Food", note: "x", acc: "a1", date: NOW });

test("nothing to announce on a fresh state", () => {
  assert.equal(newBadgeNotices(freshState(), NOW), null);
});

test("a newly earned badge is announced once", () => {
  const s = freshState();
  s.txs = [tx("1")];
  const first = newBadgeNotices(s, NOW);
  assert.ok(first);
  assert.deepEqual(first.seen, ["first"]);
  assert.equal(first.notices[0].title, "New badge: First Coin");
  s.settings.badgesSeen = first.seen;
  assert.equal(newBadgeNotices(s, NOW), null);
});

test("addNotices skips duplicates, puts new first and caps the list", () => {
  const mk = (id: string) => ({ id, kind: "badge" as const, icon: "🪙", title: id, text: "", at: 0, read: false });
  assert.deepEqual(addNotices([mk("a")], [mk("a"), mk("b")]).map((n) => n.id), ["b", "a"]);
  assert.equal(addNotices(Array.from({ length: 60 }, (_, i) => mk(String(i))), [mk("z")]).length, 50);
  assert.equal(unreadCount([mk("a"), { ...mk("b"), read: true }]), 1);
});
