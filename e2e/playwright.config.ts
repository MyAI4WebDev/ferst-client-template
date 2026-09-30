import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// Template-level E2E — the "standard client contract" (docs/CLIENT-TEMPLATE-ARCHITECTURE.md).
// Unlike the platform-authoring suite (which runs against a DEPLOYED environment), this one
// asserts that an ASSEMBLED thin client builds and its shared skeleton journeys render as
// deployed — so it BUILDS + PREVIEWS the parent template locally via `webServer` below.
// It runs once per TEMPLATE change and must never be copied into a client repo.
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: ['steps/**/*.ts'],
  // @wip = authored but not yet wired end-to-end. Excluded by default so a hollow
  // scenario can never report green. Override with BDD_TAGS (e.g. `BDD_TAGS=@wip`).
  tags: process.env.BDD_TAGS ?? 'not @wip',
});

export default defineConfig({
  testDir,
  // Skeleton journeys against one locally-served build — keep them serial and cheap.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4321',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Build + preview the PARENT template (this repo's ../). The build runs pageSchema /
  // content-collection validation and FAILS on invalid content, and `ferst-cms-config`
  // (the `&&` in the template's build script) generates dist/admin/config.yml — so a
  // green run also proves the assembled client builds and wires its CMS.
  webServer: {
    command: 'npm --prefix .. run build && npm --prefix .. run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // ferst-cms-config resolves the backend repo from GITHUB_REPOSITORY (set by GitHub
    // Actions in CI) or the git remote; pin a sensible default so a local build never
    // fails to determine the repo when run outside CI / a git checkout.
    env: {
      GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY ?? 'MyAI4WebDev/ferst-client-template',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
