import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end tests (Phase 10). They run against apps that are already
 * running — locally (`next build` + `next start`) or deployed:
 *   WEB_URL=http://localhost:3300 ADMIN_URL=http://localhost:3301 pnpm e2e
 * Read-only on deployed sites except for a guest cart cookie.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3300",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
