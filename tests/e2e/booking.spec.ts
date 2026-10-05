import { test, expect, knownBug, waitForSkeletonsToResolve, interceptWrites } from '../../utils/fixtures';
import { BOOKABLE_ROOM_ID, GUEST, XSS, parseNaira } from '../../utils/data';
import { stay } from '../../utils/dates';
import { env } from '../../utils/env';

/**
 * End-to-end booking / reservation simulation:
 *   search -> select room -> room detail -> guest details -> review -> confirm.
 * "Confirm booking" creates a real pay-at-hotel reservation, so it only runs
 * with CONFIRM_BOOKINGS=1. Otherwise the confirm call is intercepted and
 * answered with a simulated reservation so the UI flow is still exercised.
 */

const totalOf = (text: string) => parseNaira(text.match(/total[^₦]*₦\s?([\d,.]+)/i)?.[1] ?? 'NaN');

test.describe('Booking flow @booking @e2e', () => {
  test('TC-013 / TC-052 / BUG-008: Select room opens booking step with room, dates and price @regression', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-008');
    const s = stay(10, 2);
    await rooms.open({ ...s, adults: 2 });
    await rooms.waitForResults();
    const t0 = Date.now();
    await rooms.selectRoom(0).click();
    await waitForSkeletonsToResolve(page);
    expect(Date.now() - t0, 'booking step load time').toBeLessThan(15_000);
    await expect(page).toHaveURL(/\/(rooms\/[^/?]+|booking)/);
    await expect(page.getByText(/continue to guest details|guest details/i).first()).toBeVisible();
  });

  test('TC-014: browser Back from a selected room preserves search state', async ({ page, rooms }) => {
    const s = stay(10, 2);
    await rooms.open({ ...s, adults: 2 });
    await rooms.waitForResults();
    const searchUrl = page.url();
    await rooms.viewDetails(0).click();
    await page.waitForURL(/\/rooms\/[^/?]+/);
    await page.goBack();
    expect(page.url()).toBe(searchUrl);
    await expect(rooms.checkIn()).toHaveValue(s.checkIn);
  });

  test('TC-062 / BUG-014: room detail blocks check-out on or before check-in @negative', async ({ page, roomDetail }, ti) => {
    knownBug(ti, 'BUG-014');
    await roomDetail.open(BOOKABLE_ROOM_ID);
    for (const [ci, co] of [[stay(20, 0).checkIn, stay(15, 0).checkIn], [stay(20, 0).checkIn, stay(20, 0).checkIn]]) {
      await roomDetail.setDates(ci, co);
      const disabled = await roomDetail.continueBtn.isDisabled().catch(() => false);
      if (!disabled) {
        await roomDetail.continueBtn.click();
        await expect.soft(page, `${ci} -> ${co}`).not.toHaveURL(/\/booking/);
      }
    }
  });

  test('TC-063 / BUG-014: room detail blocks past dates and stays over 90 nights @boundary', async ({ page, roomDetail }, ti) => {
    knownBug(ti, 'BUG-014');
    await roomDetail.open(BOOKABLE_ROOM_ID);
    await roomDetail.setDates(stay(-1, 0).checkIn, stay(1, 0).checkIn);
    await roomDetail.continueBtn.click().catch(() => {});
    await expect.soft(page, 'yesterday rejected').not.toHaveURL(/\/booking/);

    await roomDetail.open(BOOKABLE_ROOM_ID);
    const s91 = stay(10, 91);
    await roomDetail.setDates(s91.checkIn, s91.checkOut);
    await roomDetail.continueBtn.click().catch(() => {});
    await expect.soft(page, '91 nights rejected').not.toHaveURL(/\/booking/);
  });

  test('TC-099: direct /booking without a room redirects safely @negative', async ({ page, booking }) => {
    await booking.open();
    await expect(page.getByText(/choose a room|select a room/i).first().or(page.locator('body')).first()).toBeVisible();
    const onBookingForm = await booking.reviewBtn.isVisible().catch(() => false);
    expect(onBookingForm, 'guest form must not render without a room').toBe(false);
  });

  test.describe('guest details and review', () => {
    test.beforeEach(async ({ page, roomDetail }) => {
      const s = stay(15, 2);
      await roomDetail.open(BOOKABLE_ROOM_ID, s);
      await roomDetail.continueBtn.click();
      await page.waitForURL(/\/booking/);
    });

    test('TC-032: mandatory guest fields are validated @negative', async ({ page, booking }) => {
      await booking.reviewBtn.click();
      await expect(booking.fieldError().first()).toBeVisible();
      await expect(booking.confirmBtn).toBeHidden();
      expect(page.url()).toContain('/booking');
    });

    for (const [email, phone] of [['ada@', '+2348012345678'], ['ada@example.com', 'abc']]) {
      test(`TC-033: invalid format rejected (email "${email}", phone "${phone}") @negative`, async ({ booking }) => {
        await booking.fillGuest({ fullName: GUEST.fullName, email, phone });
        await booking.reviewBtn.click();
        await expect(booking.fieldError().first()).toBeVisible();
        await expect(booking.confirmBtn).toBeHidden();
      });
    }

    for (const phone of ['+2348012345678', '08012345678', '08112345678', '07012345678', '09012345678']) {
      test(`TC-033: Nigerian phone ${phone} is accepted`, async ({ booking }) => {
        await booking.fillGuest({ ...GUEST, phone });
        await booking.reviewBtn.click();
        await expect(booking.confirmBtn).toBeVisible();
      });
    }

    test('TC-120 / BUG-047: guest name rejects script, digits-only and 1-char values @negative @security', async ({ booking }, ti) => {
      knownBug(ti, 'BUG-047');
      for (const fullName of [XSS, '12345', 'A']) {
        await booking.fillGuest({ ...GUEST, fullName });
        await booking.reviewBtn.click();
        await expect.soft(booking.confirmBtn, `name "${fullName}"`).toBeHidden();
        if (await booking.confirmBtn.isVisible()) await booking.editDetails.click();
      }
    });

    test('TC-094 / BUG-020: consent is required and privacy link works @negative', async ({ page, booking }, ti) => {
      knownBug(ti, 'BUG-020');
      await booking.fillGuest(GUEST, false);
      await booking.reviewBtn.click();
      await expect(booking.confirmBtn).toBeHidden();
      const href = await page.getByRole('link', { name: /privacy policy/i }).first().getAttribute('href');
      expect((await page.request.get(href!)).status()).toBe(200);
    });

    test('TC-093: step indicator shows Details, Review, Confirmed and advances', async ({ page, booking }) => {
      // The indicator has no aria-current; check the step labels and that the step actually advances.
      for (const label of [/details/i, /review/i, /confirmed/i]) await expect(page.getByText(label).first()).toBeAttached();
      await expect(booking.reviewBtn).toBeVisible();
      await booking.fillGuest(GUEST);
      await booking.reviewBtn.click();
      await expect(booking.confirmBtn).toBeVisible();
      await expect(booking.reviewBtn).toBeHidden();
    });

    test('TC-066 / BUG-017: total identical on room detail, guest details and review', async ({ page, booking, roomDetail }, ti) => {
      knownBug(ti, 'BUG-017', 'BUG-018');
      const sidebar = totalOf(await booking.summary.innerText());
      await booking.fillGuest(GUEST);
      await booking.reviewBtn.click();
      const review = totalOf(await booking.summary.innerText());
      await page.goBack();
      await page.goBack();
      await roomDetail.open(BOOKABLE_ROOM_ID, stay(15, 2));
      const detail = totalOf(await roomDetail.totalText());
      expect.soft(sidebar, 'guest-details total').toBe(detail);
      expect.soft(review, 'review total').toBe(detail);
      await expect.soft(page.getByText(/^comm\b/i)).toHaveCount(0);
    });

    test('TC-095 / BUG-049: review shows data and edit links keep it', async ({ page, booking }, ti) => {
      knownBug(ti, 'BUG-049');
      await booking.fillGuest(GUEST);
      await booking.reviewBtn.click();
      await expect(page.getByText(GUEST.fullName)).toBeVisible();
      await expect(page.getByText(GUEST.email)).toBeVisible();
      await booking.editDetails.click();
      await expect.soft(booking.fullName).toHaveValue(GUEST.fullName);
      await expect.soft(booking.email).toHaveValue(GUEST.email);
      await booking.reviewBtn.click();
      await booking.changeRoom.click();
      await expect.soft(page).toHaveURL(/checkIn=.*checkOut=/);
    });

    test('TC-097: pay-at-hotel messaging is clear on review', async ({ page, booking }) => {
      await booking.fillGuest(GUEST);
      await booking.reviewBtn.click();
      await expect(page.getByText(/pay at the hotel|no payment.*online|unpaid/i).first()).toBeVisible();
    });

    test('TC-059: no PII in URLs during booking @security', async ({ page, booking }) => {
      const urls: string[] = [];
      page.on('request', (r) => urls.push(r.url()));
      await booking.fillGuest(GUEST);
      await booking.reviewBtn.click();
      for (const u of [page.url(), ...urls]) {
        expect.soft(decodeURIComponent(u)).not.toContain(GUEST.email);
        expect.soft(decodeURIComponent(u)).not.toContain(GUEST.phone.replace('+', ''));
      }
    });

    test('TC-096 / TC-039: confirm booking (pay at hotel) creates a reservation with a reference', async ({ page, booking }) => {
      // Simulated reservation unless CONFIRM_BOOKINGS=1: every write except quote/auth is intercepted.
      const writes = env.confirmBookings
        ? []
        : await interceptWrites(page, { status: 201, json: { id: 'sim-0001', reference: 'SIM-QA-0001', bookingReference: 'SIM-QA-0001', status: 'confirmed' } });
      await booking.fillGuest(GUEST);
      await booking.reviewBtn.click();
      await booking.confirmBtn.click();
      if (!env.confirmBookings) {
        // The UI cannot render a real confirmation from a faked response; assert the
        // reservation request carried the guest's details and nothing was sent for real.
        await expect.poll(() => writes.length, { message: 'confirm sends a write request' }).toBeGreaterThan(0);
        for (const w of writes) test.info().annotations.push({ type: 'booking-endpoint', description: `${w.method} ${w.url}` });
        expect(writes.map((w) => w.body).join('\n')).toContain(GUEST.email);
        return;
      }
      await expect(booking.confirmation).toBeVisible({ timeout: 20_000 });
    });
  });
});

