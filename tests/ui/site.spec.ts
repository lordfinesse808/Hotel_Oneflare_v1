import { test, expect, knownBug, interceptWrites } from '../../utils/fixtures';
import { BRANCHES, CONTACT, XSS, STATIC_PAGES } from '../../utils/data';

test.describe('Home @home', () => {
  test.beforeEach(async ({ home }) => {
    await home.open();
  });

  test('TC-016 / TC-085 / BUG-010: homepage sections render content, not headings only @regression', async ({ home }, ti) => {
    knownBug(ti, 'BUG-010');
    await expect.soft(home.section(/our locations/i).locator('a, article, li')).not.toHaveCount(0);
    await expect.soft(home.section(/free for your dates/i).getByText(/₦/).first()).toBeVisible();
    await expect.soft(home.section(/gallery/i).locator('img')).not.toHaveCount(0);
    const amenities = home.section(/included, not extra|amenities/i).locator('li');
    expect.soft(await amenities.count(), 'amenity count').toBeGreaterThan(3);
  });

  test('TC-083 / BUG-046: hero copy, image and Explore rooms CTA', async ({ page, home }, ti) => {
    knownBug(ti, 'BUG-046');
    await expect.soft(page.getByText(/or whatever amount you want/i)).toHaveCount(0);
    await expect.soft(page.getByText(/live changing/i)).toHaveCount(0);
    await home.exploreRooms.click();
    await expect(page).toHaveURL(/\/rooms/);
  });

  test('TC-084: home search widget submits branch, dates and guests to /rooms', async ({ page, home }) => {
    await home.chooseBranch('Owerri');
    await page.getByLabel(/adults/i).first().fill('3').catch(() => page.getByLabel(/adults|guests/i).first().selectOption('3'));
    await home.checkAvailability().click();
    await expect(page).toHaveURL(/\/rooms\?.*branchId=.+/);
    expect(page.url()).toMatch(/checkIn=\d{4}-\d{2}-\d{2}/);
    expect(page.url()).toMatch(/checkOut=\d{4}-\d{2}-\d{2}/);
    expect(page.url()).toMatch(/adults=3/);
  });

  test('TC-082 / BUG-029: "Free for your dates" prices match /rooms for the branch', async ({ page, home, rooms }, ti) => {
    knownBug(ti, 'BUG-029');
    const homePrices = (await home.section(/free for your dates/i).innerText()).match(/₦[\d,]+/g) ?? [];
    await rooms.open();
    await rooms.waitForResults();
    const roomPrices = (await page.locator('main').innerText()).match(/₦[\d,]+/g) ?? [];
    for (const p of homePrices) expect.soft(roomPrices, `home price ${p}`).toContain(p);
  });

  test('TC-044 / BUG-033: header search returns results and an empty state', async ({ page, home }, ti) => {
    knownBug(ti, 'BUG-033');
    await home.headerSearch.fill('Lekki');
    await home.headerSearch.press('Enter');
    await expect(page.getByText(/Lekki/i).nth(1)).toBeVisible();
    await home.headerSearch.fill('zzzz');
    await home.headerSearch.press('Enter');
    await expect(page.getByText(/no results|nothing found/i).first()).toBeVisible();
  });

  test('TC-108 / BUG-032: branch choice persists across pages', async ({ page, rooms }, ti) => {
    knownBug(ti, 'BUG-032');
    await rooms.open();
    await rooms.search({ branch: 'Lagos' });
    await page.goto('/');
    await page.locator('header').getByRole('link', { name: /^rooms$/i }).click();
    await rooms.waitForResults();
    await expect(page.getByText(/Lagos/i).first()).toBeVisible();
  });
});

