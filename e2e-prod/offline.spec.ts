import { test, expect } from "@playwright/test";

test("the app opens and works with the network off", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
  // Wait for the worker to take control and cache the shell.
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 }).catch(async () => {
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 });
  });
  await page.waitForTimeout(1500); // let the background cache writes finish
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Hi! I.m Alki|Get started/).first()).toBeVisible();
  // And it still takes input offline (everything is local).
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByPlaceholder("Your name or nickname")).toBeVisible();
  await context.setOffline(false);
});
