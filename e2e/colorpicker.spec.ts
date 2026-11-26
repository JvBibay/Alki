import { test, expect, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const openPicker = async (p: Page) => {
  // Settings may already be open (Cancel closes only the dialog).
  if (!(await p.getByRole("dialog", { name: "Settings" }).isVisible())) {
    await p.getByRole("button", { name: "Open menu" }).click();
    await p.getByRole("menuitem", { name: "Settings" }).click();
  }
  await p.getByRole("radio", { name: /Custom/ }).click();
  await expect(p.getByRole("dialog", { name: "Custom app color" })).toBeVisible();
};
const dlg = (p: Page) => p.getByRole("dialog", { name: "Custom app color" });
const custom = (p: Page) => p.evaluate(() => document.documentElement.style.getPropertyValue("--custom"));

test("custom color dialog: hex, sliders, validation, cancel and use", async ({ page }) => {
  await onboard(page, "100");
  await openPicker(page);
  await page.screenshot({ path: "e2e-shots/color-1-open.png" });

  // Typing a hex moves the sliders and the preview.
  const hex = dlg(page).getByRole("textbox");
  await hex.fill("#D6B6C2");
  await expect(dlg(page).getByText("338°")).toBeVisible();
  await expect(dlg(page).getByText("15%")).toBeVisible();
  await expect(dlg(page).getByText("84%")).toBeVisible();
  // A 3-digit hex is understood.
  await hex.fill("#f0a");
  await expect(dlg(page).locator(".cpick-swatch")).toHaveText("FF00AA");

  // An invalid value shows a message, and doesn't change the color.
  await hex.fill("#12");
  await expect(dlg(page).getByText("Enter 3 or 6 hex digits")).toBeVisible();
  await expect(dlg(page).locator(".cpick-swatch")).toHaveText("FF00AA");

  // Dragging a slider rewrites the hex box. Brightness to 0 gives black.
  await hex.fill("#2f6fed");
  await dlg(page).getByLabel("Brightness").fill("0");
  await expect(hex).toHaveValue("#000000");
  await dlg(page).getByLabel("Brightness").fill("100");
  await dlg(page).getByLabel("Saturation").fill("100");
  await dlg(page).getByLabel("Hue").fill("240");
  await expect(hex).toHaveValue("#0000FF");

  // Cancel changes nothing.
  await dlg(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(await custom(page)).toBe("");

  // Use color applies it: the swatch, the app and the saved setting all follow.
  await openPicker(page);
  await dlg(page).getByRole("textbox").fill("#2f6fed");
  await dlg(page).getByRole("button", { name: "Use color" }).click();
  await expect(dlg(page)).toHaveCount(0);
  expect(await custom(page)).toBe("#2f6fed");
  await expect(page.getByRole("radio", { name: /Custom/ })).toHaveAttribute("aria-checked", "true");
  await page.reload();
  expect(await custom(page)).toBe("#2f6fed");

  // Reopening starts from the saved color.
  await openPicker(page);
  await expect(dlg(page).getByRole("textbox")).toHaveValue("#2F6FED");
});

test("a very light color is flagged, and Escape closes without applying", async ({ page }) => {
  await onboard(page, "100");
  await openPicker(page);
  await dlg(page).getByRole("textbox").fill("#ffeef3");
  await expect(dlg(page).getByText(/quite light/)).toBeVisible();
  await dlg(page).getByRole("textbox").fill("#2f6fed");
  await expect(dlg(page).getByText(/quite light/)).toHaveCount(0);
  await dlg(page).getByRole("textbox").fill("#ffeef3");
  await page.keyboard.press("Escape");
  await expect(dlg(page)).toHaveCount(0);
  expect(await custom(page)).toBe("");
});

for (const [name, w, h] of [["phone", 390, 844], ["small", 320, 640]] as const) {
  test(`custom color dialog fits on a ${name} screen, light and dark`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: "dark" });
    await onboard(page, "100");
    await openPicker(page);
    await dlg(page).getByRole("textbox").fill("#D6B6C2");
    await page.waitForTimeout(900); // let the open animation finish before looking at it
    await page.screenshot({ path: `e2e-shots/color-${name}-dark.png` });
    // Everything in the dialog is reachable: the buttons are on screen without scrolling the page sideways.
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, W: document.documentElement.clientWidth }));
    expect(o.sw).toBeLessThanOrEqual(o.W);
    await dlg(page).getByRole("button", { name: "Use color" }).scrollIntoViewIfNeeded();
    await expect(dlg(page).getByRole("button", { name: "Use color" })).toBeInViewport();
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForTimeout(900); // colors transition when the theme changes
    await page.screenshot({ path: `e2e-shots/color-${name}-light.png` });
  });
}
