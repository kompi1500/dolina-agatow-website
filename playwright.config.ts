import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  expect: { timeout: 10_000 },
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4325/dolina-agatow-website/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4325',
    url: 'http://127.0.0.1:4325/dolina-agatow-website/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
