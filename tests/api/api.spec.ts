import { test, expect, knownBug } from '../../utils/fixtures';
import { BOOKABLE_ROOM_ID, BRANCH_ROOM_ID, POLICY_PAGES, STATIC_PAGES } from '../../utils/data';
import { stay } from '../../utils/dates';

/** Backend / HTTP-level checks. Fast, no browser needed. */

type Room = { id: string; name?: string; type?: string; images?: unknown[]; branchId?: string; price?: number; rate?: number };
const asList = (body: any): Room[] => (Array.isArray(body) ? body : body.data ?? body.items ?? body.rooms ?? []);

test.describe('Public API health @api', () => {
  test('TC-070 / BUG-021: /api/settings responds 2xx @functional', async ({ request }, ti) => {
    knownBug(ti, 'BUG-021');
    const res = await request.get('/api/settings');
    expect(res.status(), 'GET /api/settings').toBeLessThan(400);
  });

  for (const path of ['/api/branches', '/api/rooms', '/api/customization']) {
    test(`TC-070: ${path} returns JSON 200 @functional`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('application/json');
    });
  }

  test('TC-019: /api/branches returns all 5 branches', async ({ request }) => {
    const body = await (await request.get('/api/branches')).json();
    expect(asList(body).length).toBe(5);
  });

  test('TC-010 / BUG-006 / BUG-007: every branch has phone, email, hours and address', async ({ request }, ti) => {
    knownBug(ti, 'BUG-006', 'BUG-007', 'BUG-022');
    const branches: any[] = asList(await (await request.get('/api/branches')).json());
    for (const b of branches) {
      expect.soft(b.phone, `${b.name} phone`).toBeTruthy();
      expect.soft(b.email, `${b.name} email`).toBeTruthy();
      expect.soft(b.hours, `${b.name} hours`).toBeTruthy();
      expect.soft(b.address, `${b.name} address`).toBeTruthy();
    }
  });

  test('TC-074 / BUG-023 / BUG-024: branch addresses are well-formed', async ({ request }, ti) => {
    knownBug(ti, 'BUG-023', 'BUG-024');
    const branches: any[] = asList(await (await request.get('/api/branches')).json());
    for (const b of branches) {
      expect.soft(b.address ?? '', `${b.name} address`).not.toMatch(/(.)\1{4,}/); // "Roaddddd"
      expect.soft(b.address ?? '', `${b.name} address`).not.toMatch(/^\d+\s+\d+\s/); // "1 12 Marina Road"
      expect.soft(b.name ?? '', `${b.name} name`).toMatch(/Oneflare Grand Plaza - .+ Branch/);
    }
  });

  test('TC-001 / BUG-001: every room has at least one image', async ({ request }, ti) => {
    knownBug(ti, 'BUG-001');
    const rooms = asList(await (await request.get('/api/rooms?limit=100')).json());
    expect(rooms.length).toBeGreaterThan(0);
    for (const r of rooms) expect.soft(r.images?.length ?? 0, `${r.name} images`).toBeGreaterThan(0);
  });

  test('TC-003 / BUG-002: room names do not duplicate "Room"', async ({ request }, ti) => {
    knownBug(ti, 'BUG-002');
    const rooms = asList(await (await request.get('/api/rooms?limit=100')).json());
    for (const r of rooms) expect.soft(r.name ?? '', 'room name').not.toMatch(/\bRoom Room\b/i);
  });

  test('TC-077 / BUG-025 / BUG-046: no test or placeholder records in public payloads @regression', async ({ request }, ti) => {
    knownBug(ti, 'BUG-025', 'BUG-046');
    const testy = /\btest(room|type|bed)?\d*\b|testroom|testbed|placeholder|lorem ipsum|test@/i;
    for (const path of ['/api/rooms?limit=100', '/api/branches', '/api/customization']) {
      const text = await (await request.get(path)).text();
      expect.soft(text, path).not.toMatch(testy);
    }
  });

  test('TC-022 / BUG-025: rooms are scoped by branchId', async ({ request }, ti) => {
    knownBug(ti, 'BUG-025');
    const branches: any[] = asList(await (await request.get('/api/branches')).json());
    const all = await (await request.get('/api/rooms?limit=100')).json();
    const allTotal = all.total ?? asList(all).length;
    for (const b of branches) {
      const scoped = await (await request.get(`/api/rooms?branchId=${b.id}&limit=100`)).json();
      const list = asList(scoped);
      expect.soft(scoped.total ?? list.length, `${b.name} returns whole catalogue`).toBeLessThan(allTotal);
      for (const r of list) expect.soft(r.branchId, `${r.name} branchId`).toBe(b.id);
    }
  });

  test('TC-013 / BUG-008: GET /api/rooms/{id} works for branch rooms', async ({ request }, ti) => {
    knownBug(ti, 'BUG-008');
    expect((await request.get(`/api/rooms/${BOOKABLE_ROOM_ID}`)).status()).toBe(200);
    expect((await request.get(`/api/rooms/${BRANCH_ROOM_ID}`)).status()).toBe(200);
  });
});

