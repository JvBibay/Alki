import { test, expect, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const tapPin = async (p: Page, pin: string) => {
  for (const d of pin) await p.locator(".lockscreen").getByRole("button", { name: d, exact: true }).click();
};

test("the PIN lockout survives a page reload", async ({ page }) => {
  await onboard(page, "100", "Tester", "2468");
  await page.reload();
  await expect(page.getByText("Kwenta is locked")).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await tapPin(page, "1111");
    await page.waitForTimeout(600);
  }
  await expect(page.getByText(/Try again in \d+s/)).toBeVisible();
  // Reloading must not hand out five fresh tries.
  await page.reload();
  await expect(page.getByText("Kwenta is locked")).toBeVisible();
  await expect(page.getByText(/Try again in \d+s/)).toBeVisible();
  // And the keypad stays dead for the wait, so even the right PIN can't skip it.
  await expect(page.locator(".lockscreen").getByRole("button", { name: "2", exact: true })).toBeDisabled();
});

test("a wrong-PIN count is remembered across reloads", async ({ page }) => {
  await onboard(page, "100", "Tester", "2468");
  await page.reload();
  await tapPin(page, "1111");
  await expect(page.getByText(/4 tries left/)).toBeVisible();
  await page.reload();
  await tapPin(page, "2222");
  await expect(page.getByText(/3 tries left/)).toBeVisible();
  // A correct PIN unlocks and clears the count.
  await tapPin(page, "2468");
  await expect(page.getByText("Quick actions")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kwenta-lock"))).toBeNull();
});
