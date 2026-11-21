// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.PORT || 4173);

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,                       // no retries: a flaky test should fail loudly
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // PW_CHANNEL=chrome runs against an installed Google Chrome instead of
    // Playwright's bundled Chromium.
    channel: process.env.PW_CHANNEL || undefined,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined } },
  ],
  webServer: {
    command: `node server.js ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
