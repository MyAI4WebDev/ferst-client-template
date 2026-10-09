import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

let missingStatus = 0;

When("the visitor opens an address the site doesn't have", async ({ page }) => {
  const res = await page.goto(`/no-such-page-${Date.now()}/`);
  missingStatus = res?.status() ?? 0;
});

Then('the answer is a 404', async () => {
  expect(missingStatus).toBe(404);
});

Then("the page says it isn't here, with a way back to the home page", async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expect(page.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
});

Then('it names no canonical address', async ({ page }) => {
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

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