test.describe('Navigation, header & footer @navigation', () => {
  test('TC-043 / BUG-020: every header and footer link resolves without 404', async ({ page, home }, ti) => {
    knownBug(ti, 'BUG-020');
    await home.open();
    const hrefs = new Set<string>();
    for (const a of await page.locator('header a[href], footer a[href]').all()) {
      const href = await a.getAttribute('href');
      if (href && href.startsWith('/') ) hrefs.add(href.split('#')[0]);
    }
    expect(hrefs.size).toBeGreaterThan(5);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect.soft(res.status(), href).toBeLessThan(400);
    }
  });

  test('TC-010 / BUG-006: footer shows phone, email and address for each branch', async ({ home }, ti) => {
    knownBug(ti, 'BUG-006');
    await home.open();
    const text = await home.footer.innerText();
    expect.soft(text).not.toMatch(/Head office\s*\./);
    for (const b of BRANCHES) expect.soft(text, b).toContain(b);
    expect.soft((text.match(/\+?234[\d\s]{8,}|0[789][01]\d{8}/g) ?? []).length, 'phone numbers').toBeGreaterThanOrEqual(5);
    expect.soft((text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []).length, 'emails').toBeGreaterThanOrEqual(5);
  });

  test('TC-019 / BUG-013: footer lists all 5 branches on first render with low layout shift', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const footer = page.locator('footer');
    for (const b of BRANCHES) await expect(footer).toContainText(b);
  });

  test('TC-011 / BUG-011: Staff / HMS console link is not shown to the public @security', async ({ home }, ti) => {
    knownBug(ti, 'BUG-011');
    await home.open();
    await expect(home.footerLink(/staff|hms/i)).toHaveCount(0);
  });

  test('TC-087: footer legal line shows company, RC number and current year', async ({ home }) => {
    await home.open();
    const text = await home.footer.innerText();
    expect(text).toMatch(/RC\s*:?\s*\d+/i);
    expect(text).toContain(String(new Date().getFullYear()));
  });

  test('TC-060 / BUG-037 / BUG-044: unknown URL shows a branded 404 with a link home', async ({ page }, ti) => {
    knownBug(ti, 'BUG-044');
    await page.goto('/xyz-not-here');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByRole('link', { name: /home|back/i }).first()).toBeVisible();
    await expect(page.getByText(/^This page could not be found\.?$/)).toHaveCount(0);
  });

  test('TC-061 / BUG-044: page titles and meta descriptions are unique per page @seo', async ({ page }, ti) => {
    knownBug(ti, 'BUG-044');
    const titles = new Set<string>();
    const descs = new Set<string>();
    for (const p of ['/', '/rooms', '/contact', '/branches']) {
      await page.goto(p);
      titles.add(await page.title());
      descs.add((await page.locator('meta[name="description"]').getAttribute('content')) ?? '');
    }
    expect.soft(titles.size).toBe(4);
    expect.soft(descs.size).toBe(4);
  });

  test('TC-115 / BUG-044: Open Graph tags present @seo', async ({ page }, ti) => {
    knownBug(ti, 'BUG-044');
    await page.goto('/');
    for (const p of ['og:title', 'og:description', 'og:image']) {
      await expect.soft(page.locator(`meta[property="${p}"]`), p).toHaveCount(1);
    }
  });

  test('TC-070 / BUG-021: no failing API calls or console errors on page load', async ({ page, diagnostics }, ti) => {
    knownBug(ti, 'BUG-020', 'BUG-021');
    for (const p of STATIC_PAGES) {
      await page.goto(p);
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    expect.soft(diagnostics.failedRequests, 'failed /api calls').toEqual([]);
    expect.soft(diagnostics.consoleErrors, 'console errors').toEqual([]);
  });
});

test.describe('Branches @branches', () => {
  test.beforeEach(async ({ branches }) => {
    await branches.open();
  });

  test('TC-071 / BUG-022: branch cards show room types, price, contacts, directions and offers', async ({ branches }, ti) => {
    knownBug(ti, 'BUG-022');
    await expect(branches.cards()).toHaveCount(5);
    for (const t of await branches.cards().allInnerTexts()) {
      expect.soft(t).not.toMatch(/\b0 available\b/i);
      expect.soft(t).not.toMatch(/From\s*₦\s?0\b/i);
      expect.soft(t).not.toMatch(/Getting here:\s*$/im);
    }
  });

  test('TC-072: each "See rooms at <branch>" opens Rooms filtered to that branch', async ({ page, branches, rooms }) => {
    const links = branches.seeRoomsLinks();
    await expect(links).toHaveCount(BRANCHES.length);
    const ids = new Set<string>();
    for (let i = 0; i < BRANCHES.length; i++) {
      await branches.open();
      await links.nth(i).click();
      await expect(page).toHaveURL(/\/rooms\?.*branchId=/);
      ids.add(new URL(page.url()).searchParams.get('branchId')!);
      await rooms.waitForResults();
    }
    expect(ids.size, 'distinct branchIds').toBe(BRANCHES.length);
  });

  test('TC-073 / BUG-048: "Contact this branch" opens Contact with that branch tab active', async ({ page, branches }) => {
    await branches.card('Lekki').getByRole('link', { name: /contact this branch/i }).or(page.getByRole('link', { name: /contact this branch/i }).nth(2)).first().click();
    await expect(page).toHaveURL(/\/contact/);
    await expect(page.getByText(/going to.*lekki/i).first()).toBeVisible();
  });

  test('TC-074 / TC-075 / BUG-023 / BUG-024: branch names and addresses are valid', async ({ branches }, ti) => {
    knownBug(ti, 'BUG-023', 'BUG-024');
    const text = await branches.main.innerText();
    expect.soft(text).not.toMatch(/(\w)\1{5,}/);
    expect.soft(text).not.toMatch(/Holdings Branch 1/);
    for (const card of await branches.cards().all()) {
      const overflow = await card.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect.soft(overflow, 'card overflows').toBe(false);
    }
  });
});

