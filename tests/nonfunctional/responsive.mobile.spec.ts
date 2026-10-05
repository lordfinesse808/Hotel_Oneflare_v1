import { test, expect, knownBug } from '../../utils/fixtures';
import { BOOKABLE_ROOM_ID } from '../../utils/data';

/** Runs in the mobile-chromium project (375x812). */

const noHorizontalScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe('Mobile 375px @ui @responsive @mobile', () => {
  test('TC-046 / BUG-038: no horizontal scroll on Home, Rooms, Contact and room detail', async ({ page }, ti) => {
    knownBug(ti, 'BUG-038');
    for (const p of ['/', '/rooms', '/contact', `/rooms/${BOOKABLE_ROOM_ID}`]) {
      await page.goto(p);
      expect.soft(await noHorizontalScroll(page), p).toBe(true);
    }
  });

  test('TC-116 / BUG-038: Branches cards stack and buttons are not clipped', async ({ page }, ti) => {
    knownBug(ti, 'BUG-038');
    await page.goto('/branches');
    for (const btn of await page.getByRole('link', { name: /see rooms at/i }).all()) {
      const clipped = await btn.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect.soft(clipped).toBe(false);
    }
    expect.soft(await noHorizontalScroll(page)).toBe(true);
  });

  test('TC-117 / BUG-039: touch targets are at least 44px', async ({ page }, ti) => {
    knownBug(ti, 'BUG-039');
    for (const p of ['/', '/rooms']) {
      await page.goto(p);
      const small = await page.locator('a:visible, button:visible').evaluateAll((els) =>
        els
          .map((e) => ({ t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30), h: e.getBoundingClientRect().height }))
          .filter((x) => x.h > 0 && x.h < 44),
      );
      expect.soft(small, p).toEqual([]);
    }
  });

  test('TC-080: mobile filter drawer opens, applies and closes', async ({ page, rooms }) => {
    await rooms.open();
    await page.getByRole('button', { name: /filter/i }).first().click();
    const drawer = page.getByRole('dialog').first();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('checkbox', { name: /deluxe/i }).first().check();
    const show = drawer.getByRole('button', { name: /show \d+ rooms?/i });
    const n = Number(((await show.textContent()) ?? '').match(/\d+/)?.[0]);
    await show.click();
    await expect(drawer).toBeHidden();
    await expect(rooms.cards()).toHaveCount(n);
  });

  test('TC-086: hamburger menu opens, lists all links + Book now and closes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /toggle menu|menu/i }).first().click();
    for (const name of [/rooms/i, /branches/i, /gallery/i, /about/i, /contact/i, /book now/i]) {
      await expect.soft(page.getByRole('link', { name }).filter({ visible: true }).first()).toBeVisible();
    }
    await page.getByRole('button', { name: /close|toggle menu/i }).first().click();
    await expect(page.getByRole('link', { name: /book now/i }).filter({ visible: true })).toHaveCount(0);
  });

  test('TC-050: mobile search -> select room works with touch', async ({ page, rooms }) => {
    await rooms.open();
    await rooms.checkAvailability().tap();
    await rooms.waitForResults();
    await rooms.viewDetails(0).tap();
    await expect(page).toHaveURL(/\/rooms\/[^/?]+/);
  });
});
