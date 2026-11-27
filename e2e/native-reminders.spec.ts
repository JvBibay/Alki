import { test, expect, type Page } from "@playwright/test";
import { onboard } from "./helpers";

type Call = { method: string; options?: any };

/** Pretends to be the Kwenta Android app: a Capacitor bridge with the LocalNotifications plugin, recording every call. */
async function androidApp(page: Page, permission: "granted" | "denied" = "granted") {
  await page.addInitScript((perm) => {
    const calls: unknown[] = [];
    (window as any).__native = calls;
    (window as any).Capacitor = {
      PluginHeaders: [{ name: "LocalNotifications" }],
      nativePromise: async (plugin: string, method: string, options?: unknown) => {
        calls.push({ plugin, method, options });
        if (method === "checkPermissions" || method === "requestPermissions") return { display: perm === "granted" && method === "checkPermissions" ? "prompt" : perm };
        if (method === "getPending") return { notifications: [] };
        return {};
      },
    };
    // The Android web view has no web notification support.
    delete (window as any).Notification;
    delete (window as any).PushManager;
  }, permission);
}
const calls = (p: Page) => p.evaluate(() => (window as any).__native as Call[]);
const openReminders = async (p: Page) => {
  await p.getByRole("button", { name: "Open menu" }).click();
  await p.getByRole("menuitem", { name: "Settings" }).click();
};

test("Android app: turning reminders on asks Android for permission and schedules them on the phone", async ({ page }) => {
  await androidApp(page);
  await onboard(page, "1000");
  // A bill due tomorrow, so there is something to schedule.
  const tomorrow = new Date(Date.now() + 86_400_000).getDate();
  await page.getByRole("button", { name: "Add recurring item" }).click();
  await page.getByRole("button", { name: "Add a bill" }).click();
  await page.getByPlaceholder("Internet").fill("Meralco");
  await page.getByPlaceholder("0").first().fill("3400");
  await page.locator('input[type="number"][max="31"]').fill(String(tomorrow));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await openReminders(page);
  await expect(page.getByText("Daily reminders are off")).toBeVisible();
  // No "this browser can't" warnings: the Android app supports reminders through the phone itself.
  await expect(page.getByText(/can.t show phone notifications|doesn.t support notifications/)).toHaveCount(0);
  await page.getByRole("button", { name: "Turn on reminders" }).click();
  await expect(page.getByText("Daily reminders are on").first()).toBeVisible();
  const made = await calls(page);
  const methods = made.map((c) => c.method);
  expect(methods).toContain("requestPermissions");
  expect(methods).toContain("createChannel");
  const sched = made.filter((c) => c.method === "schedule").flatMap((c) => c.options.notifications);
  expect(sched.length).toBeGreaterThan(0);
  expect(sched.some((n: any) => /Meralco/.test(n.body))).toBe(true);
  for (const n of sched) expect(Date.parse(n.schedule.at)).toBeGreaterThan(Date.now());
  await page.screenshot({ path: "e2e-shots/native-on.png" });

  // The test button schedules an immediate notification through Android.
  await page.getByRole("button", { name: "Send a test" }).click();
  await expect(page.getByText(/Test notification sent/).first()).toBeVisible();
  const after = await calls(page);
  expect(after.filter((c) => c.method === "schedule").length).toBeGreaterThan(made.filter((c) => c.method === "schedule").length);

  // Turning it off cancels what Android has scheduled and shows off again.
  await page.getByRole("button", { name: "Turn off", exact: true }).first().click();
  await expect(page.getByText("Daily reminders are off")).toBeVisible();
});

test("Android app: if Android blocks notifications, reminders stay off and the screen says how to fix it", async ({ page }) => {
  await androidApp(page, "denied");
  await onboard(page, "1000");
  await openReminders(page);
  await page.getByRole("button", { name: "Turn on reminders" }).click();
  await expect(page.getByText(/Android Settings → Apps → Kwenta → Notifications/).first()).toBeVisible();
  await expect(page.getByText("Daily reminders are off")).toBeVisible();
  const methods = (await calls(page)).map((c) => c.method);
  expect(methods).not.toContain("schedule");
});
