import { BasePage } from './BasePage';

export class BranchesPage extends BasePage {
  open() {
    return this.goto('/branches');
  }

  cards() {
    const holder = (sel: string) =>
      this.page.locator(sel).filter({ has: this.page.getByRole('heading') }).filter({ has: this.page.getByRole('link', { name: /see rooms at/i }) });
    return holder('main div, main article, main li').filter({ hasNot: holder('div, article, li') });
  }

  card(branch: string) {
    return this.cards().filter({ hasText: new RegExp(branch, 'i') }).first();
  }

  seeRoomsLinks() {
    return this.page.getByRole('link', { name: /see rooms at/i });
  }
}
