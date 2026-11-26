import { defineConfig } from "@playwright/test";

// Offline/service-worker checks need a production build (the worker only registers there).
// Build first with:  NEXT_PUBLIC_REQUIRE_LOGIN=false npm run build
export default defineConfig({
  testDir: "./e2e-prod",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: "list",
  use: { baseURL: "http://localhost:3222", channel: "chrome", viewport: { width: 390, height: 844 }, actionTimeout: 8_000 },
  webServer: { command: "npx next start -p 3222", url: "http://localhost:3222", reuseExistingServer: true, timeout: 60_000 },
});
