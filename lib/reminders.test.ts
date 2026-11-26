import { test } from "node:test";
import assert from "node:assert/strict";
import { dueSoon, reminderPayload, snoozeChoices, wakeTimes, whenText, withSnooze } from "./reminders";
import { freshState } from "./store";

const NOW = new Date(2026, 10, 18, 10).getTime(); // Wed Nov 18 2026

function sample() {
  const s = freshState();
  s.accounts = [{ id: "a1", name: "Cash", opening: 0, kind: "cash", color: "#000" }];
  s.planned = [
    { id: "globe", name: "Globe", type: "expense", amount: 999, cat: "Bills", acc: "a1", day: 19, done: [] }, // tomorrow
    { id: "rent", name: "Rent", type: "expense", amount: 8000, cat: "Bills", acc: "a1", day: 28, done: [] }, // in 10 days
    { id: "old", name: "Internet", type: "expense", amount: 1699, cat: "Bills", acc: "a1", day: 16, done: [] }, // overdue
  ];
  return s;
}

test("due soon: overdue first, only within the window", () => {
  const list = dueSoon(sample(), NOW);
  assert.deepEqual(list.map((d) => d.title), ["Internet", "Globe"]);
  assert.equal(list[0].daysLeft, -2);
  assert.equal(whenText(list[0].daysLeft), "2 days overdue");
  assert.equal(whenText(1), "Due tomorrow");
});

test("background payload: no amounts, names can be hidden", () => {
  const s = sample();
  const p = reminderPayload(s, NOW);
  assert.ok(p.items.some((i) => i.title === "Globe"));
  assert.ok(!JSON.stringify(p).includes("999"));
  s.settings.reminders = { enabled: true, names: false, logNudge: true };
  const hidden = reminderPayload(s, NOW);
  assert.ok(!JSON.stringify(hidden).includes("Globe"));
  assert.ok(hidden.items.every((i) => /bill|income|installment/i.test(i.title)));
});

// ---------- credit card statements and lead time ----------

function withCard(extra: Record<string, unknown> = {}) {
  const s = freshState();
  s.accounts = [
    { id: "c1", name: "BDO Visa", opening: 0, kind: "credit", color: "#000", limit: 50000, statementDay: 16, dueDay: 6, ...extra },
  ] as typeof s.accounts;
  s.txs = [{ id: "t1", type: "expense", amount: 5000, cat: "Shopping", note: "TV", acc: "c1", date: new Date(2026, 9, 20, 12).getTime() }];
  return s;
}

test("a new statement is flagged on its cut-off day and stays for a few days", () => {
  const s = withCard();
  // Statement day 16, today is the 18th: issued 2 days ago.
  const item = dueSoon(s, NOW).find((d) => d.kind === "statement");
  assert.ok(item);
  assert.equal(item!.daysLeft, -2);
  assert.equal(item!.amount, 5000);
  // Gone after the grace period.
  assert.ok(!dueSoon(s, new Date(2026, 10, 21, 10).getTime()).some((d) => d.kind === "statement"));
  // Not before the cut-off (still last month's statement, issued 32 days ago).
  assert.ok(!dueSoon(s, new Date(2026, 10, 15, 10).getTime()).some((d) => d.kind === "statement"));
});

test("confirming the bank's figure clears the statement reminder", () => {
  const s = withCard({ stmtFix: { key: "2026-11", amount: 5120 } });
  assert.ok(!dueSoon(s, NOW).some((d) => d.kind === "statement"));
});

test("no statement reminder when nothing was billed", () => {
  const s = withCard();
  s.txs = [];
  assert.ok(!dueSoon(s, NOW).some((d) => d.kind === "statement"));
});

test("card payments are flagged earlier with a longer lead time", () => {
  const s = withCard();
  const dueDay = new Date(2026, 11, 6, 10).getTime(); // payment due Dec 6
  const three = new Date(2026, 11, 3, 10).getTime();
  const five = new Date(2026, 11, 1, 10).getTime();
  assert.ok(dueSoon(s, three).some((d) => d.kind === "card"), "default lead is 3 days");
  assert.ok(!dueSoon(s, five).some((d) => d.kind === "card"));
  s.settings.reminders = { enabled: true, names: true, logNudge: true, cardLead: 5 };
  assert.ok(dueSoon(s, five).some((d) => d.kind === "card"));
  assert.ok(dueSoon(s, dueDay).some((d) => d.kind === "card"));
});

