import { test, expect, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const unlock = async (p: Page, pin: string) => {
  for (const d of pin) await p.locator(".lockscreen").getByRole("button", { name: d, exact: true }).click();
};
const openSettings = async (p: Page) => {
  await p.getByRole("button", { name: "Home", exact: true }).click(); // the menu button lives on Home
  await p.getByRole("button", { name: "Open menu" }).click();
  await p.getByRole("menuitem", { name: "Settings" }).click();
};

/** Closes Settings if it is still open (some actions, like undoing an import, already close it). */
const closeSettings = async (p: Page) => {
  await p.waitForTimeout(400);
  const dlg = p.getByRole("dialog", { name: "Settings" });
  if (await dlg.isVisible()) await dlg.getByRole("button", { name: "Back" }).first().click();
};

test("hide amounts masks money everywhere and shows it again", async ({ page }) => {
  await onboard(page, "12345");
  await page.getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(page.getByText("₱12,345").first()).toBeVisible();
  await page.getByRole("button", { name: "Hide amounts" }).first().click();
  await expect(page.getByText("₱12,345")).toHaveCount(0);
  const hidden = await page.locator("body").innerText();
  expect(hidden).not.toMatch(/12,?345/);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  expect(await page.locator("body").innerText()).not.toMatch(/12,?345|2,?[0-9]{3}\s*\n?Nov 30/);
  await page.getByRole("button", { name: "Wallet", exact: true }).click();
  await page.getByRole("button", { name: "Show amounts" }).first().click();
  await expect(page.getByText("₱12,345").first()).toBeVisible();
});

test("change the PIN, then remove it", async ({ page }) => {
  await onboard(page, "100", "Tester", "2468");
  await page.reload();
  await unlock(page, "2468");
  await openSettings(page);
  await page.getByRole("button", { name: "Change PIN" }).click();
  // Wrong current PIN is refused.
  await page.getByLabel("Current PIN").fill("0000");
  await page.getByLabel("New PIN (4–6 digits)").fill("1357");
  await page.getByLabel("Type it again").fill("1357");
  await page.getByRole("button", { name: "Save PIN" }).click();
  await expect(page.locator(".warnt").last()).toBeVisible();
  // Mismatched confirmation is refused.
  await page.getByLabel("Current PIN").fill("2468");
  await page.getByLabel("Type it again").fill("1111");
  await page.getByRole("button", { name: "Save PIN" }).click();
  await expect(page.locator(".warnt").last()).toBeVisible();
  // A correct change works.
  await page.getByLabel("Type it again").fill("1357");
  await page.getByRole("button", { name: "Save PIN" }).click();
  await expect(page.getByText("PIN changed.")).toBeVisible();
  // The old PIN no longer opens the app; the new one does.
  await page.reload();
  await unlock(page, "2468");
  await expect(page.getByText(/Wrong PIN/)).toBeVisible();
  await unlock(page, "1357");
  await expect(page.getByText("Quick actions")).toBeVisible();
  // Turn it off: the app opens without a PIN afterwards.
  await openSettings(page);
  await page.getByRole("button", { name: "Turn off" }).first().click();
  await page.getByLabel("Current PIN").fill("1357");
  await page.getByRole("button", { name: "Turn off", exact: true }).last().click();
  await expect(page.getByText("PIN lock turned off.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Quick actions")).toBeVisible();
  // and the data survived the re-encryption round trips
  await page.getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(page.getByText("₱100").first()).toBeVisible();
});

test("importing a backup replaces data, and 'Undo last import' brings the old data back", async ({ page }) => {
  await onboard(page, "777", "Tester");
  const backup = {
    accounts: [{ id: "x1", name: "Imported Bank", opening: 5000, kind: "bank", color: "#334155" }],
    txs: [{ id: "i1", type: "expense", amount: 123, cat: "Food", note: "from backup", acc: "x1", date: Date.now() }],
  };
  await openSettings(page);
  await page.locator('input[type="file"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByText(/It will replace everything/)).toBeVisible();
  await page.getByRole("button", { name: "Replace my data" }).click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(page.getByText("Imported Bank").first()).toBeVisible();
  await expect(page.getByText("₱4,877").first()).toBeVisible(); // 5000 - 123
  // Undo from the safety copy.
  await openSettings(page);
  await page.getByText("Undo last import").click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Wallet", exact: true }).click();
  await expect(page.getByText("Imported Bank")).toHaveCount(0);
  await expect(page.getByText("₱777").first()).toBeVisible();
});

test("a custom category with a keyword catches quick-add entries and survives a reload", async ({ page }) => {
  await onboard(page, "1000");
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await page.getByText("+ New category").click();
  await page.getByPlaceholder("e.g. Milk tea, Baby, Pets").fill("Milk tea");
  await page.getByPlaceholder("e.g. boba, chatime, coco").fill("boba, chatime");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText("Milk tea").first()).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByPlaceholder(/Tell Alki/).fill("chatime 120");
  await page.getByRole("button", { name: "Log it" }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByText(/Milk tea · Cash/).first()).toBeVisible();
});
