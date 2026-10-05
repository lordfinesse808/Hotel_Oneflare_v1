import { test, expect, knownBug } from '../../utils/fixtures';
import { BOOKABLE_ROOM_ID, parseNaira } from '../../utils/data';
import { stay } from '../../utils/dates';

test.describe('Rooms listing @rooms', () => {
  test.beforeEach(async ({ rooms }) => {
    await rooms.open();
    await rooms.waitForResults();
  });

  test('TC-001 / BUG-001: every room card shows a loaded image with alt text @regression', async ({ rooms }, ti) => {
    knownBug(ti, 'BUG-001');
    const cards = rooms.cards();
    const n = await cards.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const img = cards.nth(i).locator('img').first();
      await expect.soft(img, `card ${i} image`).toBeVisible();
      if (await img.count()) {
        expect.soft(await img.getAttribute('alt'), `card ${i} alt`).toBeTruthy();
        expect.soft(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), `card ${i} loaded`).toBe(true);
      }
    }
  });

  test('TC-003 / BUG-002: card titles have no duplicated "Room" @regression', async ({ rooms }, ti) => {
    knownBug(ti, 'BUG-002');
    for (const t of await rooms.cardTitles()) expect.soft(t).not.toMatch(/\bRoom Room\b/i);
  });

  test('TC-004 / TC-005 / BUG-003: heading count equals distinct room types; no duplicate cards @regression', async ({ rooms }, ti) => {
    knownBug(ti, 'BUG-003');
    const texts = (await rooms.cardTexts()).map((t) => t.replace(/\d+ rooms? left/i, '').trim());
    expect.soft(new Set(texts).size, 'duplicate identical cards').toBe(texts.length);
    expect.soft(await rooms.headingCount()).toBe(new Set(await rooms.cardTitles()).size);
  });

  test('TC-009 / BUG-005: capacity text uses correct singular/plural @regression', async ({ rooms }, ti) => {
    knownBug(ti, 'BUG-005');
    for (const t of await rooms.cardTexts()) {
      expect.soft(t).not.toMatch(/\b1 adults\b|\b1 children\b|\b([2-9]|\d{2,}) adult\b|\b([2-9]|\d{2,}) child\b/i);
    }
  });

  test('TC-122: prices use consistent Naira formatting', async ({ rooms }) => {
    for (const t of await rooms.cardTexts()) {
      const prices = t.match(/₦\s?[\d,.]+/g) ?? [];
      expect.soft(prices.length, 'card shows a price').toBeGreaterThan(0);
      for (const p of prices) expect.soft(p).toMatch(/^₦\s?\d{1,3}(,\d{3})*(\.\d{2})?$/);
    }
  });

  test('TC-002 / BUG-001: fallback shown when room images fail to load @negative', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-001');
    await page.route(/\.(jpe?g|png|webp|avif)(\?.*)?$/i, (r) => r.abort());
    await rooms.open();
    await rooms.waitForResults();
    const cards = rooms.cards();
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      const box = await cards.nth(i).boundingBox();
      expect.soft(box?.height ?? 0, 'card layout intact').toBeGreaterThan(100);
      const img = cards.nth(i).locator('img').first();
      expect.soft(await img.count(), 'image/placeholder element present').toBeGreaterThan(0);
    }
  });
});

