import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Then } = createBdd();

Then('the page names its browser icon and its home-screen icon', async ({ page }) => {
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.ico');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
});

Then('{string} answers with an icon', async ({ page }, path: string) => {
  const res = await page.request.get(path);
  expect(res.status()).toBe(200);
  const body = await res.body();
  expect([body.readUInt16LE(0), body.readUInt16LE(2)]).toEqual([0, 1]); // an .ico file
  expect(body.readUInt16LE(4)).toBeGreaterThan(0); // with at least one image
});

Then('{string} answers with a 180-pixel image', async ({ page }, path: string) => {
  const res = await page.request.get(path);
  expect(res.status()).toBe(200);
  const body = await res.body();
  expect(body.subarray(1, 4).toString('latin1')).toBe('PNG');
  expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([180, 180]); // PNG width, height
});
