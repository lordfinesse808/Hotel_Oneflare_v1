import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  readonly hero = this.page.locator('section').first();
  readonly exploreRooms = this.page.getByRole('link', { name: /explore rooms/i }).first();
  readonly headerSearch = this.header.getByRole('searchbox').or(this.header.getByPlaceholder(/search/i)).first();
  readonly menuToggle = this.page.getByRole('button', { name: /toggle menu|open menu|menu/i }).first();
  readonly signIn = this.page.getByRole('button', { name: /sign in/i }).or(this.page.getByRole('link', { name: /sign in/i })).first();

  open() {
    return this.goto('/');
  }

  section(heading: RegExp) {
    return this.page.locator('section').filter({ has: this.page.getByRole('heading', { name: heading }) }).first();
  }

  async adultsInput() {
    return this.page.getByLabel(/adults/i).first();
  }
}
