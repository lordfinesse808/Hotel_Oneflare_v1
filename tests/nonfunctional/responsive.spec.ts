import { test, expect } from '../../utils/fixtures';

/** Tablet and large-desktop layouts (mobile lives in responsive.mobile.spec.ts). */

const noHorizontalScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe('Responsive layouts @ui @responsive', () => {
  test('TC-047: tablet 768x1024 - Rooms and Contact reflow without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    for (const p of ['/rooms', '/contact']) {
      await page.goto(p);
      expect(await noHorizontalScroll(page), p).toBe(true);
    }
  });

  test('TC-048: large desktop 1920x1080 - content centred, images not stretched', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/rooms');
    const main = await page.locator('main').first().boundingBox();
    expect(main).not.toBeNull();
    const container = await page.locator('main > *').first().boundingBox();
    if (container && container.width < 1900) {
      const left = container.x;
      const right = 1920 - (container.x + container.width);
      expect(Math.abs(left - right)).toBeLessThan(40);
    }
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});
