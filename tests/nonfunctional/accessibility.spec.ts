import AxeBuilder from '@axe-core/playwright';
import { test, expect, knownBug } from '../../utils/fixtures';

test.describe('Accessibility @accessibility', () => {
  for (const path of ['/', '/rooms', '/contact', '/branches', '/gallery', '/about']) {
    test(`TC-056 / BUG-001 / BUG-045: no critical axe violations on ${path}`, async ({ page }, ti) => {
      knownBug(ti, 'BUG-001', 'BUG-045');
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      const results = await new AxeBuilder({ page: page as any }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      await ti.attach('axe-violations.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
      expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }

  test('TC-055 / BUG-045: keyboard reaches search, filters and Select room with visible focus', async ({ page }, ti) => {
    knownBug(ti, 'BUG-045');
    await page.goto('/rooms');
    const reached = new Set<string>();
    const noFocusRing: string[] = [];
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const cs = getComputedStyle(el);
        const visible = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== 'none';
        return { label: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.tagName).trim().slice(0, 40), tag: el.tagName, type: (el as HTMLInputElement).type, visible };
      });
      if (!info) continue;
      reached.add(`${info.tag}:${info.type}:${info.label}`);
      if (!info.visible) noFocusRing.push(`${info.tag} ${info.label}`);
      if (/select room/i.test(info.label)) break;
    }
    const all = [...reached].join('\n');
    expect(all).toMatch(/check availability/i);
    expect(all).toMatch(/select room/i);
    expect.soft(noFocusRing, 'controls without visible focus').toEqual([]);
  });

  test('TC-045 / BUG-045: header search and price slider have accessible names', async ({ page }, ti) => {
    knownBug(ti, 'BUG-045');
    await page.goto('/rooms');
    await expect.soft(page.getByRole('searchbox', { name: /.+/ }).or(page.getByRole('textbox', { name: /search/i })).first()).toBeVisible();
    await expect.soft(page.getByRole('slider', { name: /.+/ }).first()).toBeVisible();
  });

  for (const path of ['/', '/rooms', '/contact', '/branches', '/gallery', '/about']) {
    test(`TC-123 / BUG-036: one meaningful H1 and landmarks on ${path}`, async ({ page }, ti) => {
      knownBug(ti, 'BUG-036');
      await page.goto(path);
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(/\S{3,}/);
      for (const role of ['banner', 'navigation', 'main', 'contentinfo'] as const) {
        await expect.soft(page.getByRole(role).first(), role).toBeAttached();
      }
    });
  }
});
