import { expect, test } from '@playwright/test';

test('intro reaches the final state and MapLibre stays lazy', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.goto('./');
  const hero = page.locator('[data-hero]');
  await expect(hero).toHaveClass(/is-complete/, { timeout: 8_000 });
  await expect(page.getByRole('heading', { name: 'Dolina Agatów', level: 1 })).toBeVisible();
  expect(requests.some((url) => url.includes('hero-map'))).toBe(false);

  await page.getByRole('button', { name: 'Zobacz Dolinę na mapie' }).click();
  await expect(page.locator('[data-map-dialog]')).toBeVisible();
  await expect.poll(() => requests.some((url) => url.includes('hero-map'))).toBe(true);
});

test('skip is temporary and reload starts a fresh intro', async ({ page }) => {
  await page.goto('./');
  const hero = page.locator('[data-hero]');
  await page.getByRole('button', { name: 'Pomiń intro' }).click();
  await expect(hero).toHaveClass(/is-complete/);

  await page.reload();
  await expect(hero).not.toHaveClass(/is-complete/);
  await expect(page.getByRole('button', { name: 'Pomiń intro' })).toBeVisible();
});

test('reduced motion shows the final state immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.locator('[data-hero]')).toHaveClass(/is-complete/);
  await expect(page.getByRole('button', { name: 'Pomiń intro' })).toBeHidden();
});

test('returning from the regulations page starts a fresh intro', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Pomiń intro' }).click();
  await page.locator('.footer-links').getByRole('link', { name: 'Regulamin stowarzyszenia' }).click();
  await expect(page).toHaveURL(/\/regulamin\/$/);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Pomiń intro' })).toBeVisible();
  await expect(page.locator('[data-hero]')).not.toHaveClass(/is-complete/);
});

test('mobile menu is explicit, focusable and does not overflow', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('mobile'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');

  const menuButton = page.getByRole('button', { name: 'Menu' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.locator('[data-mobile-menu]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mikroatlas', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-mobile-menu]')).toBeHidden();
  await expect(menuButton).toBeFocused();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