test.describe('Quote API @api @booking', () => {
  const quote = (request: any, data: Record<string, unknown>) =>
    request.post('/api/booking/quote', { data: { roomId: BOOKABLE_ROOM_ID, adults: 1, children: 0, ...stay(15, 2), ...data } });

  /** Unwraps { data: {...} } / { quote: {...} } envelopes and attaches the raw body. */
  const quoteBody = async (res: any) => {
    const raw = await res.text();
    await test.info().attach('quote-response.json', { body: raw, contentType: 'application/json' });
    const body = JSON.parse(raw);
    return body.data ?? body.quote ?? body;
  };

  test('TC-025: valid 2-night quote returns nights, rate and total', async ({ request }) => {
    const res = await quote(request, {});
    expect(res.status()).toBe(200);
    const q = await quoteBody(res);
    expect(q.nights).toBe(2);
    expect(q.roomTotal).toBeCloseTo(q.rate * 2, 2);
  });

  test('TC-025: 3-night total = 3 x nightly rate', async ({ request }) => {
    const q = await quoteBody(await quote(request, stay(15, 3)));
    expect(q.nights).toBe(3);
    expect(q.roomTotal).toBeCloseTo(q.rate * 3, 2);
  });

  test('TC-067 / BUG-018: tax lines are guest-facing and correctly calculated', async ({ request }, ti) => {
    knownBug(ti, 'BUG-018');
    const q = await quoteBody(await quote(request, {}));
    expect(q.taxes?.length ?? 0, 'quote has tax lines').toBeGreaterThan(0);
    const taxes: any[] = q.taxes ?? [];
    for (const t of taxes) {
      expect.soft(t.name, 'internal tax name').not.toMatch(/^comm$/i);
      if (typeof t.rate === 'number' && typeof t.amount === 'number') {
        expect.soft(Math.abs(t.amount - (q.roomTotal * t.rate) / 100), `${t.name} amount`).toBeLessThan(1);
      }
    }
  });

  test('TC-068 / BUG-019: 5-night stay applies "fifth night on us"', async ({ request }, ti) => {
    knownBug(ti, 'BUG-019');
    const q = await quoteBody(await quote(request, stay(15, 5)));
    const discounted = q.roomTotal <= q.rate * 4 + 0.01 || (q.discounts ?? q.offers ?? []).length > 0;
    expect(discounted, `roomTotal ${q.roomTotal} for rate ${q.rate}`).toBe(true);
  });

  const invalid: [string, Record<string, unknown>][] = [
    ['past dates', { checkIn: '2025-01-01', checkOut: '2025-01-03' }],
    ['inverted dates', { checkIn: stay(20, 0).checkIn, checkOut: stay(15, 0).checkIn }],
    ['same-day stay', stay(20, 0)],
    ['91-night stay', stay(10, 91)],
    ['over-capacity guests', { adults: 9 }],
    ['negative children', { children: -1 }],
    ['zero adults', { adults: 0 }],
    ['bad roomId', { roomId: 'not-a-uuid' }],
  ];
  for (const [name, payload] of invalid) {
    test(`TC-098: server rejects ${name} with 4xx @security @negative`, async ({ request }, ti) => {
      knownBug(ti, 'BUG-042');
      const res = await quote(request, payload);
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    });
  }

  test('TC-063: 90-night stay is accepted (boundary) @boundary', async ({ request }) => {
    expect((await quote(request, stay(10, 90))).status()).toBe(200);
  });

  test('TC-119 / BUG-042: quote errors do not leak upstream internals @security', async ({ request }, ti) => {
    knownBug(ti, 'BUG-042');
    const body = await (await quote(request, { checkIn: '2025-01-01', checkOut: '2024-12-25' })).text();
    expect(body).not.toMatch(/Catalog request failed|statusCode|stack|Error:/);
  });
});

