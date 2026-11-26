import { test, expect } from "@playwright/test";
import { onboard } from "./helpers";

for (const [w, h] of [[768, 1024], [1024, 768], [1366, 768]]) {
  test(`tablet/desktop ${w}x${h}: tabs lay out without sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await onboard(page, "25000");
    for (const t of ["lunch 180", "grab 250", "salary 15000", "rent 8000", "netflix 549"]) {
      await page.getByPlaceholder(/Tell Alki/).fill(t);
      await page.getByRole("button", { name: "Log it" }).click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(5500);
    for (const t of ["Home", "Wallet", "Plan", "History"]) {
      await page.getByRole("button", { name: t, exact: true }).click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `e2e-shots/tab-${w}-${t}.png` });
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, W: document.documentElement.clientWidth }));
      expect.soft(o.sw, `${t} @${w}`).toBeLessThanOrEqual(o.W);
    }
  });
}
