import { test } from "node:test";
import assert from "node:assert/strict";
import { canAddAccount, daysLeft, describeAccess, hasPaid, trialEndingSoon, type Access } from "./plans";

const a = (o: Partial<Access>): Access => ({ loaded: true, active: false, plan: null, until: null, admin: false, trial: false, ...o });

test("the free plan allows two accounts, paid and admin are unlimited", () => {
  assert.equal(canAddAccount(a({}), 0), true);
  assert.equal(canAddAccount(a({}), 1), true);
  assert.equal(canAddAccount(a({}), 2), false);
  assert.equal(canAddAccount(a({}), 5), false, "people who already have more can't add, but keep theirs");
  assert.equal(canAddAccount(a({ active: true, plan: "annual" }), 9), true);
  assert.equal(canAddAccount(a({ active: true, admin: true }), 9), true);
});

test("paid screens stay open while the plan is still loading, and close for the free plan", () => {
  assert.equal(hasPaid(a({ loaded: false })), true);
  assert.equal(hasPaid(a({})), false);
  assert.equal(hasPaid(a({ active: true, plan: "lifetime" })), true);
});

test("the free trial opens everything and says how long is left", () => {
  const now = Date.now();
  const trial = a({ active: true, trial: true, until: new Date(now + 3 * 86_400_000 - 1000).toISOString() });
  assert.equal(canAddAccount(trial, 9), true);
  assert.equal(hasPaid(trial), true);
  assert.match(describeAccess(trial), /Free trial: 3 days left \(ends /);
  assert.equal(daysLeft(new Date(now + 3 * 86_400_000 - 1000).toISOString(), now), "3 days");
  assert.equal(daysLeft(new Date(now + 3600_000).toISOString(), now), "less than a day");
  assert.equal(canAddAccount(a({ trial: false }), 2), false, "after the trial the free limit applies again");
});

test("the trial reminder shows only in the last 2 days", () => {
  const now = Date.now();
  const t = (ms: number, o: Partial<Access> = {}) => a({ active: true, trial: true, until: new Date(now + ms).toISOString(), ...o });
  assert.equal(trialEndingSoon(t(5 * 86_400_000), now), false);
  assert.equal(trialEndingSoon(t(2 * 86_400_000 - 1000), now), true);
  assert.equal(trialEndingSoon(t(3600_000), now), true);
  assert.equal(trialEndingSoon(t(-1000), now), false, "already over");
  assert.equal(trialEndingSoon(t(3600_000, { admin: true }), now), false);
  assert.equal(trialEndingSoon(a({ active: true, plan: "annual" }), now), false);
});
