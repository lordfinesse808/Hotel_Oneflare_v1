import { BasePage, field } from './BasePage';

export class ContactPage extends BasePage {
  readonly name = field(this.page, /^name|full name|your name/i, 'name');
  readonly email = field(this.page, /e-?mail/i, 'email');
  readonly phone = field(this.page, /phone/i, 'phone');
  readonly subject = field(this.page, /subject/i, 'subject');
  readonly message = field(this.page, /message/i, 'message');
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
