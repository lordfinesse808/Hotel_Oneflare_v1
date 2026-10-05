import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export type RoomsQuery = { branchId?: string; checkIn?: string; checkOut?: string; adults?: number; children?: number };

export class RoomsPage extends BasePage {
  /** e.g. "5 room types available" */
  readonly resultsHeading = this.page.getByRole('heading', { name: /\d+\s+room types?/i }).first();
  readonly emptyState = this.page.getByText(/no rooms match|no rooms available/i).first();
  readonly clearFilters = this.page.getByRole('button', { name: /clear|reset/i }).or(this.page.getByRole('link', { name: /clear|reset/i })).first();
  readonly priceSlider = this.page.getByRole('slider').or(this.page.locator('input[type="range"]')).first();
  readonly filterButton = this.page.getByRole('button', { name: /^filters?$/i }).first();

  open(q: RoomsQuery = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined) params.set(k, String(v));
    const qs = params.toString();
    return this.goto(`/rooms${qs ? `?${qs}` : ''}`);
  }

  private action(name: RegExp) {
    return this.page.getByRole('link', { name }).or(this.page.getByRole('button', { name }));
  }

  /** Room name: a heading or a text link that is not one of the CTAs. */
  private titleLocator(scope: Page | Locator) {
    return scope
      .locator('h1,h2,h3,h4,h5,h6,[role="heading"],a')
      .filter({ hasText: /[A-Za-z]/ })
      .filter({ hasNotText: /select room|view details|\d+\s+room types?|^filters?$/i });
  }

  /** Innermost element holding a room name, a Naira price and both CTAs. */
  cards(): Locator {
    const holder = (sel: string) =>
      this.page
        .locator(sel)
        .filter({ hasText: /₦/ })
        .filter({ has: this.titleLocator(this.page) })
        .filter({ has: this.action(/select room/i) })
        .filter({ has: this.action(/view details/i) });
    // Inner locators resolve relative to each candidate, so the nested one must not be rooted at <main>.
    return holder('main div, main article, main li').filter({ hasNot: holder('div, article, li') });
  }

  /** Fails fast instead of letting per-card loops pass with zero cards. */
  async expectCards() {
    await expect(this.cards().first(), 'at least one room card').toBeVisible();
  }

  async waitForResults() {
    await expect(this.resultsHeading.or(this.emptyState)).toBeVisible({ timeout: 20_000 });
  }

  async headingCount(): Promise<number> {
    const text = (await this.resultsHeading.textContent()) ?? '';
    return Number(text.match(/(\d+)/)?.[1] ?? NaN);
  }

  async cardTitles(): Promise<string[]> {
    await this.expectCards();
    const cards = this.cards();
    const n = await cards.count();
    const titles: string[] = [];
    for (let i = 0; i < n; i++) {
      // Title is the card's heading, or its first link that is not a CTA.
      const title = this.titleLocator(cards.nth(i)).first();
      titles.push(((await title.textContent()) ?? '').trim());
    }
    return titles;
  }

  async cardTexts(): Promise<string[]> {
    await this.expectCards();
    return this.cards().allInnerTexts();
  }

  filterCheckbox(name: string | RegExp) {
    return this.page.getByRole('checkbox', { name });
  }

  selectRoom(index = 0) {
    return this.action(/select room/i).nth(index);
  }

  viewDetails(index = 0) {
    return this.action(/view details/i).nth(index);
  }

  async search(opts: { branch?: string; checkIn?: string; checkOut?: string; adults?: number }) {
    if (opts.branch) await this.chooseBranch(opts.branch);
    if (opts.checkIn && opts.checkOut) await this.setDates(opts.checkIn, opts.checkOut);
    if (opts.adults !== undefined) await this.page.getByLabel(/adults/i).first().fill(String(opts.adults)).catch(async () => {
      await this.page.getByLabel(/guests|adults/i).first().selectOption(String(opts.adults));
    });
    await this.checkAvailability().click();
    await this.waitForResults();
  }
}
