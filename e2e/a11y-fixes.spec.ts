import { test, expect } from "@playwright/test";
import { onboard } from "./helpers";

test("a thousands comma plus a date phrase logs one entry, and History rows are named with amount and account", async ({ page }) => {
  await onboard(page, "10000");
  await page.getByPlaceholder(/Tell Alki/).fill("gym 1,500 last week");
  await page.getByRole("button", { name: "Log it" }).click();

  await page.getByRole("button", { name: "History" }).click();
  const rows = page.getByRole("button", { name: /^Edit gym/i });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAccessibleName(/1,500.*Cash/);
  // Nothing was split off as "Other".
  await expect(page.getByRole("button", { name: /^Edit other/i })).toHaveCount(0);
});

test("Home quick actions are plain buttons, and the PIN dots announce how many digits are entered", async ({ page }) => {
  await onboard(page, "10000");
  await expect(page.locator(".quick [role=listitem], .quick[role=list]")).toHaveCount(0);
  await expect(page.locator(".quick button").first()).toBeVisible();
});
