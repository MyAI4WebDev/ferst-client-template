import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Then } = createBdd();

Then('the page asks search engines not to index it', async ({ page }) => {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

Then('robots.txt still lets search engines crawl the site, so they see that', async ({ page }) => {
  const res = await page.request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const txt = await res.text();
  expect(txt).toMatch(/^Allow: \/$/m);
  expect(txt).not.toMatch(/^Disallow: \/$/m);
  expect(txt).not.toMatch(/Sitemap:/);
});

// `astro preview` doesn't apply Cloudflare's _headers, so read what the build wrote for it.
Then('the build marks every file noindex for Cloudflare, PDFs included', async () => {
  const headers = readFileSync(new URL('../../dist/_headers', import.meta.url), 'utf8');
  expect(headers).toMatch(/^\/\*\s*\n\s+X-Robots-Tag: noindex/m);
});

Then('its canonical address is {string}', async ({ page }, href: string) => {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', href);
});
