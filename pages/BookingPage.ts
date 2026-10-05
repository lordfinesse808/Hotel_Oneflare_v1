import { type Locator } from '@playwright/test';
import { BasePage, field } from './BasePage';

export class BookingPage extends BasePage {
  readonly fullName = field(this.page, /full name|name/i, 'name');
  readonly email = field(this.page, /e-?mail/i, 'email');
  readonly phone = field(this.page, /phone/i, 'phone');
  readonly consent = this.page.getByRole('checkbox').first();
  readonly reviewBtn = this.page.getByRole('button', { name: /review my booking/i }).first();
  readonly confirmBtn = this.page.getByRole('button', { name: /confirm booking/i }).first();
  readonly editDetails = this.page.getByRole('button', { name: /edit details|back to guest details/i }).or(this.page.getByRole('link', { name: /edit details|back to guest details/i })).first();
  readonly changeRoom = this.page.getByRole('link', { name: /change room or dates/i }).or(this.page.getByRole('button', { name: /change room or dates/i })).first();
  readonly summary: Locator = this.page.locator('aside, [class*="summary" i]').filter({ hasText: /total/i }).first();
  readonly confirmation = this.page.getByText(/confirmed|booking reference|reservation (number|reference)/i).first();

  open() {
    return this.goto('/booking');
  }

  async fillGuest(g: { fullName: string; email: string; phone: string }, consent = true) {
    await this.fullName.fill(g.fullName);
    await this.email.fill(g.email);
    await this.phone.fill(g.phone);
    if (consent) await this.consent.check();
  }

  /** Currently highlighted step in the 1-4 step indicator. */
  currentStep() {
    return this.page
      .locator('[aria-current="step"], [aria-current="true"], [data-state="active"], [data-active="true"]')
      .or(this.page.locator('ol li, nav li').filter({ has: this.page.locator('[class*="bg-accent"], [class*="bg-primary"], [class*="font-semibold"]') }))
      .first();
  }

  fieldError() {
    return this.page.locator('[role="alert"], [aria-invalid="true"], [class*="error" i]');
  }
}
