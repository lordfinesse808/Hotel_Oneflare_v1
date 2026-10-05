import { defineConfig, devices } from '@playwright/test';
import { env } from './utils/env';

/**
 * Oneflare Hotels automated test suite.
 * Test IDs (TC-xxx) and bug IDs (BUG-xxx) map to
 * Oneflare_Bug_Reports_and_Test_Cases_WebSite_v2.xlsx.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: env.baseURL,
    locale: 'en-NG',
    timezoneId: 'Africa/Lagos',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'api', testDir: './tests/api', use: {} },
    {
      name: 'desktop-chromium',
      testIgnore: ['**/api/**', '**/*.mobile.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      testMatch: ['**/*.mobile.spec.ts'],
      use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } },
    },
    // Cross-browser (TC-049/TC-050). Opt in with BROWSERS=all.
    ...(process.env.BROWSERS === 'all'
      ? [
          { name: 'firefox', testMatch: ['**/e2e/**'], use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', testMatch: ['**/e2e/**'], use: { ...devices['Desktop Safari'] } },
          { name: 'mobile-safari', testMatch: ['**/e2e/**'], use: { ...devices['iPhone 13'] } },
        ]
      : []),
  ],
});
