import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "./store";
import { greetingName, peopleSummary } from "./people";
import { MAX_ITEMS, cleanNumber, defaultMethod, maskNumber, payMethods, payStatus, payableAccounts, prettyNumber, reminderContent, reminderText } from "./remindercard";

const DAY = 86_400_000;
const now = Date.now();
const fmt = (n: number) => `₱${n.toFixed(2)}`;
const date = () => "Nov 18";

function debt(id: string, person: string, direction: "owed" | "owe", amount: number, extra: Record<string, unknown> = {}) {
  return { id, person, direction, amount, note: "", created: now - DAY, payments: [], ...extra };
}

function summary(debts: unknown[], name = "Aaron") {
  const s = normalize({ accounts: [{ id: "a1", name: "Cash", opening: 0, kind: "cash", color: "#000" }], txs: [], debts })!;
  return peopleSummary(s).find((p) => p.name === name)!;
}

test("a card lists what they owe and the total", () => {
  const p = summary([debt("1", "Aaron", "owed", 51, { note: "Grab" }), debt("2", "Aaron", "owed", 81, { note: "Lunch" })]);
  const c = reminderContent(p, fmt, date)!;
  assert.equal(c.items.length, 2);
  assert.equal(c.items[0].label, "Grab");
  assert.equal(c.items[0].amount, "₱51.00");
  assert.equal(c.total, "₱132.00");
  assert.equal(c.more, 0);
});

test("only what's still unpaid is asked for", () => {
  const p = summary([debt("1", "Aaron", "owed", 100, { payments: [{ id: "p", amount: 40, date: now }] })]);
  const c = reminderContent(p, fmt, date)!;
  assert.equal(c.items[0].amount, "₱60.00");
  assert.equal(c.total, "₱60.00");
});

test("something you owe them is taken off the total", () => {
  const p = summary([debt("1", "Aaron", "owed", 500, { note: "Concert" }), debt("2", "Aaron", "owe", 120, { note: "Dinner" })]);
  const c = reminderContent(p, fmt, date)!;
  assert.equal(c.total, "₱380.00");
  assert.equal(c.items[0].negative, false);
  assert.equal(c.items[1].amount, "−₱120.00");
  assert.equal(c.items[1].negative, true);
});

test("a long list is capped, and the total still counts everything", () => {
  const many = Array.from({ length: MAX_ITEMS + 3 }, (_, i) => debt(String(i), "Aaron", "owed", 10, { note: `Item ${i}` }));
  const c = reminderContent(summary(many), fmt, date)!;
  assert.equal(c.items.length, MAX_ITEMS);
  assert.equal(c.more, 3);
  assert.equal(c.total, `₱${(10 * (MAX_ITEMS + 3)).toFixed(2)}`);
});

test("no card when they don't owe you overall", () => {
  assert.equal(reminderContent(summary([debt("1", "Aaron", "owe", 50)]), fmt, date), null);
  assert.equal(reminderContent(summary([debt("1", "Aaron", "owed", 50), debt("2", "Aaron", "owe", 50)]), fmt, date), null);
});

test("due dates show on the line", () => {
  const p = summary([debt("1", "Aaron", "owed", 50, { due: now + 5 * DAY })]);
  assert.equal(reminderContent(p, fmt, date)!.items[0].sub, "Due Nov 18");
});

test("the text version uses YOUR payment details, not theirs", () => {
  const p = summary([debt("1", "Aaron", "owed", 51, { note: "Grab" })]);
  const c = reminderContent(p, fmt, date)!;
  const text = reminderText("Aaron", c, "Salamat!", { info: "GCash 0917 000 0000" });
  assert.match(text, /^Hi Aaron!/);
  assert.match(text, /Grab: ₱51\.00/);
  assert.match(text, /Total: ₱51\.00/);
  assert.match(text, /GCash 0917 000 0000/);
  assert.doesNotMatch(reminderText("Aaron", c, "Salamat!"), /send it here/);
});

// ---- names and where to pay ----

