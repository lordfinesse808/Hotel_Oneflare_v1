import { BasePage } from './BasePage';

export class BranchesPage extends BasePage {
  open() {
    return this.goto('/branches');
  }

  cards() {
    return this.page.locator('article, li, [class*="card" i]').filter({ has: this.page.getByRole('link', { name: /see rooms at/i }) });
  }

  card(branch: string) {
    return this.cards().filter({ hasText: new RegExp(branch, 'i') }).first();
  }
}
