import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import type { Response } from '@playwright/test';

const { When, Then } = createBdd();

// The admin entry is a static public/admin/index.html served by the build; the CMS
// bundle is loaded from a CDN and config.yml is generated per build by ferst-cms-config.
// The suite runs serial (workers: 1, fullyParallel: false), so a step-local handle to
// the navigation response is safe to read across the Then steps of one scenario.
let adminResponse: Response | null = null;

When('the visitor opens the CMS admin page', async ({ page }) => {
  // domcontentloaded only — we assert the page is wired, not that the external CMS
  // bundle finishes booting (that needs the platform worker, out of scope here).
  adminResponse = await page.goto('/admin/', { waitUntil: 'domcontentloaded' });
});

Then('the admin page is served successfully', async () => {
  expect(adminResponse, 'admin navigation response').not.toBeNull();
  expect(adminResponse!.status()).toBe(200);
});

Then('the admin page is titled {string}', async ({ page }, title: string) => {
  await expect(page).toHaveTitle(title);
});

Then('the admin page references the CMS bundle', async ({ page }) => {
  await expect(page.locator('script[src*="sveltia-cms"]')).toHaveCount(1);
});

Then('the generated CMS config is served', async ({ page }) => {
  const res = await page.request.get('/admin/config.yml');
  expect(res.status(), 'GET /admin/config.yml').toBe(200);
  expect(await res.text()).toContain('backend');
});

// The sign-in, once the CMS bundle has booted far enough to draw it.
Then('the content editor offers {string}', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible({ timeout: 30_000 });
});

Then('the content editor is headed {string}', async ({ page }, heading: string) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
});

Then("the content editor's sign-in never mentions {string} or {string}", async ({ page }, a: string, b: string) => {
  // What people see and hear: the accessibility tree, so text the CMS keeps hidden from
  // everyone (its font-loading probe) doesn't count, and screen-reader announcements do.
  const text = await page.locator('body').ariaSnapshot();
  expect(text).not.toContain(a);
  expect(text).not.toContain(b);
});

Then('the content editor offers no sign-in with an access token', async ({ page }) => {
  await expect(page.getByRole('button', { name: /PAT|access token/i })).toHaveCount(0);
});
