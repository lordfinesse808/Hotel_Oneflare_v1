import { test, expect, knownBug } from '../../utils/fixtures';
import { env, hasCredentials } from '../../utils/env';
import { field } from '../../pages/BasePage';

test.describe('Account & sign-in @account', () => {
  test.beforeEach(async ({ home }) => {
    await home.open();
  });

  test('TC-100: sign-in modal role selection and close (X and Esc)', async ({ page, auth }) => {
    await auth.openFromHeader();
    await auth.chooseRole('Agent');
    await expect(auth.password).toBeVisible();
    await auth.close.click();
    await expect(auth.dialog).toBeHidden();
    await auth.openFromHeader();
    await page.keyboard.press('Escape');
    await expect(auth.dialog).toBeHidden();
  });

  test('TC-101: empty sign-in shows Required and sends no API call @negative', async ({ page, auth }) => {
    let called = false;
    page.on('request', (r) => /\/api\/auth\/login/.test(r.url()) && (called = true));
    await auth.openFromHeader();
    await auth.chooseRole('Customer');
    await auth.submit.click();
    await expect(auth.dialog.getByText(/required/i).first()).toBeVisible();
    expect(called).toBe(false);
  });

  test('TC-040: sign in with valid credentials, sign out, then wrong password', async ({ page, auth }) => {
    test.skip(!hasCredentials(), 'No credentials in .env');
    await auth.signIn(env.email, env.password);
    await expect(auth.dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /sign out|log out|account|profile/i }).or(page.getByRole('link', { name: /account/i })).first()).toBeVisible();
    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(200);

    await page.getByRole('button', { name: /account|profile|menu/i }).first().click().catch(() => {});
    await page.getByRole('button', { name: /sign out|log out/i }).or(page.getByRole('menuitem', { name: /sign out|log out/i })).first().click();

    await auth.signIn(env.email, `${env.password}-wrong`);
    await expect(auth.dialog.getByText(/invalid credentials|incorrect/i)).toBeVisible();
    await expect(auth.dialog.getByText(/no account|not found|does not exist/i)).toHaveCount(0); // no enumeration
  });

  test('TC-105 / BUG-043: signed-in customer account page shows bookings and profile', async ({ page, auth }, ti) => {
    test.skip(!hasCredentials(), 'No credentials in .env');
    knownBug(ti, 'BUG-043');
    await auth.signIn(env.email, env.password);
    await expect(auth.dialog).toBeHidden({ timeout: 15_000 });
    await page.goto('/account');
    await expect(page.getByText(/bookings?/i).first()).toBeVisible();
    await expect(page.getByText(/profile/i).first()).toBeVisible();
    await expect(page.getByText(/commission/i)).toHaveCount(0);
  });

  test('TC-107: sign out clears the session @security', async ({ page, auth }) => {
    test.skip(!hasCredentials(), 'No credentials in .env');
    await auth.signIn(env.email, env.password);
    await expect(auth.dialog).toBeHidden({ timeout: 15_000 });
    await page.getByRole('button', { name: /account|profile|menu/i }).first().click().catch(() => {});
    await page.getByRole('button', { name: /sign out|log out/i }).or(page.getByRole('menuitem', { name: /sign out|log out/i })).first().click();
    await page.goBack();
    const me = await page.request.get('/api/auth/me');
    const body = await me.json().catch(() => ({}));
    expect(me.status() >= 400 || !(body.user ?? body.id)).toBe(true);
  });

  test('TC-102 / BUG-041: repeated failed sign-ins are throttled @security', async ({ auth }, ti) => {
    knownBug(ti, 'BUG-041');
    const victim = 'qa.bruteforce@example.com';
    await auth.openFromHeader();
    await auth.chooseRole('Customer');
    await auth.identifier.fill(victim);
    for (let i = 0; i < 7; i++) {
      await auth.password.fill(`wrong-${i}`);
      await auth.submit.click();
      await auth.dialog.getByText(/invalid|too many|locked|try again/i).first().waitFor();
    }
    await expect(auth.dialog.getByText(/too many|locked|try again later|captcha/i).first()).toBeVisible();
  });

  test('TC-120 / BUG-047: sign-in identifier is format-checked client-side @negative', async ({ page, auth }, ti) => {
    knownBug(ti, 'BUG-047');
    let called = false;
    page.on('request', (r) => /\/api\/auth\/login/.test(r.url()) && (called = true));
    await auth.openFromHeader();
    await auth.chooseRole('Customer');
    await auth.identifier.fill('abc');
    await auth.password.fill('whatever');
    await auth.submit.click();
    await page.waitForTimeout(1000);
    expect(called).toBe(false);
  });

  test('TC-103: create-an-account form validates empty submission', async ({ auth }) => {
    await auth.openFromHeader();
    await auth.chooseRole('Customer');
    await auth.dialog.getByRole('button', { name: /create an account/i }).or(auth.dialog.getByRole('link', { name: /create an account/i })).first().click();
    await auth.dialog.getByRole('button', { name: /create|sign up|continue|register/i }).last().click();
    await expect(auth.dialog.getByText(/required/i).first()).toBeVisible();
  });

  test('TC-104: forgot password shows a generic message for unknown emails', async ({ page, auth }) => {
    await auth.openFromHeader();
    await auth.chooseRole('Customer');
    await auth.dialog.getByRole('button', { name: /forgot password/i }).or(auth.dialog.getByRole('link', { name: /forgot password/i })).first().click();
    await field(auth.dialog, /e-?mail/i, 'email').fill('nobody.qa@example.com');
    await auth.dialog.getByRole('button', { name: /send|reset|continue/i }).last().click();
    await expect(page.getByText(/if (an|the|this) (account|email)|we.?ve sent|we have sent|check your (email|inbox)|reset (link|instructions|code)|sent/i).first()).toBeVisible();
  });

  test('TC-041 / TC-114 / BUG-043: manage a booking by reference', async ({ page }, ti) => {
    knownBug(ti, 'BUG-043');
    await page.locator('footer').getByRole('link', { name: /manage a booking/i }).click();
    await expect(page.getByLabel(/reference/i).first()).toBeVisible();
    await page.getByLabel(/reference/i).first().fill('DOESNOTEXIST');
    await page.getByLabel(/email/i).first().fill('qa@example.com');
    await page.getByRole('button', { name: /find|look ?up|search|continue/i }).first().click();
    await expect(page.getByText(/not found|no booking/i).first()).toBeVisible();
  });
});
