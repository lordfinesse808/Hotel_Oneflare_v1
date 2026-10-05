import { test, expect, knownBug, waitForSkeletonsToResolve } from '../../utils/fixtures';

/** Lightweight front-end performance checks using browser Performance APIs. */

async function measure(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      new Promise<{ lcp: number; cls: number; load: number }>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((l) => l.getEntries().forEach((e) => (lcp = Math.max(lcp, e.startTime)))).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) =>
          l.getEntries().forEach((e: any) => {
            if (!e.hadRecentInput) cls += e.value;
          }),
        ).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => {
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          resolve({ lcp, cls, load: nav.loadEventEnd - nav.startTime });
        }, 3000);
      }),
  );
}

test.describe('Performance @performance', () => {
  for (const path of ['/', '/rooms']) {
    test(`TC-051: LCP under 4s on Slow 4G for ${path}`, async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Network throttling needs CDP');
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Network.enable');
      // ~Slow 4G: 150ms RTT, 1.6 Mbps down, 750 Kbps up
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      await page.goto(path, { waitUntil: 'load', timeout: 60_000 });
      const m = await measure(page);
      await test.info().attach('metrics.json', { body: JSON.stringify(m), contentType: 'application/json' });
      expect(m.lcp).toBeLessThan(4000);
      await waitForSkeletonsToResolve(page, 5000);
    });

    test(`TC-053 / BUG-013: cumulative layout shift <= 0.1 on ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      const m = await measure(page);
      expect(m.cls).toBeLessThanOrEqual(0.1);
    });
  }

  test('TC-051: below-the-fold images are lazy-loaded', async ({ page }) => {
    await page.goto('/');
    const imgs = await page.locator('main img').evaluateAll((els) =>
      els.filter((e) => e.getBoundingClientRect().top > window.innerHeight * 1.5).map((e) => e.getAttribute('loading')),
    );
    for (const l of imgs) expect.soft(l).toBe('lazy');
  });

  test('TC-052 / BUG-008: skeleton loaders on the booking step resolve', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-008');
    await rooms.open();
    await rooms.waitForResults();
    await rooms.selectRoom(0).click();
    await waitForSkeletonsToResolve(page, 15_000);
  });
});
