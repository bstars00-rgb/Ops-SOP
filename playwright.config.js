// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * E2E config. Serves the static site and runs the flows in tests/e2e.spec.js.
 * Run with:  SOP_TEST_ID=OHMYHOTEL SOP_TEST_PASS=*** npm run e2e
 * (Credentials are read from env so they never live in the repo.)
 */
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx -y serve -l 4321 .",
    url: "http://localhost:4321",
    reuseExistingServer: true,
    timeout: 60000
  }
});
