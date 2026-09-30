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
  it** — that is an engine change, not something to build in this repo.

(A site may carry one pre-existing bespoke `.astro` route, e.g. `src/pages/cookie-policy.astro`
— a legacy one-off. Do not add more like it.)

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
