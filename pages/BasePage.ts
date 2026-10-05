import { type Locator, type Page } from '@playwright/test';

/** Text input found by label, then placeholder, then name/id/type attribute. */
export function field(scope: Page | Locator, label: RegExp, attr: string): Locator {
  return scope
    .getByLabel(label)
    .or(scope.getByPlaceholder(label))
    .or(scope.locator(`input[name*="${attr}" i], input[id*="${attr}" i], input[type="${attr === 'phone' ? 'tel' : attr}"], textarea[name*="${attr}" i]`))
    .first();
}

export class BasePage {
  readonly header: Locator;
  readonly footer: Locator;
  readonly main: Locator;

  constructor(readonly page: Page) {
    this.header = page.locator('header').first();
    this.footer = page.locator('footer').first();
    this.main = page.locator('main').first();
  }

  async goto(path: string) {
    const res = await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    return res;
  }

  headerLink(name: string | RegExp) {
    return this.header.getByRole('link', { name });
  }

  footerLink(name: string | RegExp) {
    return this.footer.getByRole('link', { name });
  }

  /** The branch <select> or combobox used across Home, Rooms and Gallery. */
  branchSelect() {
    return this.page.getByRole('combobox', { name: /branch|location|hotel/i }).or(this.page.locator('select').first()).first();
  }

  async chooseBranch(branch: string) {
    const select = this.branchSelect();
    const tag = await select.evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'select') {
      const label = await select.locator('option').filter({ hasText: branch }).first().textContent();
      await select.selectOption({ label: label!.trim() });
    } else {
      await select.click();
      await this.page.getByRole('option', { name: new RegExp(branch, 'i') }).first().click();
    }
  }

  checkIn() {
    return this.page.getByLabel(/check[\s-]?in/i).first();
  }

  checkOut() {
    return this.page.getByLabel(/check[\s-]?out/i).first();
  }

  checkAvailability() {
    return this.page.getByRole('button', { name: /check availability/i }).first();
  }

  async setDates(checkIn: string, checkOut: string) {
    await this.checkIn().fill(checkIn);
    await this.checkOut().fill(checkOut);
  }
}
