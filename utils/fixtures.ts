import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { env } from './env';
import { HomePage } from '../pages/HomePage';
import { RoomsPage } from '../pages/RoomsPage';
import { RoomDetailPage } from '../pages/RoomDetailPage';
import { BookingPage } from '../pages/BookingPage';
import { AuthModal } from '../pages/AuthModal';
import { ContactPage } from '../pages/ContactPage';
import { BranchesPage } from '../pages/BranchesPage';
import { GalleryPage } from '../pages/GalleryPage';

export type PageDiagnostics = {
  consoleErrors: string[];
  failedRequests: { url: string; status: number }[];
};

type Fixtures = {
  diagnostics: PageDiagnostics;
  home: HomePage;
  rooms: RoomsPage;
  roomDetail: RoomDetailPage;
  booking: BookingPage;
  auth: AuthModal;
  contact: ContactPage;
  branches: BranchesPage;
  gallery: GalleryPage;
};

export const test = base.extend<Fixtures>({
  diagnostics: async ({ page }, use) => {
    const d: PageDiagnostics = { consoleErrors: [], failedRequests: [] };
    page.on('console', (m) => m.type() === 'error' && d.consoleErrors.push(m.text()));
    page.on('pageerror', (e) => d.consoleErrors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().includes('/api/')) d.failedRequests.push({ url: r.url(), status: r.status() });
    });
    await use(d);
  },
  home: async ({ page }, use) => use(new HomePage(page)),
  rooms: async ({ page }, use) => use(new RoomsPage(page)),
  roomDetail: async ({ page }, use) => use(new RoomDetailPage(page)),
  booking: async ({ page }, use) => use(new BookingPage(page)),
  auth: async ({ page }, use) => use(new AuthModal(page)),
  contact: async ({ page }, use) => use(new ContactPage(page)),
  branches: async ({ page }, use) => use(new BranchesPage(page)),
  gallery: async ({ page }, use) => use(new GalleryPage(page)),
});

export { expect };

/**
 * Links a test to the bug(s) it covers. With EXPECT_KNOWN_BUGS=1 the test is
 * marked as an expected failure, so a run stays green until a bug is fixed
 * (Playwright then reports "expected to fail but passed" - time to retest).
 */
export function knownBug(testInfo: TestInfo, ...bugIds: string[]) {
  for (const id of bugIds) testInfo.annotations.push({ type: 'bug', description: id });
  if (env.expectKnownBugs) testInfo.fail(true, `Open defect(s): ${bugIds.join(', ')}`);
}

/** Waits until skeleton placeholders are gone (BUG-008 / BUG-037 / TC-052). */
export async function waitForSkeletonsToResolve(page: Page, timeout = 15_000) {
  const skeleton = page.locator('[class*="skeleton" i], [class*="animate-pulse"], [aria-busy="true"]');
  await expect(skeleton).toHaveCount(0, { timeout });
}
