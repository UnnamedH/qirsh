import { defineConfig, devices } from '@playwright/test';

const PORT = 8765;
// Cloud sessions have a pre-installed Chromium that may not match this Playwright version, so a
// browser path can be given instead of downloading one.
const CHROMIUM = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://127.0.0.1:${PORT}/`,
    // Locally, use the Edge that ships with Windows so no browser download is needed.
    channel: process.env.CI || CHROMIUM ? undefined : 'msedge',
    ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM } } : {}),
  },
  webServer: {
    command: `node tests/server.mjs . ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
