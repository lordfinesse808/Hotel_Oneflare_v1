import { BasePage } from './BasePage';

export class ContactPage extends BasePage {
  readonly name = this.page.getByLabel(/^name|full name/i).first();
  readonly email = this.page.getByLabel(/e-?mail/i).first();
  readonly phone = this.page.getByLabel(/phone/i).first();
  readonly subject = this.page.getByLabel(/subject/i).first();
  readonly message = this.page.getByLabel(/message/i).first();
  readonly send = this.page.getByRole('button', { name: /send/i }).first();
  readonly goingTo = this.page.getByText(/going to/i).first();
  readonly lookupLink = this.page.getByRole('link', { name: /look it up|reference/i }).first();

  open(query = '') {
    return this.goto(`/contact${query}`);
  }

  tab(branch: string) {
    return this.page.getByRole('tab', { name: new RegExp(branch, 'i') }).or(this.page.getByRole('button', { name: new RegExp(branch, 'i') })).first();
  }

  infoPanel() {
    return this.page.locator('section, aside, div').filter({ hasText: /address/i }).filter({ hasText: /hours/i }).last();
  }
}
