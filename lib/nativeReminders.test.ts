import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshState } from "./store";
import type { State } from "./types";
import { dueNotification } from "./reminders";
import {
  cancelNativeReminders, CHANNEL, DUE_ID, inAndroidApp, NUDGE_ID, nativePermission, nativeRemindersAvailable,
  planNativeReminders, requestNativePermission, sendNativeTest, syncNativeReminders,
} from "./nativeReminders";

const NOW = new Date(2026, 10, 24, 8, 0).getTime(); // Tue Nov 24 2026, 8:00 local
const hourOf = (t: number) => new Date(t).getHours();
const dayOf = (t: number) => new Date(t).getDate();

function base(over: Partial<NonNullable<State["settings"]["reminders"]>> = {}): State {
  const s = freshState();
  s.accounts = [{ id: "cash", name: "Cash", opening: 1000, kind: "cash", color: "#000" }];
  s.defAcc = "cash";
  s.settings.reminders = { enabled: true, names: true, logNudge: true, ...over };
  // Meralco is due on the 26th (Thursday).
  s.planned = [{ id: "p1", name: "Meralco", type: "expense", amount: 3400, cat: "Bills", acc: "cash", day: 26, done: [] }];
  return s;
}

test("reminders off means nothing is scheduled", () => {
  const s = base({ enabled: false });
  assert.deepEqual(planNativeReminders(s, NOW), []);
});

test("a bill is announced from the day before, on the day, and every morning after while it is unpaid", () => {
  const plan = planNativeReminders(base(), NOW).filter((p) => p.id >= DUE_ID && p.id < NUDGE_ID);
  // Tue 24 is too early (the bill starts reminding on Wed 25).
  assert.deepEqual(plan.map((p) => dayOf(p.at)), [25, 26, 27, 28, 29, 30]);
  assert.ok(plan.every((p) => hourOf(p.at) === 9));
  assert.match(plan[0].body, /Meralco: due tomorrow/);
  assert.match(plan[1].body, /Meralco: due today/);
  assert.match(plan[2].body, /Meralco: overdue/);
  assert.equal(plan[0].title, "Kwenta: payment due soon");
  assert.equal(plan[2].title, "Kwenta: payment overdue ⚠️");
});

test("a bill marked paid stops reminding", () => {
  const s = base();
  s.planned[0].done = ["2026-10"]; // November (month index 10) is paid, so the next one is December's
  const plan = planNativeReminders(s, NOW).filter((p) => p.id < NUDGE_ID);
  assert.deepEqual(plan, []);
});

test("hiding bill names keeps the bill private", () => {
  const plan = planNativeReminders(base({ names: false }), NOW).filter((p) => p.id < NUDGE_ID);
  assert.ok(plan.length > 0);
  assert.ok(plan.every((p) => !/Meralco/.test(p.body)), "no bill name may appear");
  assert.match(plan[0].body, /A bill/);
});

test("a snoozed bill comes back on its return day", () => {
  const s = base();
  s.settings.snoozed = { "p-p1": new Date(2026, 10, 27).getTime() }; // hidden until Fri 27
  const plan = planNativeReminders(s, NOW).filter((p) => p.id < NUDGE_ID);
  assert.deepEqual(plan.map((p) => dayOf(p.at)), [27, 28, 29, 30]);
});

test("the evening nudge needs a logged entry, skips today once you have logged, and covers only the next few days", () => {
  const none = planNativeReminders(base(), NOW).filter((p) => p.id >= NUDGE_ID);
  assert.deepEqual(none, [], "nothing ever logged: no nudge");

  const s = base();
  s.txs = [{ id: "t", type: "expense", amount: 10, cat: "Food", note: "x", acc: "cash", date: new Date(2026, 10, 20, 12).getTime() }];
  const nudges = planNativeReminders(s, NOW).filter((p) => p.id >= NUDGE_ID);
  assert.deepEqual(nudges.map((p) => dayOf(p.at)), [24, 25, 26]);
  assert.ok(nudges.every((p) => hourOf(p.at) === 20));

  s.txs[0].date = new Date(2026, 10, 24, 7, 0).getTime(); // logged this morning
  assert.deepEqual(planNativeReminders(s, NOW).filter((p) => p.id >= NUDGE_ID).map((p) => dayOf(p.at)), [25, 26]);

  const off = base({ logNudge: false });
  off.txs = s.txs;
  assert.deepEqual(planNativeReminders(off, NOW).filter((p) => p.id >= NUDGE_ID), []);
});

test("a time that has already passed today is not scheduled", () => {
  const late = new Date(2026, 10, 26, 10, 0).getTime(); // Thu, after 9:00
  const plan = planNativeReminders(base(), late).filter((p) => p.id < NUDGE_ID);
  assert.ok(plan.every((p) => p.at > late));
  assert.equal(dayOf(plan[0].at), 27);
});

