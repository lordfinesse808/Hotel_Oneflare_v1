import { BasePage } from './BasePage';

export class GalleryPage extends BasePage {
  readonly lightbox = this.page.getByRole('dialog').first();

  open() {
    return this.goto('/gallery');
  }

  images() {
    return this.main.locator('img');
  }

  category(name: string) {
    return this.page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).or(this.page.getByRole('tab', { name: new RegExp(`^${name}$`, 'i') })).first();
  }
}
