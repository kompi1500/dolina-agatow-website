import { expect, test } from '@playwright/test';

test('intro uses one map and exposes the explorer after skip', async ({ page }) => {
  await page.goto('.');
  await page.getByRole('button', { name: 'Pomiń intro' }).click();
  await expect(page.locator('#hero-overlay')).toBeVisible();
  await expect(page.locator('#hero-map-controls')).toBeVisible();
  await expect(page.locator('.maplibregl-map')).toHaveCount(1);
  await expect(page.locator('#hero-coordinates')).toContainText(/[NS].*[EW]/);

  const layer = page.getByRole('button', { name: 'Zmień podkład mapy' });
  await layer.click();
  await expect(layer).toHaveAttribute('aria-pressed', 'false');
  await expect(layer).toContainText('Mapa');
});

test('vector map remains when satellite tiles fail', async ({ page }) => {
  await page.route('https://tiles.maps.eox.at/**', (route) => route.abort());
  await page.goto('.');
  await page.getByRole('button', { name: 'Pomiń intro' }).click();
  await expect(page.locator('#hero-overlay')).toBeVisible();
  await expect(page.locator('#hero-map canvas')).toBeVisible();
  await expect(page.locator('#hero-map-controls')).toBeVisible();
});

test('mobile layout does not overflow horizontally', async ({ page }) => {
  await page.goto('.');
  await page.getByRole('button', { name: 'Pomiń intro' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('#hero-map-controls')).toBeVisible();
  await expect(page.locator('#hero-coordinates')).toBeVisible();
});
