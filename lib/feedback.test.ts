import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName } from "./testimonials";
import { askDue, cleanMessage, MAX_FEEDBACK, snoozeFor } from "./feedback";

const DAY = 86_400_000;
const now = Date.now();

test("messages are trimmed, squashed and capped; empty ones are rejected", () => {
  assert.equal(cleanMessage("  hello   there \n world "), "hello there world");
  assert.equal(cleanMessage("  "), null);
  assert.equal(cleanMessage("hi"), null);
  assert.equal(cleanMessage("x".repeat(5000))!.length, MAX_FEEDBACK);
});

test("Alki asks only after a week of real use", () => {
  assert.equal(askDue({ first: now - 2 * DAY }, 50, now), false, "too soon");
  assert.equal(askDue({ first: now - 8 * DAY }, 3, now), false, "hasn't used it much");
  assert.equal(askDue({ first: now - 8 * DAY }, 12, now), true);
});

test("rated or dismissed people are not asked again, and Not now waits two weeks", () => {
  assert.equal(askDue({ first: now - 30 * DAY, done: true }, 99, now), false);
  const snooze = snoozeFor(now);
  assert.equal(askDue({ first: now - 30 * DAY, snooze }, 99, now + 13 * DAY), false);
  assert.equal(askDue({ first: now - 30 * DAY, snooze }, 99, now + 15 * DAY), true);
});

test("the public name is trimmed and capped", () => {
  assert.equal(cleanName("  Juan   dela Cruz "), "Juan dela Cruz");
  assert.equal(cleanName("x".repeat(80)).length, 30);
  assert.equal(cleanName("   "), "");
});

import { filterFeedback, type AdminFeedback } from "./admin";
const fb = (o: Partial<AdminFeedback>): AdminFeedback => ({ id: "x", kind: "praise", message: "Great", rating: 3, contact_ok: false, public_ok: false, display_name: null, approved: false, status: "new", screen: null, app_version: null, created_at: "2026-01-01T00:00:00Z", email: null, ...o });

test("admin filters: new, wants-public (not yet approved), done, all", () => {
  const all = [fb({ id: "a" }), fb({ id: "b", status: "seen", public_ok: true }), fb({ id: "c", status: "done", public_ok: true, approved: true })];
  assert.deepEqual(filterFeedback(all, "new").map((x) => x.id), ["a"]);
  assert.deepEqual(filterFeedback(all, "public").map((x) => x.id), ["b"]);
  assert.deepEqual(filterFeedback(all, "done").map((x) => x.id), ["c"]);
  assert.equal(filterFeedback(all, "all").length, 3);
});

test("admin groups feedback by type: problems, ideas, praise; unseen first, then newest", async () => {
  const { groupByKind } = await import("./admin");
  const f = (id: string, kind: "idea" | "problem" | "praise", status: "new" | "seen" | "done", created_at: string) =>
    ({ id, kind, status, created_at, message: id, rating: null, contact_ok: false, public_ok: false, display_name: null, approved: false, screen: null, app_version: null, email: null }) as never;
  const g = groupByKind([
    f("praise1", "praise", "new", "2026-11-01"),
    f("idea-done", "idea", "done", "2026-11-05"),
    f("prob-old-new", "problem", "new", "2026-11-02"),
    f("prob-seen", "problem", "seen", "2026-11-09"),
    f("prob-new-newest", "problem", "new", "2026-11-08"),
  ]);
  assert.deepEqual(g.map((x) => x.kind), ["problem", "idea", "praise"]);
  assert.deepEqual(g[0].items.map((x) => x.id), ["prob-new-newest", "prob-old-new", "prob-seen"]);
  assert.deepEqual(groupByKind([f("a", "idea", "new", "2026-11-01")]).map((x) => x.kind), ["idea"], "empty groups are left out");
});
