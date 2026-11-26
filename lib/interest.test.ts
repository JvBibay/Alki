import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "./store";
import { balance, streak } from "./stats";
import { dueInterest, nextInterestDate, periodEnd } from "./interest";

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();

/** 3.65% a year on ₱10,000 is exactly ₱1.00 a day, which keeps the sums easy to check. */
function make(over: Record<string, unknown> = {}, txs: unknown[] = []) {
  const s = normalize({
    accounts: [{ id: "a1", name: "Digital Bank", opening: 10_000, kind: "bank", color: "#0ea5e9", rate: 3.65, tax: 20, interestFreq: "monthly", interestFrom: at(2026, 11, 1, 0), ...over }],
    txs,
  });
  assert.ok(s);
  return s!;
}

test("monthly interest is posted after the month ends, net of tax, dated on its last day", () => {
  const r = dueInterest(make(), at(2026, 12, 2));
  assert.ok(r);
  assert.equal(r!.added.length, 1);
  const tx = r!.state.txs.find((t) => t.cat === "Interest")!;
  assert.equal(tx.amount, 24); // 30 days × ₱1.00 = ₱30, less 20% tax
  assert.equal(tx.type, "income");
  assert.equal(tx.auto, true);
  assert.equal(new Date(tx.date).getMonth(), 10, "dated in November");
  assert.equal(new Date(tx.date).getDate(), 30);
  assert.equal(r!.state.accounts[0].interestFrom, at(2026, 12, 1, 0), "now counting from December");
  assert.equal(balance(r!.state, r!.state.accounts[0]), 10_024);
});

test("nothing is posted before a period is over, and nothing is ever posted twice", () => {
  assert.equal(dueInterest(make(), at(2026, 11, 20)), null);
  const first = dueInterest(make(), at(2026, 12, 2))!;
  assert.equal(dueInterest(first.state, at(2026, 12, 2)), null, "same day: already done");
  assert.equal(dueInterest(first.state, at(2026, 12, 20)), null, "December isn't over yet");
});

test("several missed months are caught up, each earning on a balance that includes the last", () => {
  const r = dueInterest(make({ interestFrom: at(2026, 9, 1, 0) }), at(2026, 12, 2))!;
  const amounts = r.state.txs.filter((t) => t.cat === "Interest").map((t) => t.amount);
  assert.equal(amounts.length, 3); // Sep, Oct, Nov
  assert.equal(amounts[0], 24); // Sep: 30 days
  assert.ok(amounts[1] > 24.8, "Oct has 31 days on a slightly larger balance");
  assert.ok(amounts[2] > 24, "Nov earns on the compounded balance");
});

test("daily interest posts each finished day", () => {
  const r = dueInterest(make({ interestFreq: "daily", interestFrom: at(2026, 11, 20, 0) }), at(2026, 11, 22, 11))!;
  const list = r.state.txs.filter((t) => t.cat === "Interest");
  assert.equal(list.length, 2); // Nov 20 and Nov 21; Nov 22 isn't over
  assert.equal(list[0].amount, 0.8); // ₱1.00 less 20% tax
  assert.equal(r.state.accounts[0].interestFrom, at(2026, 11, 22, 0));
});

test("quarterly and yearly periods follow the calendar", () => {
  assert.equal(periodEnd(at(2026, 11, 15), "quarterly"), at(2027, 1, 1, 0));
  assert.equal(periodEnd(at(2026, 2, 15), "quarterly"), at(2026, 4, 1, 0));
  assert.equal(periodEnd(at(2026, 6, 1), "yearly"), at(2027, 1, 1, 0));
  const r = dueInterest(make({ interestFreq: "quarterly", interestFrom: at(2026, 10, 1, 0) }), at(2027, 1, 2))!;
  assert.equal(r.state.txs.filter((t) => t.cat === "Interest").length, 1);
  assert.equal(r.state.txs.find((t) => t.cat === "Interest")!.amount, 73.6); // 92 days × ₱1.00 × 0.8
});

test("interest follows the real daily balance, including spending part-way through", () => {
  // ₱9,000 goes out on Nov 16, so only the first 15 days earn on ₱10,000 and the rest on ₱1,000.
  const s = make({}, [{ id: "t1", type: "expense", amount: 9_000, cat: "Shopping", note: "Laptop", acc: "a1", date: at(2026, 11, 16) }]);
  const r = dueInterest(s, at(2026, 12, 2))!;
  const gross = 15 * 1.0 + 15 * 0.1; // = 16.5
  assert.equal(r.state.txs.find((t) => t.cat === "Interest")!.amount, Math.round(gross * 0.8 * 100) / 100);
});

test("only savings accounts that earn interest are touched", () => {
  assert.equal(dueInterest(make({ rate: undefined }), at(2026, 12, 2)), null);
  assert.equal(dueInterest(make({ kind: "cash" }), at(2026, 12, 2)), null);
  assert.equal(dueInterest(make({ archived: true }), at(2026, 12, 2)), null);
  assert.equal(dueInterest(make({ interestFrom: undefined }), at(2026, 12, 2)), null, "tracking hasn't started");
});

test("an empty or overdrawn account earns nothing but still moves on", () => {
  const r = dueInterest(make({ opening: -500 }), at(2026, 12, 2))!;
  assert.equal(r.added.length, 0);
  assert.equal(r.state.txs.filter((t) => t.cat === "Interest").length, 0);
  assert.equal(r.state.accounts[0].interestFrom, at(2026, 12, 1, 0));
});