test("titles stay with the name: Kuya Dan is not just Kuya", () => {
  assert.equal(greetingName("Kuya Dan"), "Kuya Dan");
  assert.equal(greetingName("Ate Joy Cruz"), "Ate Joy");
  assert.equal(greetingName("Sir Bry"), "Sir Bry");
  assert.equal(greetingName("Ma'am Joms"), "Ma'am Joms");
  assert.equal(greetingName("Jose Vincent B."), "Jose");
  assert.equal(greetingName("Aaron"), "Aaron");
  assert.equal(greetingName("  Kuya   Dan  "), "Kuya Dan");
  assert.equal(greetingName("Kuya"), "Kuya", "a lone title is all there is");
});

test("the reminder text greets Kuya Dan by name", () => {
  const p = summary([debt("1", "Kuya Dan", "owed", 1600, { note: "Shopping" })], "Kuya Dan");
  const c = reminderContent(p, fmt, date)!;
  assert.match(reminderText("Kuya Dan", c, "Salamat!"), /^Hi Kuya Dan!/);
});

function withPay() {
  return normalize({
    accounts: [
      { id: "m", name: "MariBank", opening: 0, kind: "bank", color: "#ff5722", inst: "maribank", payInfo: "MariBank 0917 000 0000", payQr: "data:image/png;base64,AAAA" },
      { id: "g", name: "GCash", opening: 0, kind: "ewallet", color: "#0ea5e9", inst: "gcash", payInfo: "GCash 0917 111 1111" },
      { id: "c", name: "Cash", opening: 0, kind: "cash", color: "#000" },
      { id: "x", name: "Old", opening: 0, kind: "bank", color: "#000", archived: true, payInfo: "Old 000" },
    ],
    txs: [],
    settings: { payInfo: "Default 0999", payQr: "data:image/png;base64,BBBB" },
  })!;
}

test("accounts with payment details become choices; empty and archived ones don't", () => {
  const ms = payMethods(withPay());
  assert.deepEqual(ms.map((m) => m.id), ["m", "g", "default"]);
  assert.equal(ms[0].qr, "data:image/png;base64,AAAA");
  assert.equal(ms[0].instId, "maribank");
  assert.equal(ms[1].qr, undefined);
  assert.equal(ms[2].label, "Other details");
});

test("the account the money was lent from is pre-selected, else the first", () => {
  const state = withPay();
  const ms = payMethods(state);
  const lentFromGcash = peopleSummary({ ...state, debts: [debt("1", "Aaron", "owed", 50, { acc: "g" })] as never })[0];
  assert.equal(defaultMethod(ms, lentFromGcash), "g");
  const lentFromCash = peopleSummary({ ...state, debts: [debt("2", "Aaron", "owed", 50, { acc: "c" })] as never })[0];
  assert.equal(defaultMethod(ms, lentFromCash), "m", "cash has no details, so fall back to the first");
  assert.equal(defaultMethod([], lentFromCash), "");
});

test("an account's payment details survive saving; a bad QR is dropped", () => {
  const again = normalize(JSON.parse(JSON.stringify(withPay())))!;
  assert.equal(again.accounts[0].payInfo, "MariBank 0917 000 0000");
  assert.equal(again.accounts[0].payQr, "data:image/png;base64,AAAA");
  const bad = normalize({ accounts: [{ id: "a", name: "A", opening: 0, kind: "bank", color: "#000", payQr: "javascript:alert(1)", payInfo: "   " }], txs: [] })!;
  assert.equal(bad.accounts[0].payQr, undefined);
  assert.equal(bad.accounts[0].payInfo, undefined);
});

// ---- account name and number ----

test("account numbers are easier to read", () => {
  assert.equal(prettyNumber("09171234567"), "0917 123 4567");
  assert.equal(prettyNumber("012345678901"), "0123 4567 8901");
  assert.equal(prettyNumber("0123 4567 8901"), "0123 4567 8901", "numbers typed with spaces are left as typed");
  assert.equal(prettyNumber("1234-5678-9012"), "1234-5678-9012");
  assert.equal(prettyNumber("  0123   4567 "), "0123 4567");
  assert.equal(prettyNumber("12345"), "12345", "short numbers are left alone");
});

