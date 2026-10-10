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

Then('the page tells search engines who the site is', async ({ page }) => {
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const graph = JSON.parse(json ?? '{}')['@graph'] as Array<Record<string, unknown>>;
  const settings = JSON.parse(readFileSync(new URL('../../src/content/siteSettings/index.json', import.meta.url), 'utf8'));
  expect(graph[0]).toMatchObject({ '@id': 'https://example.org/#organization', name: settings.identity.siteTitle, url: 'https://example.org/' });
  expect(graph.find((n) => n['@type'] === 'WebSite')).toMatchObject({ url: 'https://example.org/', publisher: { '@id': 'https://example.org/#organization' } });
});

Then('a shared link to it shows a preview with its title and a picture', async ({ page }) => {
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /\S/);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://example.org/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\/example\.org\//);
});

Then('the page links its news feed', async ({ page }) => {
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', '/posts/rss.xml');
});

Then('the news feed lists the posts, newest first', async ({ page }) => {
  const res = await page.request.get('/posts/rss.xml');
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain('<rss version="2.0"');
  const dates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)].map((m) => Date.parse(m[1]));
  expect(dates.length).toBeGreaterThan(0);
  expect([...dates].sort((a, b) => b - a)).toEqual(dates);
});

