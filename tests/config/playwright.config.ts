import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Config for SEO Integration Tests
 *
 * This configuration sets up Playwright to:
 * 1. Start the SvelteKit dev server before running tests
 * 2. Use the correct base URL for navigation
 * 3. Configure browsers and test execution settings
 */
export default defineConfig({
  // Look for test files in the "tests/e2e" directory
  testDir: "../e2e",

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI for more stable results
  workers: process.env.CI ? 1 : 4,

  // Reporter to use - 'list' for development, 'html' for CI
  reporter: process.env.CI ? "html" : "list",

  // Global test configuration
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: "http://localhost:5173",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Take screenshots on failure
    screenshot: "only-on-failure",

    // Record video on failure
    video: "retain-on-failure",
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: "npx vite dev --port 5173 --host 0.0.0.0",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes timeout for server startup

    // For development, show server output
    stdout: process.env.CI ? "ignore" : "pipe",
    stderr: process.env.CI ? "ignore" : "pipe",
  },
});
