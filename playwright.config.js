import { defineConfig, devices } from '@playwright/test';

const PORT = 8765;

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
    channel: process.env.CI ? undefined : 'msedge',
  },
  webServer: {
    command: `node tests/server.mjs . ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