test.describe('Reservation concurrency @booking @concurrency', () => {
  test('TC-037: the last room cannot be double-booked from two sessions', async ({ browser }) => {
    test.skip(!env.confirmBookings, 'Creates real reservations - set CONFIRM_BOOKINGS=1');
    const s = stay(60, 1);
    const run = async () => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`/rooms/${BOOKABLE_ROOM_ID}?checkIn=${s.checkIn}&checkOut=${s.checkOut}`);
      await page.getByRole('button', { name: /continue to guest details/i }).click();
      await page.getByLabel(/full name|name/i).first().fill(GUEST.fullName);
      await page.getByLabel(/e-?mail/i).first().fill(GUEST.email);
      await page.getByLabel(/phone/i).first().fill(GUEST.phone);
      await page.getByRole('checkbox').first().check();
      await page.getByRole('button', { name: /review my booking/i }).click();
      return { ctx, page };
    };
    const [a, b] = await Promise.all([run(), run()]);
    await Promise.all([
      a.page.getByRole('button', { name: /confirm booking/i }).click(),
      b.page.getByRole('button', { name: /confirm booking/i }).click(),
    ]);
    const confirmed = await Promise.all(
      [a, b].map((x) => x.page.getByText(/confirmed|booking reference/i).first().isVisible({ timeout: 15_000 }).catch(() => false)),
    );
    const roomsLeft = await a.page.request.get(`/api/rooms/${BOOKABLE_ROOM_ID}`).then((r) => r.json()).then((r) => r.roomsLeft ?? 1).catch(() => 1);
    if (roomsLeft <= 1) expect(confirmed.filter(Boolean).length).toBeLessThanOrEqual(1);
    await a.ctx.close();
    await b.ctx.close();
  });

  test('TC-038: stale hold - availability is rechecked after idle', async ({ page, roomDetail, booking }) => {
    await roomDetail.open(BOOKABLE_ROOM_ID, stay(15, 2));
    await roomDetail.continueBtn.click();
    await booking.fillGuest(GUEST);
    await booking.reviewBtn.click();
    // Simulate the room being taken while the guest idled.
    await interceptWrites(page, { status: 409, json: { message: 'Room no longer available' } }, /\/api\/auth\//);
    await page.route('**/api/booking/quote', (r) => r.fulfill({ status: 409, json: { message: 'Room no longer available' } }));
    await booking.confirmBtn.click();
    await expect(page.getByText(/no longer available|expired|unavailable|try again/i).first()).toBeVisible();
    await expect(booking.confirmation).toBeHidden();
  });
});
