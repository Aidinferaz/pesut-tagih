import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a local Supabase (`npm run db:start`) and the
 * dev server with DEV_EMAIL_LOGIN=true, signing in through Mailpit.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The dev server compiles each route on first visit, which is slow on CI runners.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/id`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
