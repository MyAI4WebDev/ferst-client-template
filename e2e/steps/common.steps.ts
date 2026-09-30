import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, Then } = createBdd();

// Shared visitor steps — the same vision-anchored vocabulary the showcase suite uses,
// so a template journey reads like every other Ferst E2E.

Given('the visitor opens the {string} page', async ({ page }, path: string) => {
  await page.goto(path);
});

Then('they see a level-{int} heading {string}', async ({ page }, level: number, text: string) => {
  await expect(page.getByRole('heading', { level, name: text }).first()).toBeVisible();
});

Then('they can follow the call to action {string}', async ({ page }, label: string) => {
  await expect(page.getByRole('link', { name: label }).first()).toBeVisible();
});

Then('they see a card titled {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { level: 3, name: title, exact: true }).first()).toBeVisible();
});

Then('they read a paragraph containing {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
});
