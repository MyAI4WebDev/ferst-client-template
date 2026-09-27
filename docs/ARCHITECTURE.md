# Architecture — three layers, one owner each

This template exists so that "what a client site is" has **one testable source**. Every file
a client site needs belongs to **exactly one** owner. Clean ownership is the invariant the
whole system rests on: it is what makes both package-propagation and the git-upstream update
flow conflict-free.

| Layer | Owner | Reaches a client via | Examples |
|---|---|---|---|
| **Engine** | `ferst-core` (published npm package) | version bump → **rebuild** | components, layouts, `BlockRenderer`, `pageSchema`, theming, **page routing** (`ferst()` integration), **CMS-config generation** (`ferst-cms-config`) |
| **Scaffold** | **this repo** | provisioning (new site) + **git upstream overwrite** (existing site) | `package.json`, `astro.config.mjs`, `tsconfig`, `.gitignore`, `src/content/config.ts`, `public/admin/index.html`, `.github/workflows/*` |
| **Client data** | the client repo | never propagated — it *is* the client | `src/content/pages/*.json`, `src/content/*Settings/**`, `src/content/posts/**`, `public/uploads/**` |

## Why the client is this thin

Everything that *can* be engine-owned has been pushed into `ferst-core`:

- **Routing** — `astro.config.mjs` is just `integrations: [ferst()]`. The `ferst()` integration
  injects the page catch-all (home + all pages) and `/calendar` from the package. A routing fix
  ships as a `ferst-core` bump + rebuild — the same channel component fixes travel through — so
  it never has to be hand-copied into client repos.
- **CMS config** — `public/admin/config.yml` is **generated at build** by `ferst-cms-config`
  from a single source in `ferst-core`, so every client's collections are identical and always
  match the engine's schema. No bespoke CMS drift.

What remains is the **irreducible residue**: `package.json` (it declares the `ferst-core`
dependency — it can't live inside the package), `src/content/config.ts` (Astro 5 loads content
config only from the consumer), and the near-static `astro.config.mjs` / `tsconfig` /
`.gitignore` / workflows. These change almost never — which is why git-upstream for them is
nearly a formality, and this repo's real job is being the single source new sites are
provisioned from.

## Home is a page, not a special case

Home lives at `src/content/pages/index.json` (the reserved `index` slug renders at `/`). It is
**not** a dedicated collection: its content is identical to any page (block JSON under
`pageSchema`); only its *role* is special (always present, routes to `/`). Keeping it in the
`pages` collection means home is editable and pickable in the builder exactly like any other
page — the whole point. "Always present" is enforced by the platform (the seeder always
provisions `index`; the thin-client guard fails if it is missing), not by a schema fork.

## The two ways a fix reaches clients

1. **Engine fix (the common case)** — a component, style, route or CMS-schema change: publish
   `ferst-core`, and each client picks it up on its next rebuild (which happens on the next CMS
   save, or a platform-triggered rebuild later). No repo is touched.
2. **Scaffold fix (rare)** — a change to a file this repo owns: propagated by the git-upstream
   overwrite flow in [`UPDATING.md`](UPDATING.md). Only ever touches `ownedPaths`, so it never
   collides with client content.

## The ownership manifest

`ferst-template.json` is the machine-readable contract: `ownedPaths` (scaffold, kept in sync
from this upstream) vs `clientPaths` (client data, never touched by an update). The platform
reads it for both provisioning and updates, so "what does the template own" has one definition.
