import { defineConfig, devices } from '@playwright/test';

const deployedUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  timeout: 120_000,
  reporter: 'line',
  webServer:
    deployedUrl === undefined
      ? {
          command: 'pnpm dev --host 127.0.0.1 --port 4188',
          url: 'http://127.0.0.1:4188',
          reuseExistingServer: true,
        }
      : undefined,
  use: {
    baseURL: deployedUrl ?? 'http://127.0.0.1:4188',
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