test.describe('Rooms search @rooms @search', () => {
  test('TC-007 / TC-008 / BUG-004: 2-adult search excludes rooms with max 1 adult @regression', async ({ rooms }, ti) => {
    knownBug(ti, 'BUG-004');
    await rooms.open({ ...stay(10, 2), adults: 2 });
    await rooms.waitForResults();
    for (const t of await rooms.cardTexts()) {
      const max = Number(t.match(/max\s+(\d+)\s+adult/i)?.[1] ?? 99);
      expect.soft(max, t.split('\n')[0]).toBeGreaterThanOrEqual(2);
    }
  });

  test('TC-024: zero adults is blocked @boundary', async ({ page, rooms }) => {
    await rooms.open();
    const adults = page.getByLabel(/adults/i).first();
    const min = Number((await adults.getAttribute('min')) ?? '1');
    expect(min).toBeGreaterThanOrEqual(1);
  });

  test('TC-020 / TC-064 / BUG-015: past check-in date is rejected @negative', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-015');
    await rooms.open();
    expect.soft(await rooms.checkIn().getAttribute('min'), 'picker disables past dates').toBeTruthy();
    await rooms.setDates('2025-01-01', '2025-01-03');
    await rooms.checkAvailability().click();
    await expect(page.getByText(/past|future|invalid date|choose.*date/i).first()).toBeVisible();
    expect(page.url()).not.toContain('checkIn=2025-01-01');
  });

  test('TC-021 / TC-064 / BUG-014: check-out before or equal to check-in is rejected @negative', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-014', 'BUG-015');
    await rooms.open();
    for (const [ci, co] of [[stay(20, 0).checkIn, stay(18, 0).checkIn], [stay(20, 0).checkIn, stay(20, 0).checkIn]]) {
      await rooms.setDates(ci, co);
      await rooms.checkAvailability().click();
      await expect.soft(page.getByText(/after check-?in|at least (1|one) night|invalid/i).first()).toBeVisible();
    }
  });

  test('TC-018 / BUG-012: dates are displayed unambiguously', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-012');
    await rooms.open();
    const visible = await rooms.checkIn().evaluate((el: HTMLInputElement) => el.type === 'date' ? null : el.value);
    if (visible !== null) expect(visible).toMatch(/[A-Za-z]{3}/);
    else expect(await page.locator('main').innerText()).toMatch(/\b\d{1,2}\s+[A-Z][a-z]{2}\b/);
  });

  test('TC-065 / BUG-016: default check-in is today in WAT at 00:05 @boundary', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-016');
    // 00:05 WAT == 23:05 UTC of the previous day
    await page.clock.setFixedTime(new Date('2026-10-05T23:05:00Z'));
    await rooms.open();
    await expect(rooms.checkIn()).toHaveValue('2026-10-06');
  });

  test('TC-022: searching a branch shows that branch in the heading', async ({ page, rooms }) => {
    await rooms.open();
    await rooms.search({ branch: 'Lekki' });
    await expect(page.getByRole('heading', { name: /Lekki/i }).or(page.locator('main').getByText(/Lekki/i).filter({ visible: true })).first()).toBeVisible();
    expect(page.url()).toMatch(/branchId=/);
  });

  test('TC-076 / BUG-025: Lagos branch lists no test rooms', async ({ rooms }, ti) => {
    knownBug(ti, 'BUG-025');
    await rooms.open();
    await rooms.search({ branch: 'Lagos' });
    for (const t of await rooms.cardTitles()) expect.soft(t).not.toMatch(/test|latest type/i);
  });

  test('TC-025 / BUG-017: card total = nightly rate x nights', async ({ rooms }) => {
    const s = stay(15, 2);
    await rooms.open(s);
    await rooms.waitForResults();
    const text = (await rooms.cardTexts())[0];
    const nightly = parseNaira(text.match(/₦\s?[\d,.]+(?=\s*\/\s*night)/i)?.[0] ?? '');
    const total = text.match(/total[^₦]*₦\s?([\d,.]+)/i)?.[1];
    test.skip(!total, 'Card shows only a nightly price');
    expect(parseNaira(total!)).toBeCloseTo(nightly * s.nights, 0);
  });

  test('TC-023: sold-out dates show a "no rooms available" message', async ({ page, rooms }) => {
    await page.route('**/api/rooms**', (r) => r.fulfill({ json: { data: [], total: 0 } }));
    await rooms.open(stay(10, 2));
    await expect(rooms.emptyState).toBeVisible();
  });
});

test.describe('Rooms filters @rooms @filters', () => {
  test.beforeEach(async ({ rooms }) => {
    await rooms.open();
    await rooms.waitForResults();
  });

  test('TC-026: room type filter shows only that type and untick restores', async ({ rooms }) => {
    const before = await rooms.cards().count();
    const box = rooms.filterCheckbox(/deluxe/i).first();
    await box.check();
    for (const t of await rooms.cardTitles()) expect.soft(t).toMatch(/deluxe/i);
    await box.uncheck();
    await expect(rooms.cards()).toHaveCount(before);
  });

  test('TC-027 / BUG-027: bed type filter returns matching rooms', async ({ rooms }, ti) => {
    knownBug(ti, 'BUG-027');
    await rooms.filterCheckbox(/queen/i).first().check();
    await expect(rooms.cards().first()).toBeVisible();
    for (const t of await rooms.cardTexts()) expect.soft(t).toMatch(/queen/i);
  });

  test('TC-028 / TC-079 / BUG-028: amenity filters return results with AND logic', async ({ rooms }, ti) => {
    knownBug(ti, 'BUG-028');
    await rooms.filterCheckbox(/air conditioning/i).first().check();
    await expect(rooms.cards().first(), 'single amenity returns rooms').toBeVisible();
    const one = await rooms.cards().count();
    await rooms.filterCheckbox(/bathtub/i).first().check();
    expect(await rooms.cards().count()).toBeLessThanOrEqual(one);
  });

  test('TC-029: incompatible filters show empty state with Clear filters @negative', async ({ rooms }, ti) => {
    knownBug(ti, 'NEW: empty state has no Clear filters control');
    await rooms.filterCheckbox(/presidential/i).first().check();
    await rooms.priceSlider.fill('20000').catch(() => {});
    await expect(rooms.emptyState).toBeVisible();
    await expect(rooms.clearFilters).toBeVisible();
  });

  test('TC-015 / BUG-009: price slider filters list, updates count, Clear filters restores', async ({ rooms }, ti) => {
    knownBug(ti, 'BUG-009');
    const before = await rooms.cards().count();
    await rooms.priceSlider.fill('30000');
    for (const t of await rooms.cardTexts()) {
      const price = parseNaira(t.match(/₦\s?[\d,.]+/)?.[0] ?? '0');
      expect.soft(price).toBeLessThanOrEqual(30000);
    }
    expect(await rooms.headingCount()).toBe(await rooms.cards().count());
    await rooms.clearFilters.click();
    await expect(rooms.cards()).toHaveCount(before);
  });

  test('TC-078 / BUG-026: slider range covers real min and max room prices @boundary', async ({ request, rooms }, ti) => {
    knownBug(ti, 'BUG-026');
    const body = await (await request.get('/api/rooms?limit=100')).json();
    const list: any[] = Array.isArray(body) ? body : body.data ?? body.items ?? [];
    const prices = list.map((r) => Number(r.price ?? r.rate ?? r.basePrice)).filter((n) => n > 0);
    test.skip(!prices.length, 'No price field in API payload');
    expect(Number(await rooms.priceSlider.getAttribute('max'))).toBeGreaterThanOrEqual(Math.max(...prices));
  });

  test('TC-030: last amenity (Work desk) is reachable and selectable @ui', async ({ rooms }) => {
    const desk = rooms.filterCheckbox(/work desk/i).first();
    await desk.scrollIntoViewIfNeeded();
    await desk.check();
    await expect(desk).toBeChecked();
  });

  test('TC-081: filters survive reload', async ({ page, rooms }, ti) => {
    knownBug(ti, 'TC-081 (Fail in workbook, no bug ID)');
    await rooms.filterCheckbox(/deluxe/i).first().check();
    await page.reload();
    await rooms.waitForResults();
    await expect(rooms.filterCheckbox(/deluxe/i).first()).toBeChecked();
  });
});