test("hiding a number keeps the last 4 digits and the spacing", () => {
  assert.equal(maskNumber("0123 4567 8901"), "•••• •••• 8901");
  assert.equal(maskNumber("0917 123 4567"), "•••• ••• 4567");
  assert.equal(maskNumber("1234-5678-9012"), "••••-••••-9012");
  assert.equal(maskNumber("1234"), "1234", "nothing to hide in 4 digits or fewer");
});

test("only digits, spaces and dashes are kept in an account number", () => {
  assert.equal(cleanNumber("0123 4567 8901"), "0123 4567 8901");
  assert.equal(cleanNumber("acct# 0123-4567 <b>8901</b>"), "0123-4567 8901");
  assert.equal(cleanNumber("12"), undefined, "too short to be an account number");
  assert.equal(cleanNumber("abcdef"), undefined);
  assert.ok((cleanNumber("1".repeat(40)) ?? "").length <= 24, "kept to a sensible length");
});

test("the text version lists the bank, name and number", () => {
  const c = reminderContent(summary([debt("1", "Aaron", "owed", 51, { note: "Grab" })]), fmt, date)!;
  const text = reminderText("Aaron", c, "Salamat!", { bank: "MariBank", name: "Jose Vincent B.", number: "0123 4567 8901", info: "InstaPay is fine" });
  assert.match(text, /You can send it here:/);
  assert.match(text, /Bank\/app: MariBank/);
  assert.match(text, /Account name: Jose Vincent B\./);
  assert.match(text, /Account no\.: 0123 4567 8901/);
  assert.match(text, /InstaPay is fine/);
  assert.doesNotMatch(reminderText("Aaron", c, "Salamat!", {}), /send it here/);
});

test("an account with only a name and number is still a choice, and they survive saving", () => {
  const s = normalize({
    accounts: [{ id: "m", name: "MariBank", opening: 0, kind: "bank", color: "#ff5722", inst: "maribank", payName: "  Jose Vincent B.  ", payNumber: "0123 4567 8901" }],
    txs: [],
  })!;
  const a = s.accounts[0];
  assert.equal(a.payName, "Jose Vincent B.");
  assert.equal(a.payNumber, "0123 4567 8901");
  assert.deepEqual(payMethods(s).map((m) => [m.id, m.name, m.number]), [["m", "Jose Vincent B.", "0123 4567 8901"]]);
  const again = normalize(JSON.parse(JSON.stringify(s)))!.accounts[0];
  assert.equal(again.payNumber, "0123 4567 8901");
  const bad = normalize({ accounts: [{ id: "a", name: "A", opening: 0, kind: "bank", color: "#000", payNumber: "<script>", payName: "   " }], txs: [] })!.accounts[0];
  assert.equal(bad.payNumber, undefined);
  assert.equal(bad.payName, undefined);
});

// ---- setting up accounts ----

test("only real accounts can be paid into: not cards, locked savings or archived ones", () => {
  const s = normalize({
    accounts: [
      { id: "a", name: "MariBank", opening: 0, kind: "bank", color: "#000" },
      { id: "b", name: "GCash", opening: 0, kind: "ewallet", color: "#000" },
      { id: "c", name: "Cash", opening: 0, kind: "cash", color: "#000" },
      { id: "d", name: "Visa", opening: 0, kind: "credit", color: "#000" },
      { id: "e", name: "Deposit", opening: 0, kind: "locked", color: "#000" },
      { id: "f", name: "Old", opening: 0, kind: "bank", color: "#000", archived: true },
    ],
    txs: [],
  })!;
  assert.deepEqual(payableAccounts(s).map((a) => a.name), ["MariBank", "GCash", "Cash"]);
});

test("each account says what it has saved for getting paid", () => {
  const acct = (extra: Record<string, unknown>) =>
    normalize({ accounts: [{ id: "a", name: "A", opening: 0, kind: "bank", color: "#000", ...extra }], txs: [] })!.accounts[0];
  assert.equal(payStatus(acct({})), "Not set up");
  assert.equal(payStatus(acct({ payQr: "data:image/png;base64,AA" })), "QR saved");
  assert.equal(payStatus(acct({ payQr: "data:image/png;base64,AA", payNumber: "0123 4567 8901", payName: "Jose" })), "QR · number · name saved");
  assert.equal(payStatus(acct({ payInfo: "InstaPay is fine" })), "details saved");
});
