import { test, expect } from "@playwright/test";
import { onboard } from "./helpers";

test("Wallet: no 'Alki's take' card, and the weekly chart spans the full width", async ({ page }) => {
  await onboard(page, "5000");
  await page.getByPlaceholder(/Tell Alki/).fill("lunch 180");
  await page.getByRole("button", { name: "Log it" }).click();
  await page.getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(page.getByText("Income & spending this week")).toBeVisible();
  await expect(page.getByText("Alki’s take")).toHaveCount(0);
  const [card, main] = await Promise.all([
    page.locator(".weekcard > .card").boundingBox(),
    page.locator("main").boundingBox(),
  ]);
  // The chart card fills the page width (less the side padding), instead of half of it.
  expect(card!.width).toBeGreaterThan(main!.width * 0.85);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "e2e-shots/wallet-fullwidth.png" });
});

test("Reminders: in an older Android app (no notifications plugin) it says so instead of claiming to work", async ({ page }) => {
  await page.addInitScript(() => {
    // The Capacitor shell is there, but this build of the app has no LocalNotifications plugin, and no web Notification API.
    (window as unknown as { Capacitor: object }).Capacitor = { PluginHeaders: [{ name: "App" }], nativePromise: async () => ({}) };
    delete (window as unknown as { Notification?: unknown }).Notification;
    delete (window as unknown as { PushManager?: unknown }).PushManager;
  });
  await onboard(page, "100");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByText("Daily reminders are off")).toBeVisible();
  await expect(page.getByText(/This version of the Kwenta Android app can.t show phone notifications/).first()).toBeVisible();
  await expect(page.getByText("Daily reminders are on")).toHaveCount(0);
});
