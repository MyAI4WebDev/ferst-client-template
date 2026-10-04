import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { When, Then } = createBdd();

// The primary nav is the `<nav aria-label="Main navigation">` landmark in ferst-core's
// SiteHeader, data-driven from src/content/navbarSettings. Scoping to that landmark keeps
// the click off any same-named footer/CTA links.
When('they follow {string} in the main navigation', async ({ page }, label: string) => {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: label, exact: true }).filter({ visible: true }).first().click();
  await page.waitForLoadState('domcontentloaded');
});

// The header button (navbarSettings.cta, "Contact" by default) sits beside the menu, and
// the engine never repeats it as a menu link. Its twin in the mobile drawer is hidden on
// desktop, so only the visible one is followed.
When('they follow the header button {string}', async ({ page }, label: string) => {
  await page.getByRole('banner').getByRole('link', { name: label, exact: true }).filter({ visible: true }).first().click();
  await page.waitForLoadState('domcontentloaded');
});

Then('the main navigation has no {string} link', async ({ page }, label: string) => {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.locator('a.nav-link').getByText(label, { exact: true })).toHaveCount(0);
});
