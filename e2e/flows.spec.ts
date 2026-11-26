import { test, expect, type Page } from "@playwright/test";
import { onboard, collectErrors } from "./helpers";

const keys = async (p: Page, s: string) => {
  for (const c of s) await p.getByRole("button", { name: c === "<" ? "Delete digit" : c, exact: true }).click();
};
const tab = (p: Page, n: string) => p.getByRole("button", { name: n, exact: true }).click();
const quick = async (p: Page, text: string) => {
  await p.getByPlaceholder(/Tell Alki/).fill(text);
  await p.getByRole("button", { name: "Log it" }).click();
  await p.waitForTimeout(300);
};

test("keypad expense updates balance and totals", async ({ page }) => {
  const errs = collectErrors(page);
  await onboard(page, "1000");
  await page.locator(".qbtn", { hasText: "Expense" }).click();
  await keys(page, "12.5");
  await keys(page, "5"); // 12.55
  await keys(page, "<"); // back to 12.5
  await keys(page, "0");
  await keys(page, "9"); // a third decimal must be ignored
  await page.screenshot({ path: "e2e-shots/10-keypad.png" });
  await page.getByRole("button", { name: /^Save/ }).click();
  await tab(page, "Wallet");
  await expect(page.getByText("₱987.50").first()).toBeVisible();
  expect(errs).toEqual([]);
});

test("income then undo restores balance", async ({ page }) => {
  await onboard(page, "500");
  // The very first entry triggers a badge toast that replaces the undo toast, so log (and clear) one first.
  await quick(page, "warmup 0.01");
  await page.waitForTimeout(6000);
  await page.locator(".qbtn", { hasText: "Income" }).click();
  await keys(page, "250");
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByText(/Saved ₱250/)).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await tab(page, "Wallet");
  await expect(page.getByText("₱499.99").first()).toBeVisible();
});

test("0.1 + 0.2 style amounts do not drift", async ({ page }) => {
  await onboard(page, "0");
  for (const t of ["salary 0.1", "salary 0.2", "tip 0.3"]) await quick(page, t);
  await tab(page, "Wallet");
  const txt = await page.locator("body").innerText();
  expect(txt).toMatch(/In ₱0\.30/);
  expect(txt).toMatch(/Out ₱0\.30/);
  expect(txt).toMatch(/Assets\s*₱0\s/); // 0.1 + 0.2 - 0.3 must be exactly zero, not 5.5e-17
  expect(txt).not.toMatch(/0\.0000|e-\d|NaN/);
});

test("huge and tiny amounts stay sane", async ({ page }) => {
  await onboard(page, "0");
  for (const t of ["rent 99999999999999", "snack 0.001", "x 1e5"]) await quick(page, t);
  await tab(page, "Wallet");
  const txt = await page.locator("body").innerText();
  console.log("HUGE:", txt.slice(0, 400).replace(/\n/g, " | "));
  expect(txt).not.toMatch(/NaN|Infinity|undefined/);
});

for (const w of [320, 360, 390, 430]) {
  test(`no horizontal overflow at ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 760 });
    await onboard(page, "12345.67", "A very long nickname indeed");
    for (const t of ["Home", "Wallet", "Plan", "History"]) {
      await tab(page, t);
      await page.waitForTimeout(300);
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, W: document.documentElement.clientWidth }));
      expect.soft(o.sw, `${t} @${w} scrollWidth`).toBeLessThanOrEqual(o.W);
    }
  });
}
