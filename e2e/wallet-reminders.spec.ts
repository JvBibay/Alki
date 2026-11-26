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

test("Reminders: where notifications are unsupported (Android app web view), it does not claim to be on", async ({ page }) => {
  await page.addInitScript(() => {
    // Looks like the Capacitor shell: a native bridge object, and no Notification or Push API.
    (window as unknown as { Capacitor: object }).Capacitor = {};
    delete (window as unknown as { Notification?: unknown }).Notification;
    delete (window as unknown as { PushManager?: unknown }).PushManager;
  });
  await onboard(page, "100");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByText("Daily reminders are off")).toBeVisible();
  await expect(page.getByText(/Kwenta Android app can.t show phone notifications/).first()).toBeVisible();
  await expect(page.getByText("Daily reminders are on")).toHaveCount(0);
});
