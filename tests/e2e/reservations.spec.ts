import { test, expect, knownBug } from '../../utils/fixtures';
import { BOOKABLE_ROOM_ID, GUEST } from '../../utils/data';
import { stay } from '../../utils/dates';
import { env, hasCredentials } from '../../utils/env';

/** Reservation lifecycle tests. Anything that writes real data needs CONFIRM_BOOKINGS=1. */

test.describe('Reservation lifecycle @booking @e2e', () => {
  test('TC-049: core flow search -> filter -> select room (run with BROWSERS=all for Firefox/WebKit) @compatibility', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-008');
    await rooms.open(stay(10, 2));
    await rooms.waitForResults();
    await rooms.filterCheckbox(/standard/i).first().check();
    await rooms.viewDetails(0).click();
    await expect(page).toHaveURL(/\/rooms\/[^/?]+/);
    await expect(page.getByRole('button', { name: /continue to guest details/i })).toBeVisible();
  });

  test('TC-006 / BUG-003: "rooms left" decrements after a booking', async ({ page, request, roomDetail, booking }, ti) => {
    test.skip(!env.confirmBookings, 'Creates a real reservation - set CONFIRM_BOOKINGS=1');
    knownBug(ti, 'BUG-003');
    const s = stay(45, 1);
    const left = async () => (await (await request.get(`/api/rooms/${BOOKABLE_ROOM_ID}?checkIn=${s.checkIn}&checkOut=${s.checkOut}`)).json()).roomsLeft as number;
    const before = await left();
    await roomDetail.open(BOOKABLE_ROOM_ID, s);
    await roomDetail.continueBtn.click();
    await booking.fillGuest(GUEST);
    await booking.reviewBtn.click();
    await booking.confirmBtn.click();
    await expect(booking.confirmation).toBeVisible({ timeout: 20_000 });
    expect(await left()).toBe(before - 1);
  });

  test('TC-042: signed-in customer can cancel a booking per policy', async ({ page, auth, roomDetail, booking, home }) => {
    test.skip(!env.confirmBookings || !hasCredentials(), 'Needs CONFIRM_BOOKINGS=1 and credentials');
    await home.open();
    await auth.signIn(env.email, env.password);
    await expect(auth.dialog).toBeHidden({ timeout: 15_000 });
    await roomDetail.open(BOOKABLE_ROOM_ID, stay(50, 1));
    await roomDetail.continueBtn.click();
    await booking.fillGuest({ ...GUEST, email: env.email });
    await booking.reviewBtn.click();
    await booking.confirmBtn.click();
    await expect(booking.confirmation).toBeVisible({ timeout: 20_000 });
    await page.goto('/account');
    await page.getByRole('button', { name: /cancel/i }).first().click();
    await page.getByRole('button', { name: /confirm|yes/i }).first().click().catch(() => {});
    await expect(page.getByText(/cancelled|canceled/i).first()).toBeVisible();
  });

  test('TC-106: agent can book for a client and see commissions', async () => {
    test.skip(!process.env.AGENT_EMAIL, 'Set AGENT_EMAIL / AGENT_PASSWORD for an agent test account');
  });

  // Online payment is not offered (pay at hotel). Kept as placeholders until a gateway ships.
  test.fixme('TC-034: successful card payment confirms booking', async () => {});
  test.fixme('TC-035: declined card shows error and keeps room held', async () => {});
  test.fixme('TC-036: gateway timeout / closed window leaves no confirmed booking', async () => {});
});

test.describe('Content review @content', () => {
  test('TC-121 / BUG-046: no typos, placeholders or test contacts on public pages', async ({ page, request }, ti) => {
    knownBug(ti, 'BUG-046');
    const bad = /lorem ipsum|placeholder|\bTODO\b|test@|live changing|or whatever amount|undefined|null\b|NaN/i;
    for (const p of ['/', '/rooms', '/branches', '/gallery', '/about', '/contact']) {
      await page.goto(p);
      expect.soft(await page.locator('body').innerText(), p).not.toMatch(bad);
    }
    expect.soft(await (await request.get('/api/customization')).text()).not.toMatch(/test@|live changing/i);
  });
});
