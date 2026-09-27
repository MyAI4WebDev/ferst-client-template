# ferst-client-template

The **single source** every Ferst client site is provisioned from — a *thin client* of
the [`ferst-core`](https://www.npmjs.com/package/ferst-core) package. This repo is both:

- a **GitHub template repository** the platform provisions new client sites from, and
- the **git upstream** existing client sites pull scaffold fixes from (see
  [`docs/UPDATING.md`](docs/UPDATING.md)).

It is a **real, buildable Astro site** — `npm install && npm run build` produces a working
static site — so a change here can be tested before it reaches any client.

## The golden rule

> **Engine in `ferst-core`. Scaffold here. A client owns only its content.**

- Components, layouts, page **routing**, schemas, theming and the CMS-config generator all
  live in `ferst-core`. **Never copy them here** — the `check:thin` guard fails the build if
  `src/` shadows a core module.
- This repo carries only the **scaffold** (a handful of near-static files) and **example
  content** (a neutral starter persona) that a real client replaces.
- Home is a normal page: `src/content/pages/index.json` (the reserved `index` slug renders
  at `/`). There is no bespoke home code — pick a home layout like any other page.

## Run locally

```sh
npm install
npm run dev      # preview at http://localhost:4321
npm run build    # production build -> dist/  (runs ferst-cms-config)
npm run check:thin
```

Requires Node 20+. `npm run build` also generates `dist/admin/config.yml` from `ferst-core`
via `ferst-cms-config` — this repo commits **no** `config.yml` (it is a build product, so it
can never drift from the engine's schema).

## What's in here

| Path | Owner | Notes |
|---|---|---|
| `astro.config.mjs` | scaffold | `integrations: [ferst()]` — routing comes from the package |
| `src/content/config.ts` | scaffold | one-line collections re-export (Astro 5 forces it into the consumer) |
| `package.json`, `tsconfig.json`, `.gitignore` | scaffold | near-static |
| `public/admin/index.html` | scaffold | Sveltia loader; `config.yml` is generated at build |
| `.github/workflows/` | scaffold | `check:thin` guard + Cloudflare Pages deploy |
| `ferst-template.json` | scaffold | **ownership manifest** — the paths the platform keeps in sync |
| `src/content/pages/*.json` | **client** | one JSON file per page (`index.json` = home) |
| `src/content/*Settings/index.json` | **client** | identity, theme, nav, footer, logos, posts, calendar, callout |
| `src/content/posts/`, `public/uploads/` | **client** | blog + media (gitignored; authored via `/admin`) |

## Editing a live client site (no code)

- **Content** — pages, posts, navigation, calendar: open **`/admin`** on the live site.
- **Brand & design** — colours, fonts, corners: the [Ferst portal](https://portal.ferst.co.uk)
  → your project → **Design** (with live preview).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full three-layer model and
[`docs/UPDATING.md`](docs/UPDATING.md) for how fixes reach existing client sites.

---

Built with [Ferst](https://ferst.co.uk).
