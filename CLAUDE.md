# Ferst thin client — guide for a coding agent

This repository is a **thin client** of the **`ferst-core`** engine. It holds only the
site's **content data** — no application code. Your job here is to **compose pages and
content as data**, never to write or change code.

## Step 0 — update first (always)
Before doing anything else, bring the repo current so you build on the latest engine +
scaffold:

```sh
npm install
npm run update      # ferst-update: syncs the scaffold from upstream + bumps ferst-core to latest, then verifies
```

`npm run update` reads `ferst-template.json` (`upstream` = the template repo, `ownedPaths` =
the template-owned files), fetches the template, `git checkout`s the latest scaffold into the
owned paths (**your content is never touched**), installs `ferst-core@latest`, and runs
`build` + `check:thin`. If it reports a failure, fix or surface that before continuing — do
not build on a stale or broken base. (`--dry-run` previews; `--no-core` syncs scaffold only.)

## Rebuilding an existing website from a URL
Use the **`migrate-site` skill** (`.claude/skills/migrate-site/`). It snapshots the old site
into a git-ignored `.migration/` folder and plans every URL with the `site-inventory` agent. It
then builds pages in parallel with `page-builder` agents and audits coverage with the
`migration-auditor` agent. The `content-architect` agent then restructures the result to fit
Ferst's model (dated items as posts, merged pages, structured text), keeping every word. It
finishes with a pull request whose `MIGRATION-REPORT.md` lists what was restructured and
everything **undeliverable** with the current blocks. **Carry the content, not the old
design.** Never write code to fill a gap. Report it.

## The one rule that must not be broken
**Author data, not code.** All routing, layouts, components, page + blog rendering, the
block schema and theming live in the `ferst-core` package (installed in `node_modules`,
read-only). So:

- **DO** create/edit JSON and Markdown under `src/content/**`, and media under `public/uploads/`.
- **DO NOT** create or edit any `.astro` file, component, layout, route, or build config; do
  not add anything under `src/pages/`; do not edit `node_modules` or the `ferst-core` source.
  This repo is deliberately thin — hand-coding a page here fights the platform and is caught
  by `npm run check:thin`.
- If a design needs a **block type that does not exist** in the palette, **stop and report
  it**: that is an engine change, not something to build in this repo. Report it as a
  **core request issue** (below).

## Asking the engine for something: `core-request` issues
When the site needs something the engine can't do (a missing block, field, layout fix or
behaviour), open a **GitHub issue in this repo** labelled `core-request`. The Ferst core
team collects them across all client repos. Don't use artifacts, docs pages or notes in the
repo for this: issues are what the core team reads.

1. **Check first:** `gh issue list --label core-request --state open`. If the request is
   already there, add a comment with the new evidence rather than opening a duplicate.
2. **One issue per request**, created with
   `gh label create core-request --color 8a6a1f 2>/dev/null; gh issue create --label core-request --title "Core request: <short ask>" --body-file <file>`.
   Put the priority in the body.
3. **Body:**
   - **Priority:** high / medium / low, and why.
   - **What's needed**, in a sentence.
   - **Where:** pages and paths.
   - **Today's workaround:** the blocks used instead, as a sequence like
     `hero → heading → list → heading → list …`, or what had to be left out.
   - **Proposed engine change:** a field, a recipe, a CSS fix.
   - **ferst-core version** (`npm ls ferst-core`).
4. If `gh` isn't available, use the GitHub tools the session has. If there are none, list
   the requests in your final message and in the PR description, and say they still need
   filing.
5. Once a released ferst-core version delivers a request, use it, then close the issue with
   a comment naming the version.

(A site may carry one pre-existing bespoke `.astro` route, e.g. `src/pages/cookie-policy.astro`
— a legacy one-off. Do not add more like it.)

## Testing — do NOT add tests to this repo
This repo is **data on top of a released, already-tested engine**, so it needs no test
suite of its own and you must **not create one**:

- **Do NOT** add unit, integration or end-to-end tests here; do not add Vitest,
  Playwright, `playwright-bdd`, `.feature` files, a `tests/` or `e2e/` directory, or any
  test dependency, config, or CI workflow. Adding test tooling to a client repo is
  off-strategy and will be rejected in review.
- **The build IS the test.** `npm run build` validates every page against the engine's
  `pageSchema` (bad data fails the build); `npm run check:thin` proves no engine code was
  copied in. Those two — nothing more — are this repo's whole correctness gate, and they
  already run in CI (`.github/workflows/unit.yml`).
- **Why:** the components, routes, schema and rendering are the `ferst-core` engine's
  code, tested in the engine's own repo; the assembled thin-client journeys (home, nav,
  pages, blog, CMS admin) are tested once, centrally, by the template's e2e suite. A
  per-site suite would duplicate that with zero added safety, real maintenance cost, and
  it would drift.
- If you believe a genuine behaviour is untested, that is an **engine or template** change
  — **stop and report it**; do not build a test here.

(The `smoke` workflow shipped in `.github/workflows/` is a live-site health check, not a
test suite; it stays inert unless the platform sets its `SMOKE_URL` variable.)

## How pages work
A page is an ordered list of **typed blocks**, stored as one JSON file:

- `src/content/pages/<slug>.json` → served at `/<slug>` automatically (the engine's catch-all).
- `src/content/pages/index.json` is the **home** page, served at `/`.
- Nested slugs are folders: `src/content/pages/about-us/team.json` → `/about-us/team`.
- **To add a page, add a JSON file.** No route, no code.

Each file matches the engine's `pageSchema`, roughly:
`{ "title": "...", "description": "...", "blocks": [ { "type": "...", ...props }, ... ] }`.

## The block palette — your only building material
The allowed block `type`s and their exact props are defined, and kept current, in the engine:

- **`node_modules/ferst-core/content/blocks.ts`** — read this for every block type and its
  fields (Zod schemas). It is the authoritative, always-current list; prefer it over any
  list written elsewhere (which would go stale).
- Study the **existing files in `src/content/pages/`** as worked examples of valid block-JSON.

Compose pages **only** from these blocks.

## Settings, blog, media
- **Settings** — `src/content/*Settings/index.json` (site identity, navbar, footer, logo,
  theme, posts, calendar). Edit these for brand / navigation / identity.
- **Blog** — `src/content/posts/*.md` (Markdown + frontmatter; the `/posts` routes are
  engine-provided). The tag vocabulary is `src/content/tags/`.
- **Media** — put images/files in `public/uploads/` and reference them as `/uploads/<file>`.

## Verify EVERY change — the correctness gate
A change is not done until both pass:

```sh
npm run build       # FAILS if any page is invalid against pageSchema
npm run check:thin  # FAILS if this repo has copied any core file
```

`npm run build` is your schema validator — iterate until it is green. Preview with `npm run dev`.

## Working style
- Work on a **feature branch** and open a PR for a human to review. Never push to `main`
  (the live site) directly.
- Match the tone, structure and brand of the existing pages; when unsure, mirror an existing
  page's block composition rather than inventing structure.

Everything about *how* the site renders is the engine's concern — leave it to `ferst-core`.
