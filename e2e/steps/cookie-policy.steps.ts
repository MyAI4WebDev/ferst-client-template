import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

When('they follow the cookie banner\'s policy link', async ({ page }) => {
  await page.locator('.cookie-banner').getByRole('link', { name: /cookie policy/i }).click();
});

Then('the policy lists the storage the site needs', async ({ page }) => {
  // The "necessary" category is always present: the site's own consent + theme storage.
  await expect(page.getByText(/necessary/i).first()).toBeVisible();
  expect(page.url()).toMatch(/\/cookie-policy\/?$/);
});