test.describe('HTTP, security headers and SEO @api', () => {
  test('TC-017: unauthenticated /staff is not accessible @security', async ({ request }) => {
    for (const p of ['/staff', '/staff/dashboard']) {
      const res = await request.get(p, { maxRedirects: 0 });
      const ok = [301, 302, 303, 307, 308, 401, 403, 404].includes(res.status());
      expect(ok, `${p} -> ${res.status()}`).toBe(true);
    }
  });

  test('TC-107: /api/auth/me without a session is unauthorised @security', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    if (res.status() === 200) {
      const body = await res.json().catch(() => ({}));
      expect(body.user ?? body.id ?? null).toBeFalsy();
    } else {
      expect([401, 403]).toContain(res.status());
    }
  });

  test('TC-058: HTTP redirects to HTTPS and HSTS is set @security', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['strict-transport-security']).toBeTruthy();
    const httpUrl = new URL(test.info().project.use.baseURL!);
    httpUrl.protocol = 'http:';
    const plain = await request.get(httpUrl.toString(), { maxRedirects: 0 }).catch(() => null);
    if (plain) expect([301, 302, 307, 308]).toContain(plain.status());
  });

  for (const path of ['/', '/rooms', '/booking']) {
    test(`TC-118 / BUG-040: security headers on ${path} @security`, async ({ request }, ti) => {
      knownBug(ti, 'BUG-040');
      const h = (await request.get(path)).headers();
      expect.soft(h['content-security-policy'], 'CSP').toBeTruthy();
      expect.soft(h['x-frame-options'] || /frame-ancestors/.test(h['content-security-policy'] ?? ''), 'framing').toBeTruthy();
      expect.soft(h['x-content-type-options'], 'nosniff').toBe('nosniff');
      expect.soft(h['referrer-policy'], 'Referrer-Policy').toBeTruthy();
    });
  }

  test('TC-119 / BUG-042: unknown API route returns JSON 404 @security', async ({ request }, ti) => {
    knownBug(ti, 'BUG-042');
    const res = await request.get('/api/unknown-route-xyz');
    expect(res.status()).toBe(404);
    expect(res.headers()['content-type']).toContain('application/json');
  });

  test('TC-060 / BUG-037: unknown URL returns HTTP 404', async ({ request }) => {
    expect((await request.get('/xyz-not-here')).status()).toBe(404);
  });

  test('TC-091 / BUG-037: invalid room URL returns HTTP 404', async ({ request }, ti) => {
    knownBug(ti, 'BUG-037');
    expect((await request.get('/rooms/does-not-exist')).status()).toBe(404);
  });

  for (const p of POLICY_PAGES) {
    test(`TC-069 / BUG-020: ${p} returns 200`, async ({ request }, ti) => {
      knownBug(ti, 'BUG-020');
      expect((await request.get(p)).status()).toBe(200);
    });
  }

  for (const p of STATIC_PAGES) {
    test(`TC-043: ${p} returns 200`, async ({ request }) => {
      expect((await request.get(p)).status()).toBe(200);
    });
  }

  test('TC-115 / BUG-044: robots.txt and sitemap.xml exist', async ({ request }, ti) => {
    knownBug(ti, 'BUG-044');
    expect.soft((await request.get('/robots.txt')).status()).toBe(200);
    expect.soft((await request.get('/sitemap.xml')).status()).toBe(200);
  });

  test('TC-054: 50 concurrent availability searches - p95 < 2s, no 5xx @performance', async ({ request }) => {
    const times: number[] = [];
    const statuses = await Promise.all(
      Array.from({ length: 50 }, async () => {
        const t = Date.now();
        const r = await request.get('/api/rooms?limit=50');
        times.push(Date.now() - t);
        return r.status();
      }),
    );
    expect(statuses.filter((s) => s >= 500)).toHaveLength(0);
    times.sort((a, b) => a - b);
    expect(times[Math.floor(times.length * 0.95) - 1]).toBeLessThan(2000);
  });
});