test("background payload says when each notification may start and hides statement names", () => {
  const s = withCard();
  s.settings.reminders = { enabled: true, names: false, logNudge: true, cardLead: 5 };
  const p = reminderPayload(s, NOW);
  const stmt = p.items.find((i) => i.kind === "statement")!;
  assert.equal(stmt.title, "A card statement");
  assert.ok(!JSON.stringify(p).includes("BDO"));
  assert.ok(!JSON.stringify(p).includes("5000"));
  const day = 86_400_000;
  const card = reminderPayload(withCard(), new Date(2026, 11, 1, 10).getTime()).items.find((i) => i.kind === "card")!;
  assert.equal(card.due - card.from, 3 * day);
});

// ---------- snooze and minimum due ----------

test("a snoozed item stays hidden until its return day, in the app and in notifications", () => {
  const s = sample();
  const globe = dueSoon(s, NOW).find((d) => d.title === "Globe")!;
  const day = 86_400_000;
  const today = new Date(2026, 10, 18).getTime();
  s.settings.snoozed = withSnooze(undefined, globe.id, today + day, NOW);
  assert.ok(!dueSoon(s, NOW).some((d) => d.title === "Globe"));
  // The background list keeps it but says not to notify before the return day, so it returns even if the app stays closed.
  const bg = reminderPayload(s, NOW).items.find((i) => i.title === "Globe");
  assert.equal(bg?.hideUntil, today + day);
  // Back the next day.
  assert.ok(dueSoon(s, NOW + day).some((d) => d.title === "Globe"));
  // The overdue one wasn't snoozed.
  assert.ok(dueSoon(s, NOW).some((d) => d.title === "Internet"));
});

test("snooze choices fit the item and old snoozes are pruned", () => {
  const s = sample();
  const far = dueSoon(s, NOW, 30).find((d) => d.title === "Rent")!; // 10 days away
  assert.deepEqual(snoozeChoices(far, NOW).map((c) => c.label), ["Tomorrow", "3 days", "Until due"]);
  assert.equal(snoozeChoices(far, NOW)[2].until, new Date(2026, 10, 28).getTime());
  const late = dueSoon(s, NOW).find((d) => d.title === "Internet")!;
  assert.deepEqual(snoozeChoices(late, NOW).map((c) => c.label), ["Tomorrow", "3 days", "Next week"]);
  const pruned = withSnooze({ old: new Date(2026, 10, 1).getTime(), keep: new Date(2026, 10, 25).getTime() }, "new", new Date(2026, 10, 19).getTime(), NOW);
  assert.deepEqual(Object.keys(pruned).sort(), ["keep", "new"]);
});

test("a card payment carries its minimum due", () => {
  const s = withCard();
  const card = dueSoon(s, new Date(2026, 11, 4, 10).getTime()).find((d) => d.kind === "card")!;
  assert.equal(card.amount, 5000);
  assert.equal(card.min, 500); // 3% would be 150, but the floor is 500
});

// ---------- push wake times ----------

test("wake times: 9:00 on each day that has something to remind about", () => {
  const s = sample(); // Internet overdue, Globe due tomorrow (the 19th), Rent in 10 days
  const w = wakeTimes(s, NOW).map((t) => new Date(t));
  // Overdue Internet keeps every day ready, so a wake each day for the next 7 days (today's 9:00 has passed).
  assert.equal(w.length, 6);
  assert.ok(w.every((d) => d.getHours() === 9 && d.getMinutes() === 0));
  assert.equal(w[0].getDate(), 19);
});

test("wake times: nothing due, nothing scheduled", () => {
  const s = freshState();
  s.accounts = [{ id: "a1", name: "Cash", opening: 0, kind: "cash", color: "#000" }];
  assert.deepEqual(wakeTimes(s, NOW), []);
});

test("wake times follow snoozes and never include what is due", () => {
  const s = withCard();
  const day = 86_400_000;
  // Card payment due Dec 6, default lead 3: first ready on Dec 3.
  const early = new Date(2026, 11, 1, 10).getTime();
  const days = wakeTimes(s, early).map((t) => new Date(t).getDate());
  assert.deepEqual(days, [3, 4, 5, 6, 7]);
  // Snoozed until the 5th: the 3rd and 4th are skipped, and it still comes back on the 5th.
  const card = dueSoon(s, new Date(2026, 11, 4, 10).getTime()).find((d) => d.kind === "card")!;
  s.settings.snoozed = { [card.id]: new Date(2026, 11, 5).getTime() };
  assert.deepEqual(wakeTimes(s, early).map((t) => new Date(t).getDate()), [5, 6, 7]);
  assert.ok(day > 0);
  assert.ok(wakeTimes(s, early).every((t) => typeof t === "number"));
});

test("wake times: a new statement only reminds during its first days", () => {
  const s = withCard();
  s.accounts[0].stmtFix = undefined;
  // Statement day 16; on the 18th it's 2 days old, so the 19th (3 days old) is the last reminder day.
  const days = wakeTimes(s, NOW).map((t) => new Date(t).getDate());
  assert.deepEqual(days, [19]);
});
