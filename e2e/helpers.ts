import { expect, type Page } from "@playwright/test";

/** Clicks through onboarding with a Cash account holding `opening` pesos. */
export async function onboard(page: Page, opening = "10000", name = "Tester", pin?: string) {
  // The Next dev-tools badge floats over the Home tab and eats taps; it does not exist in production.
  await page.addInitScript(() => {
    const st = document.createElement("style");
    st.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByPlaceholder("Your name or nickname").fill(name);
  await page.getByRole("button", { name: /Nice to meet you/ }).click();
  await page.getByRole("button", { name: "Continue" }).click(); // pay schedule
  await page.getByRole("button", { name: /^Cash/ }).click();
  await page.getByPlaceholder("0").first().fill(opening);
  await page.getByRole("button", { name: "Add account" }).click();
  if (pin) {
    await page.getByPlaceholder("PIN (4–6 digits)").fill(pin);
    await page.getByPlaceholder("Type it again").fill(pin);
    await page.getByRole("button", { name: "Set PIN" }).click();
  } else {
    await page.getByRole("button", { name: "Not now" }).click();
  }
  await page.getByRole("button", { name: "Start using Kwenta" }).click();
  await expect(page.getByText("Quick actions")).toBeVisible();
}

export function collectErrors(page: Page) {
  const errs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push("console: " + m.text());
  });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  return errs;
}
