import { defineConfig } from "@playwright/test";

// Runs against a local dev server with the login gate off (see lib/session.ts).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 2, // the dev server compiles pages on demand; more parallel browsers cause timeouts
  expect: { timeout: 6_000 },
  retries: 0,
  reporter: "list",
  use: {
    actionTimeout: 12_000, // first use of a page can wait on a dev-server compile
    baseURL: "http://localhost:3111",
    channel: "chrome", // uses the installed Chrome, no browser download
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  },
  webServer: {
    command: "npm run dev -- -p 3111",
    url: "http://localhost:3111",
    reuseExistingServer: true,
    timeout: 120_000,
    env: { NEXT_PUBLIC_REQUIRE_LOGIN: "false" },
  },
});
