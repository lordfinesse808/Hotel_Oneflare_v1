import { BasePage } from './BasePage';

export class RoomDetailPage extends BasePage {
  readonly title = this.page.getByRole('heading', { level: 1 }).first();
  readonly breadcrumb = this.page.getByRole('navigation', { name: /breadcrumb/i }).or(this.page.locator('nav[aria-label*="bread" i], ol').first()).first();
  readonly continueBtn = this.page.getByRole('button', { name: /continue to guest details/i }).or(this.page.getByRole('link', { name: /continue to guest details/i })).first();
  readonly adults = this.page.getByLabel(/adults/i).first();
  readonly children = this.page.getByLabel(/children/i).first();
  readonly priceBox = this.page.locator('aside, [class*="summary" i], [class*="price" i]').filter({ hasText: /total/i }).first();
  readonly notFound = this.page.getByText(/room not found|could not be found|not found/i).first();

  open(id: string, q: Record<string, string | number> = {}) {
    const qs = new URLSearchParams(Object.entries(q).map(([k, v]) => [k, String(v)])).toString();
    return this.goto(`/rooms/${id}${qs ? `?${qs}` : ''}`);
  }

  stepper(kind: 'adults' | 'children', dir: 'increase' | 'decrease') {
    const sign = dir === 'increase' ? /increase|\+|add|more/i : /decrease|−|-|remove|fewer/i;
    return this.page.getByRole('button', { name: new RegExp(`${dir}.*${kind}|${kind}.*${dir}`, 'i') }).or(
      this.page.locator('div,fieldset').filter({ hasText: new RegExp(`^${kind}`, 'i') }).getByRole('button', { name: sign }),
    ).first();
  }

  async totalText() {
    return (await this.priceBox.innerText()).trim();
  }
}