test("tax of 0 keeps the whole amount, and the next credit date is the end of the period", () => {
  const r = dueInterest(make({ tax: 0 }), at(2026, 12, 2))!;
  assert.equal(r.state.txs.find((t) => t.cat === "Interest")!.amount, 30);
  assert.equal(nextInterestDate(make().accounts[0]), at(2026, 12, 1, 0));
});

test("saving and restoring keeps the interest settings, and drops bad ones", () => {
  const again = normalize(JSON.parse(JSON.stringify(make())))!;
  assert.equal(again.accounts[0].interestFreq, "monthly");
  assert.equal(again.accounts[0].interestFrom, at(2026, 11, 1, 0));
  const bad = make({ interestFreq: "hourly", interestFrom: "yesterday" });
  assert.equal(bad.accounts[0].interestFreq, undefined);
  assert.equal(bad.accounts[0].interestFrom, undefined);
});

test("automatic interest doesn't count as logging something today", () => {
  const now = at(2026, 12, 2);
  const auto = { id: "x", type: "income", amount: 5, cat: "Interest", note: "Interest", acc: "a1", date: now, auto: true } as const;
  assert.equal(streak([auto as never], now).loggedToday, false);
  assert.equal(streak([{ ...auto, auto: undefined } as never], now).loggedToday, true);
});

// ---- Rules that apply to any bank ----

test("a small balance: ₱187.16 at 3.25% a year, after 20% tax, earns ₱0.01 a day", () => {
  const s = make({ opening: 187.16, rate: 3.25, tax: 20, interestFreq: "daily", interestFrom: at(2026, 11, 19, 0) });
  const r = dueInterest(s, at(2026, 11, 20, 2))!;
  const tx = r.state.txs.find((t) => t.cat === "Interest")!;
  assert.equal(tx.amount, 0.01);
  // The real figure was ₱0.01333; the leftover ₱0.00333 is carried, not lost.
  assert.ok(Math.abs(r.state.accounts[0].interestCarry! - (187.16 * 0.0325 * 0.8) / 365 + 0.01) < 1e-6);
});

test("amounts under a centavo build up and are paid once they reach ₱0.01", () => {
  // ₱100 earns about ₱0.00712 a day after tax: nothing on day 1, ₱0.01 on day 2, and so on.
  const s = make({ opening: 100, rate: 3.25, tax: 20, interestFreq: "daily", interestFrom: at(2026, 11, 1, 0) });
  const r = dueInterest(s, at(2026, 11, 11))!; // ten finished days
  const list = r.state.txs.filter((t) => t.cat === "Interest");
  const posted = list.reduce((sum, t) => sum + t.amount, 0);
  const earned = 10 * ((100 * 0.0325 * 0.8) / 365);
  assert.ok(list.length >= 5 && list.length <= 8, "paid in 1-centavo steps, not every day");
  assert.ok(list.every((t) => t.amount >= 0.01));
  assert.ok(Math.abs(posted + (r.state.accounts[0].interestCarry ?? 0) - earned) < 1e-3, "posted plus carried equals what was earned");
});

test("a leap year uses 366 days", () => {
  const plain = dueInterest(make({ opening: 36_500, rate: 3.65, tax: 0, interestFreq: "daily", interestFrom: at(2026, 6, 10, 0) }), at(2026, 6, 11, 5))!;
  const leap = dueInterest(make({ opening: 36_500, rate: 3.65, tax: 0, interestFreq: "daily", interestFrom: at(2028, 6, 10, 0) }), at(2028, 6, 11, 5))!;
  assert.equal(plain.state.txs.find((t) => t.cat === "Interest")!.amount, 3.65); // ₱36,500 × 3.65% ÷ 365
  assert.equal(leap.state.txs.find((t) => t.cat === "Interest")!.amount, 3.64); // ÷ 366
});

test("a higher rate above a threshold: only the excess, or the whole balance", () => {
  const base = { opening: 2_000_000, rate: 3.25, rate2: 3.75, tierAt: 1_000_000, tax: 0, interestFreq: "daily", interestFrom: at(2026, 6, 10, 0) };
  const excess = dueInterest(make({ ...base, tierMode: "excess" }), at(2026, 6, 11, 5))!;
  const whole = dueInterest(make({ ...base, tierMode: "whole" }), at(2026, 6, 11, 5))!;
  const day = (yearly: number) => Math.floor((yearly / 365) * 100 + 1e-6) / 100;
  assert.equal(excess.state.txs.find((t) => t.cat === "Interest")!.amount, day(1_000_000 * 0.0325 + 1_000_000 * 0.0375));
  assert.equal(whole.state.txs.find((t) => t.cat === "Interest")!.amount, day(2_000_000 * 0.0375));
  // At or below the threshold, only the base rate applies.
  const low = dueInterest(make({ ...base, opening: 500_000 }), at(2026, 6, 11, 5))!;
  assert.equal(low.state.txs.find((t) => t.cat === "Interest")!.amount, day(500_000 * 0.0325));
});

test("tier and carry settings survive saving, and half-set tiers are dropped", () => {
  const s = make({ rate2: 3.75, tierAt: 1_000_000, tierMode: "whole", interestCarry: 0.004 });
  const again = normalize(JSON.parse(JSON.stringify(s)))!.accounts[0];
  assert.equal(again.rate2, 3.75);
  assert.equal(again.tierAt, 1_000_000);
  assert.equal(again.tierMode, "whole");
  assert.equal(again.interestCarry, 0.004);
  const half = make({ rate2: 3.75 }).accounts[0]; // a higher rate with no threshold means nothing
  assert.equal(half.rate2, undefined);
  assert.equal(half.tierAt, undefined);
});
