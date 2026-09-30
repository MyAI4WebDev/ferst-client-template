import { createBdd } from 'playwright-bdd';

const { When } = createBdd();

// The primary nav is the `<nav aria-label="Main navigation">` landmark in ferst-core's
// SiteHeader, data-driven from src/content/navbarSettings. Scoping to that landmark keeps
// the click off any same-named footer/CTA links; `.first()` picks the visible nav link
// (a duplicate "Contact" also lives in the hidden mobile drawer inside the same landmark).
When('they follow {string} in the main navigation', async ({ page }, label: string) => {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: label, exact: true }).first().click();
  await page.waitForLoadState('domcontentloaded');
});
