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

`npm run update` adds the public template as a git remote. When you use `gh`, name this
repository in each call (`gh api repos/<owner>/<repo>/…`, the name from `git remote get-url
origin`), so it never acts on the template. Cloud sessions block GitHub's GraphQL API, so use
`gh api` there: `gh repo set-default`, `gh issue list` and `gh pr create` need GraphQL.

## The site keeps itself current
- **23:43 UTC, the `update` Action** (`.github/workflows/update.yml`): when the engine or the
  template is newer, it runs `npm run update`, pushes the result to `dev` and deploys the
  test copy. A failure pushes nothing and opens an `update-failed` issue.
- **Several times a day, a scheduled run** follows `.claude/skills/nightly/`: it checks the
  update landed, works this repo's open issues, and leaves comments and PRs.

So `git pull` before you start, and expect commits on `dev` you didn't make. Neither ever
touches `main`: the live site changes only when a person releases the test copy.

## Rebuilding an existing website from a URL
Use the **`migrate-site` skill** (`.claude/skills/migrate-site/`). It snapshots the old site
into a git-ignored `.migration/` folder and plans every URL with the `site-inventory` agent. It
then builds pages in parallel with `page-builder` agents and audits coverage with the
`migration-auditor` agent. The `content-architect` agent then restructures the result to fit
Ferst's model (dated items as posts, merged pages, structured text), keeping every word. It
finishes with a pull request whose `MIGRATION-REPORT.md` lists what was restructured and
everything **undeliverable** with the current blocks. **Carry the content, not the old
design.** Never write code to fill a gap. Report it.

## Principles of a modern Ferst site (apply always, not only when migrating)
1. **A short, clear menu.** At most about seven top-level items, named for what visitors
   come to do (*Visit · Times · Sacraments · Parish life · News · Contact*). No deep nested
   menus.
2. **Reference pages live in the footer.** Policies, safeguarding, privacy, terms,
   complaints, accessibility, data protection, governance documents, reports and minutes,
   and downloadable forms go in **footer columns** (`footerSettings.groups`, headed
   *Policies / Documents / Forms*). They don't go in the main menu, even when the old site
   had them there behind a big dropdown.
3. **Times have one home.** Weekly recurring times (services, opening hours, sessions)
   live once, in a `timetable` on one page (e.g. `/times`), linked from the menu. Every
   other page that mentions them **links to that page** instead of repeating the times;
   repeated times go stale.
4. **No hard-coded dates for events.** A dated event (a concert, a fair, a First Communion
   date, a diary entry) never goes in page text: it belongs in the **calendar** (`/calendar`,
   fed by the Events module). A page links to the calendar; news about an event is a post.
   When migrating, collect every dated event into the report's **Calendar to set up** list
   so a person can enter them. Never copy dates into pages.
5. **Forms and calendars come from the portal.** The organisation's forms and calendars
   live in the Ferst portal (the Forms and Events modules), never in this repo. Run
   `npx --no-install ferst-modules` to see what this site has. Place a form with
   `{ "type": "form", "form": "<id>" }`: it reads its fields and where it sends from the
   portal at build, so never copy a form's fields or wire a `contactForm` `action` by hand.
   Show the calendar by setting `calendarSettings.embedUrl` to the address it prints, never
   an old site's or a person's own Google Calendar. If a form or calendar the site needs
   isn't there, report it (or file a `core-request`) so it's created in the portal.

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

## Talking to the core team: GitHub issues, both ways
- **Start every session with** `gh issue list --label core-update --state open`. These are
  messages from the core team: what a new ferst-core or template version changed, and the
  tasks this site must do. Do them, tick the boxes, comment what you did, and close the
  issue when it's done. Also read new comments on your own `core-request` issues: that's
  where the core team says accepted / declined, which version, and what to change.
- **To ask the core team for something**, open a `core-request` issue (below).
- Never use artifacts, docs pages or notes in the repo to talk to the core team.

## Requests from the site's people: `client-request` issues
The site's editors ask for changes, and the platform opens each one as an issue in this repo
labelled `client-request`:
- **`page-change`:** "Requested changes" on a page in the content editor. The issue names the
  page.
- **`form-placement`:** add one of the organisation's portal forms, placed by id.
- **`calendar-switch`:** point `calendarSettings.embedUrl` at the portal calendar.

The issue body ends with a hidden `<!-- ferst: … -->` block saying who asked and about what.
Leave it alone.
- **Every session, after `core-update`:** `gh issue list --label client-request --state open`.
  Each one is a task. Make the change on a branch, run the gate, and open a **pull request
  into `dev`**: the core team reviews every editor's request before it reaches the test copy.
  Never push an editor's request straight to `dev`. Skip a request that already has an open PR.
- **Comment on the issue** in plain words, as the Ferst team: what you've prepared, and that
  it will appear on the test copy once it's been reviewed. Leave the issue open. The person
  who asked reads your comment in the portal's Requests tab, so no PR links, no tooling, and
  nothing about how the work was done.
- **Once the PR is merged**, comment where to see the change on the test copy (the dev address
  and the page) and that it goes live with the next release, then **close the issue**.
- **Unclear, or not possible with the blocks?** Comment with your question or the closest
  option, and leave it open. Never write code to fill a gap.
- **Needs the engine to change?** Open a `core-request` in this repo (below), mention it on
  the editor's issue in plain words, and leave that issue open. Never open issues in another
  repository: the core team reads every site's core-requests.
- **Don't edit the `requests` entries in page JSON by hand.** The platform stamps them
  (`issue`, `by`, `at`) and keeps them in step with the issues.

## Design tokens are set in the portal, for every branch
Colours, fonts and the look (`src/content/themeSettings/index.json`) belong to the portal's
**Theme Studio**, which writes the same tokens to the live branch and every test branch
(`main`, `dev`, …). **Never edit `themeSettings` in the repo**, on any branch: a local edit
makes the branches drift, and a merge would overwrite the portal's choice. If the brand
should change, propose it (in your report or PR) for a person to apply in Theme Studio.

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
- **The site's address** — `ferst-site.json` `siteUrl`, set by the platform. From it the
  engine builds every page's canonical address, the sitemap, `robots.txt`, the news feed
  (`/posts/rss.xml`), link previews and the structured data search engines read, and keeps
  test copies out of search results by itself. Don't change it by hand.
- **The site's details** — `siteSettings`: its name, description, kind (church, school,
  charity, business), contact and places (each with its address). Search engines read them,
  and the site shows them, so keep one copy here rather than retyping an address into a
  page. They're edited in the CMS's "Identity & contact" pane; the portal will take them over.
- **Writing for search** — give every page a `description` (a sentence on what it offers),
  describe images that carry meaning (decorative ones stay empty), and write link text that
  says where it goes (never "click here").
- **Old addresses** — a migrated site keeps `migration/urls.csv`: every address its old site
  had and where it went. When you move, rename or delete a page, keep the promise: add a
  `public/_redirects` line to the page's new home (one step, with the trailing slash) and
  update the row. Search rankings belong to addresses.

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