test("dueNotification groups a long list and words statements separately", () => {
  const D = 86_400_000;
  const today = new Date(2026, 10, 24).getTime();
  const items = ["A", "B", "C", "D", "E", "F"].map((t) => ({ title: t, due: today + D, kind: "bill" as const, from: today }));
  const n = dueNotification({ items }, today)!;
  assert.equal(n.body.split("\n").length, 5);
  assert.match(n.body, /\+2 more$/);
  const stmt = dueNotification({ items: [{ title: "BPI statement", due: today, kind: "statement", from: today }] }, today)!;
  assert.equal(stmt.title, "Kwenta: statement ready");
  assert.equal(dueNotification({ items: [] }, today), null);
});

// ---------- the bridge ----------

interface Call {
  plugin: string;
  method: string;
  options?: any;
}
function installBridge(opts: { headers?: { name: string }[]; permission?: string; pending?: number[] } = {}) {
  const calls: Call[] = [];
  (globalThis as any).window = {
    Capacitor: {
      PluginHeaders: opts.headers ?? [{ name: "LocalNotifications" }],
      nativePromise: async (plugin: string, method: string, options?: any) => {
        calls.push({ plugin, method, options });
        if (method === "checkPermissions" || method === "requestPermissions") return { display: opts.permission ?? "granted" };
        if (method === "getPending") return { notifications: (opts.pending ?? []).map((id) => ({ id })) };
        return {};
      },
    },
  };
  return calls;
}
beforeEach(() => {
  delete (globalThis as any).window;
});

test("outside the Android app, nothing is available and nothing is called", async () => {
  assert.equal(inAndroidApp(), false);
  assert.equal(nativeRemindersAvailable(), false);
  assert.equal(await syncNativeReminders(base(), NOW), 0);
});

test("an older Android app without the plugin is detected", () => {
  installBridge({ headers: [{ name: "App" }] });
  assert.equal(inAndroidApp(), true);
  assert.equal(nativeRemindersAvailable(), false);
});

test("sync clears what was scheduled, makes the channel, and schedules each reminder with an ISO time", async () => {
  const calls = installBridge({ pending: [1000, 1001, 2000] });
  const n = await syncNativeReminders(base(), NOW);
  assert.ok(n > 0);
  const methods = calls.map((c) => c.method);
  assert.deepEqual(methods.slice(0, 2), ["getPending", "cancel"]);
  assert.ok(methods.indexOf("createChannel") < methods.indexOf("schedule"));
  assert.deepEqual(calls[1].options.notifications.map((x: any) => x.id), [1000, 1001, 2000]);
  assert.ok(calls.every((c) => c.plugin === "LocalNotifications"));
  const sched = calls.find((c) => c.method === "schedule")!.options.notifications;
  assert.equal(sched.length, n);
  for (const x of sched) {
    assert.match(x.schedule.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.equal(x.schedule.allowWhileIdle, true);
    assert.equal(x.channelId, CHANNEL);
    assert.equal(x.largeBody, x.body);
  }
  assert.equal(calls.find((c) => c.method === "createChannel")!.options.importance, 4);
});

test("turning reminders off cancels everything and schedules nothing", async () => {
  const calls = installBridge({ pending: [1001] });
  assert.equal(await syncNativeReminders(base({ enabled: false }), NOW), 0);
  assert.deepEqual(calls.map((c) => c.method), ["getPending", "cancel"]);
  const again = installBridge({ pending: [] });
  await cancelNativeReminders();
  assert.deepEqual(again.map((c) => c.method), ["getPending"], "nothing pending: nothing to cancel");
});

test("permission answers are normalised, and a failure counts as denied when asking", async () => {
  installBridge({ permission: "granted" });
  assert.equal(await nativePermission(), "granted");
  installBridge({ permission: "prompt-with-rationale" });
  assert.equal(await nativePermission(), "prompt");
  installBridge({ permission: "denied" });
  assert.equal(await requestNativePermission(), "denied");
  (globalThis as any).window.Capacitor.nativePromise = async () => {
    throw new Error("boom");
  };
  assert.equal(await requestNativePermission(), "denied");
  assert.equal(await nativePermission(), "prompt");
});

test("the test notification is scheduled a couple of seconds ahead", async () => {
  const calls = installBridge();
  const before = Date.now();
  await sendNativeTest("hello");
  const sched = calls.find((c) => c.method === "schedule")!.options.notifications[0];
  const at = Date.parse(sched.schedule.at);
  assert.ok(at >= before + 1500 && at <= before + 5000);
  assert.equal(sched.body, "hello");
});
