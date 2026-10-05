import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class AuthModal extends BasePage {
  readonly dialog = this.page.getByRole('dialog').first();
  readonly identifier = this.dialog.getByLabel(/email|phone|identifier|username/i).first();
  readonly password = this.dialog.getByLabel(/password/i).first();
  readonly submit = this.dialog.getByRole('button', { name: /continue|sign in|log in/i }).last();
  readonly close = this.dialog.getByRole('button', { name: /close/i }).first();
  readonly error = this.dialog.getByText(/invalid|incorrect|wrong|required/i).first();

  async openFromHeader() {
    await this.page.getByRole('button', { name: /^sign in$/i }).or(this.page.getByRole('link', { name: /^sign in$/i })).first().click();
    await expect(this.dialog).toBeVisible();
  }

  async chooseRole(role: 'Customer' | 'Agent') {
    await this.dialog.getByRole('radio', { name: new RegExp(role, 'i') })
      .or(this.dialog.getByRole('button', { name: new RegExp(`^${role}`, 'i') }))
      .or(this.dialog.getByText(new RegExp(`^${role}$`, 'i')))
      .first()
      .click();
    const next = this.dialog.getByRole('button', { name: /^next$/i });
    if (await next.isVisible().catch(() => false)) await next.click();
  }

  async signIn(identifier: string, password: string, role: 'Customer' | 'Agent' = 'Customer') {
    await this.openFromHeader();
    await this.chooseRole(role);
    await this.identifier.fill(identifier);
    await this.password.fill(password);
    await this.submit.click();
  }
}
