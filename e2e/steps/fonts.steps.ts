import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Then } = createBdd();

Then('the font file {string} is served', async ({ page }, file: string) => {
  const res = await page.request.get(`/fonts/${file}`);
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 4).toString('latin1')).toBe('wOF2'); // a real woff2, not an HTML 404
});