test.describe('Room details @rooms @details', () => {
  test('TC-031 / TC-088 / BUG-030: details page shows full room info', async ({ page, roomDetail }, ti) => {
    knownBug(ti, 'BUG-030');
    await roomDetail.open(BOOKABLE_ROOM_ID, stay(15, 2));
    await expect(roomDetail.title).toBeVisible();
    for (const h of [/what.?s in the room|amenities/i, /house rules/i, /cancellation/i]) {
      const heading = page.getByRole('heading', { name: h }).first();
      await expect.soft(heading).toBeVisible();
      const sectionText = await heading.locator('xpath=..').innerText().catch(() => '');
      expect.soft(sectionText.replace(/\s+/g, ' ').length, `${h} has content`).toBeGreaterThan(30);
    }
    await expect.soft(page.getByText(/room size/i).locator('xpath=..')).toContainText(/\d+\s*(m²|sqm|sq)/i);
    await expect.soft(page.locator('main img').first()).toBeVisible();
  });

  test('TC-090 / BUG-030: breadcrumb and "Other rooms at" include the branch', async ({ page, roomDetail }, ti) => {
    knownBug(ti, 'BUG-030');
    await roomDetail.open(BOOKABLE_ROOM_ID);
    await expect.soft(page.getByText(/Rooms\s*\/\s*\//)).toHaveCount(0);
    await expect.soft(page.getByRole('heading', { name: /^other rooms at\s*$/i })).toHaveCount(0);
  });

  test('TC-089: adults/children steppers respect capacity @boundary', async ({ roomDetail }) => {
    await roomDetail.open(BOOKABLE_ROOM_ID);
    const dec = roomDetail.stepper('adults', 'decrease');
    const inc = roomDetail.stepper('adults', 'increase');
    test.skip(!(await dec.isVisible().catch(() => false)), 'No adults stepper buttons found');
    for (let i = 0; i < 5 && (await dec.isEnabled()); i++) await dec.click();
    // The count sits between the -/+ buttons
    const count = async () => Number((await dec.locator('xpath=..').innerText()).match(/\d+/)?.[0] ?? NaN);
    expect(await count(), 'adults never below 1').toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 20 && (await inc.isEnabled()); i++) await inc.click();
    expect(await inc.isEnabled(), 'increase disabled at capacity').toBe(false);
  });

  test('TC-091 / TC-052 / BUG-037: invalid room ID shows a not-found state, not an endless skeleton', async ({ roomDetail }, ti) => {
    knownBug(ti, 'BUG-037');
    await roomDetail.open('does-not-exist');
    await expect(roomDetail.notFound).toBeVisible({ timeout: 15_000 });
  });

  test('TC-092 / BUG-031: searched guest count carries to room detail', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-031');
    await rooms.open({ ...stay(10, 2), adults: 2 });
    await rooms.waitForResults();
    await rooms.viewDetails(0).click();
    await page.waitForURL(/\/rooms\/[^/?]+/);
    const adults = page.getByLabel(/adults/i).first();
    const warning = page.getByText(/capacity|maximum/i).first();
    await expect(adults.and(page.locator('[value="2"]')).or(warning)).toBeVisible();
  });
});
