import { test, expect, type Page } from "@playwright/test";
import { onboard, collectErrors } from "./helpers";

const keys = async (p: Page, s: string) => {
  for (const c of s) await p.getByRole("button", { name: c, exact: true }).click();
};
const tab = (p: Page, n: string) => p.getByRole("button", { name: n, exact: true }).click();

async function addAccount(page: Page, name: string, opening: string) {
  await tab(page, "Wallet");
  await page.getByRole("button", { name: /Add account/ }).first().click();
  await page.getByRole("button", { name: /^GCash/ }).first().click();
  await page.getByPlaceholder("0").first().fill(opening);
  await page.getByRole("button", { name: "Add account", exact: true }).last().click();
}

test("transfer with a fee moves money and charges the fee to the source", async ({ page }) => {
  const errs = collectErrors(page);
  await onboard(page, "1000");
  await addAccount(page, "GCash", "500");
  await page.waitForTimeout(500);
  await page.locator("nav button", { hasText: "Home" }).click();
  await page.locator(".qbtn", { hasText: "Transfer" }).click();
  await keys(page, "300");
  await page.getByText(/Fee \(optional/).locator("..").getByRole("textbox").fill("15");
  await expect(page.getByText("₱1,000 → ₱685")).toBeVisible(); // 300 out + 15 fee
  await expect(page.getByText("₱500 → ₱800")).toBeVisible();
  await page.getByRole("button", { name: "Save transfer" }).click();
  await tab(page, "Wallet");
  await expect(page.getByText("₱685").first()).toBeVisible();
  await expect(page.getByText("₱800").first()).toBeVisible();
  await expect(page.getByText(/Assets\s*₱1,485/)).toBeVisible(); // only the 15 fee left the system
  expect(errs).toEqual([]);
});
