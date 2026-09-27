# Updating client sites from this template

Two channels carry fixes to client sites. Pick the channel by **what changed**.

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
Sveltia loader, a workflow, `astro.config.mjs` — must reach existing client repos. Use git as
the vehicle, but **never a three-way merge**: the CMS bot commits to client repos continuously,
so merging histories races live content and conflicts. Instead **overwrite the owned paths to
this template's version**, which is conflict-free by construction (it only touches files the
client never edits).

Per client (the platform orchestrates this centrally, per client or in waves):

```sh
# one-time, in the client repo:
git remote add upstream https://github.com/MyAI4WebDev/ferst-client-template.git

# to apply the latest scaffold:
git fetch upstream
# overwrite ONLY the template-owned paths (from ferst-template.json ownedPaths):
git checkout upstream/main -- \
  package.json astro.config.mjs tsconfig.json .gitignore \
  src/content/config.ts public/admin/index.html \
  .github/workflows/unit.yml .github/workflows/deploy.yml
# commit only if something actually changed:
git commit -m "chore: sync scaffold to ferst-client-template $(git rev-parse --short upstream/main)" || echo "already current"
git push origin <policy-branch>
```

- **Conflict-free**: only `ownedPaths` are overwritten; client content (`clientPaths`) is never
  touched.
- **Self-tracking**: the consumed template commit is recorded in the commit message, so "is
  this client current?" is answerable from `git log`.
- **Idempotent**: re-running when already current changes nothing.

> Do **not** overwrite `clientPaths` — those are the client's own data. If a *content-shape*
> change is ever needed (e.g. a new required settings field), that is a data migration, handled
> deliberately, not a scaffold overwrite.

## Retrofitting an existing site onto this template

For a site created before this template (e.g. an early client):

1. Bump it to `ferst-core@^0.5.0`.
2. Switch `astro.config.mjs` to `integrations: [ferst()]` and **delete** its now
   package-owned page files (`src/pages/*`).
3. Adopt `ferst-cms-config` in the build script; stop committing `public/admin/config.yml`.
4. Move its home content into `src/content/pages/index.json` (retire `src/data/home.json`).
5. Run the scaffold overwrite above; verify `npm run build` and `npm run check:thin` pass.
