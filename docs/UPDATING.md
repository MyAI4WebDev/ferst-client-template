# Updating client sites from this template

Two channels carry fixes to client sites. Pick the channel by **what changed**.

## 0. The one-command way: `npm run update`

`npm run update` (the `ferst-update` bin, from `ferst-core`) automates both channels below:
it reads `ferst-template.json` (`upstream` + `ownedPaths`), fetches the template, overwrites
the owned scaffold paths (**never client data**), installs `ferst-core@latest`, then runs
`build` + `check:thin`. This is the routine way to keep a site current — a coding agent runs
it first thing (see `CLAUDE.md`).

```sh
npm install && npm run update      # sync scaffold + bump to latest core, then verify
# npm run update -- --dry-run      # preview what would change, write nothing
# npm run update -- --no-core      # scaffold sync only (skip the ferst-core bump)
```

The authoritative owned-path list is `ferst-template.json` `ownedPaths` (the hardcoded list in
the manual example below is illustrative and may lag). The sections below explain what the
command does under the hood, and the manual path if you ever need it.

## 1. Engine fixes — the common case (no repo touched)

A change to a component, layout, route, style, theming or the CMS schema lives in
`ferst-core`. To ship it:

1. Make the change in `ferst-core`, publish a new version.
2. Bump `ferst-core` in this template (and, when ready, in client repos).
3. Each client picks it up **on its next build** — which happens on the next CMS save, or a
   platform-triggered rebuild.

Nothing in a client repo needs editing. This is where the vast majority of frontend fixes go.

## 2. Scaffold fixes — rare (git upstream overwrite)

A change to a file **this repo owns** (`ownedPaths` in `ferst-template.json`) — e.g. the
Sveltia loader, a workflow, `src/content/config.ts` — must reach existing client repos. Use git
as the vehicle, but **never a three-way merge**: the CMS bot commits to client repos
continuously, so merging histories races live content and conflicts. Instead **overwrite the
owned paths to this template's version**, which is conflict-free by construction (it only
touches files the client never edits).

Per client (the platform orchestrates this centrally, per client or in waves):

```sh
# one-time, in the client repo:
git remote add upstream https://github.com/MyAI4WebDev/ferst-client-template.git

# to apply the latest scaffold:
git fetch upstream
# overwrite ONLY the template-owned paths (from ferst-template.json ownedPaths):
git checkout upstream/main -- \
  ferst-template.json package.json CLAUDE.md \
  src/content/config.ts public/admin/index.html \
  .github/workflows/unit.yml .github/workflows/smoke.yml
# commit only if something actually changed:
git commit -m "chore: sync scaffold to ferst-client-template $(git rev-parse --short upstream/main)" || echo "already current"
git push origin <policy-branch>
```

- **Conflict-free**: only `ownedPaths` are overwritten; client content (`clientPaths`) and
  seed-once files (`seedPaths`) are never touched.
- **Self-tracking**: the consumed template commit is recorded in the commit message, so "is
  this client current?" is answerable from `git log`.
- **Idempotent**: re-running when already current changes nothing.

> Do **not** overwrite `clientPaths` — those are the client's own data. Do **not** overwrite
> `seedPaths` either (`astro.config.mjs`, `tsconfig.json`, `.gitignore`, the opt-in
> `deploy.yml`, and `public/_redirects`): they are seeded once, then a client may legitimately
> customise them, and force-syncing would clobber that. If a *content-shape* change is ever
> needed (e.g. a new required settings field), that is a data migration, handled deliberately,
> not a scaffold overwrite. If a `seedPath` file itself must change fleet-wide, that is a
> deliberate per-client edit, not a blanket overwrite.

## Legacy URLs (migrated sites)

A site migrated onto Ferst keeps its old URLs working with **`public/_redirects`** —
Cloudflare Pages' native redirect table (real HTTP 301s at the edge). One rule per line,
`FROM TO [STATUS]`; splats/placeholders are supported. This is the **only** home for legacy
redirects — never `astro.config.mjs` — which keeps the build config identical across every
client, so `astro.config.mjs` stays a clean `seedPath`. `public/_redirects` ships as a
commented template; a migrated site fills in its rules, a brand-new site needs none.

There is deliberately **no legacy-site runtime here** — we do not scrape, host or run old
sites from a Ferst client repo; a redirect table is the whole legacy-content procedure.

## Testing (what runs where)

Client repos carry **no test suite** — `npm run build` (validates content against the engine
`pageSchema`) + `npm run check:thin` are the whole per-client gate, run by
`.github/workflows/unit.yml`. The engine (`ferst-core`) is unit/integration/E2E-tested in its
own repo; the assembled thin-client journeys are E2E-tested once, centrally, by **this
template's `e2e/` suite** (playwright-bdd; template-only, never seeded into clients). The
opt-in `smoke` workflow is a live-site health check, not a test suite. See `CLAUDE.md`
("Testing") — an agent working in a client repo must not add tests there.

## Retrofitting an existing site onto this template

For a site created before this template (e.g. an early client):

1. Bump it to `ferst-core@^0.5.0`.
2. Switch `astro.config.mjs` to `integrations: [ferst()]` and **delete** its now
   package-owned page files (`src/pages/*`).
3. Move any legacy-URL `redirects` out of `astro.config.mjs` into `public/_redirects`
   (see "Legacy URLs" above), so `astro.config.mjs` matches the template's `seedPath`.
4. Adopt `ferst-cms-config` in the build script; stop committing `public/admin/config.yml`.
5. Move its home content into `src/content/pages/index.json` (retire `src/data/home.json`).
6. Run the scaffold overwrite above; verify `npm run build` and `npm run check:thin` pass.