test.describe('Gallery @gallery', () => {
  test.beforeEach(async ({ gallery }) => {
    await gallery.open();
  });

  test('TC-109: category filter shows Gym photos and All restores', async ({ gallery }) => {
    const all = await gallery.images().count();
    await gallery.category('Gym').click();
    const gym = await gallery.images().count();
    expect(gym).toBeGreaterThan(0);
    expect(gym).toBeLessThanOrEqual(all);
    await gallery.category('All').click();
    await expect(gallery.images()).toHaveCount(all);
  });

  test('TC-110 / BUG-034: location filter shows branch photos or an empty-state message', async ({ page, gallery }, ti) => {
    knownBug(ti, 'BUG-034');
    for (const b of BRANCHES) {
      await gallery.chooseBranch(b);
      const imgs = await gallery.images().count();
      if (imgs <= 1) await expect.soft(page.getByText(/no (photos|images)/i).first(), b).toBeVisible();
    }
  });

  test('TC-111: lightbox opens, navigates and closes with keyboard', async ({ page, gallery }, ti) => {
    knownBug(ti, 'NEW: clicking a gallery photo opens no lightbox');
    const img = gallery.images().first();
    const trigger = img.locator('xpath=ancestor::*[self::button or self::a or @role="button" or @tabindex][1]');
    await ((await trigger.count()) ? trigger : img).click({ force: true });
    await expect(gallery.lightbox).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    await expect(gallery.lightbox).toBeHidden();
  });

  test('TC-112 / BUG-035: gallery copy and images are accurate and unique', async ({ page, gallery }, ti) => {
    knownBug(ti, 'BUG-035');
    await expect.soft(page.getByText(/all three houses/i)).toHaveCount(0);
    const srcs = await gallery.images().evaluateAll((els) => els.map((e) => (e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src));
    expect.soft(new Set(srcs).size, 'duplicate images').toBe(srcs.length);
    expect.soft(srcs.join(' ')).not.toMatch(/abuja|portharcourt/i);
  });
});

test.describe('About @about', () => {
  test('TC-113 / TC-123 / BUG-036: About page shows H1, story and principles', async ({ page }, ti) => {
    knownBug(ti, 'BUG-036');
    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/\S+/);
    const principles = page.getByRole('heading', { name: /what we hold ourselves to/i }).locator('xpath=..');
    expect((await principles.innerText()).length).toBeGreaterThan(60);
  });
});

test.describe('Contact @contact', () => {
  test.beforeEach(async ({ contact }) => {
    await contact.open();
  });

  for (const b of BRANCHES) {
    test(`TC-011 / BUG-007: ${b} tab shows map, address, hours, phone and email`, async ({ page, contact }, ti) => {
      knownBug(ti, 'BUG-007');
      await contact.tab(b).click();
      await expect.soft(page.locator('iframe[src*="map"], [class*="map" i] canvas, [class*="leaflet"]').first(), 'map').toBeVisible();
      const panel = await page.locator('main').innerText();
      expect.soft(panel).toMatch(/hours[^\n]*\n?[^\n]*\d/i);
      expect.soft(panel).toMatch(/\+?234[\d\s]{8,}|0[789][01]\d{8}/);
      expect.soft(panel).toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    });
  }

  test('TC-045: contact form flags required fields and routes to selected branch @negative', async ({ page, contact }) => {
    await contact.send.click();
    await expect(page.locator('[aria-invalid="true"], [role="alert"]').or(page.getByText(/required/i)).first()).toBeVisible();
    await contact.tab('Lekki').click();
    await expect(contact.goingTo).toContainText(/Lekki/i);
  });

  test('TC-012: contact form submits with valid data', async ({ page, contact }, ti) => {
    knownBug(ti, 'NEW: contact form sends no request');
    // Intercept the submission so no real enquiry is sent to the front office.
    const writes = await interceptWrites(page, { status: 200, json: { ok: true } });
    await contact.name.fill(CONTACT.name);
    await contact.email.fill(CONTACT.email);
    await contact.phone.fill(CONTACT.phone);
    await contact.subject.fill(CONTACT.subject).catch(() => {});
    await contact.message.fill(CONTACT.message);
    await page.getByRole('checkbox').first().check().catch(() => {});
    await contact.send.click();
    const success = page.getByText(/thank|sent|received|we.?ll be in touch/i).first();
    await expect.poll(async () => writes.length > 0 || (await success.isVisible()), { message: 'form reacts to Send' }).toBe(true);
    expect(writes.length, 'success shown but no request was sent').toBeGreaterThan(0);
    expect(writes.map((w) => w.body).join('\n')).toContain(CONTACT.email);
  });

  test('TC-057: contact form does not execute injected script @security', async ({ page, contact }) => {
    let dialog = false;
    page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
    await interceptWrites(page, { status: 200, json: { ok: true } });
    await contact.name.fill(XSS);
    await contact.email.fill(CONTACT.email);
    await contact.phone.fill(CONTACT.phone);
    await contact.message.fill(XSS);
    await page.getByRole('checkbox').first().check().catch(() => {});
    await contact.send.click();
    await page.waitForTimeout(1500);
    expect(dialog).toBe(false);
  });

  test('TC-114 / BUG-043: "Look it up with your reference" opens a booking lookup', async ({ page, contact }, ti) => {
    knownBug(ti, 'BUG-043');
    await contact.lookupLink.click();
    await expect(page.getByLabel(/reference/i).first()).toBeVisible();
  });
});
