const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false, // Serial execution is often more reliable when loading extensions
  workers: 1, // Restricting to 1 worker avoids extension storage state conflicts
  reporter: 'html',
  use: {
    headless: false, // MANDATORY: Chrome extensions only load in headful mode
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
