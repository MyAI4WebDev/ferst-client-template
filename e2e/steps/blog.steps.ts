import { createBdd } from 'playwright-bdd';

const { When } = createBdd();

// On the news index each post is a PostCard whose title is a link (the whole card is
// clickable via that stretched link). Following it by its accessible name reaches the
// individual post page without hard-coding the date-prefixed slug.
When('they open the post {string}', async ({ page }, title: string) => {
  await page.getByRole('link', { name: title, exact: true }).first().click();
  await page.waitForLoadState('domcontentloaded');
});
