import { defineConfig, devices } from '@playwright/test';

const localBaseUrl = 'http://127.0.0.1:4173';
const baseURL = process.env.E2E_BASE_URL ?? localBaseUrl;

export default defineConfig({
  testDir: '../tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: './node_modules/.bin/vite --host 127.0.0.1 --port 4173',
        cwd: '..',
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
