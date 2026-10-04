---
name: migrate-site
description: Rebuild an existing website, given its URL, in this Ferst thin-client repo — snapshot the old site, inventory it, carry its content (pages, posts, brand, navigation, media) into Ferst as content data using only the engine's blocks, restructure it to fit Ferst's model, keep or redirect its URLs, audit coverage, and finish with a pull request whose MIGRATION-REPORT.md lists everything that could not be built. Use when asked to migrate, move, copy, rebuild or recreate a website from a URL on Ferst.
---

# migrate-site

You are rebuilding an existing website in this repository. Everything in `CLAUDE.md`
applies, above all **author data, not code**. Anything the engine's blocks can't express
is **not built**. It is **reported** as undeliverable.

**Carry the content, not the design.** Keep the client's words, facts, media and URLs.
Don't reproduce the old site's styling, layout quirks or structure: the result should be a
good Ferst site, built from Ferst's patterns (posts for dated things, one page per subject,
structured sections). Step 8 makes that pass deliberately. The brand (logo and colours)
comes across; the old site's look does not.

Detailed rules, the section-to-block map and the report template are in
[reference.md](reference.md). Read it before step 4.

The work happens in a temporary, git-ignored workspace, `.migration/`:

```
.migration/
  inventory.json      what the old site has          (written by the snapshot)
  pages/*.html|*.txt  each old page, raw + its text  (snapshot)
  media/              every image and document        (snapshot)
  plan.json           what happens to each old URL    (site-inventory agent)
  coverage.json       how much made it across         (coverage check)
```

## Steps

### 1. Set up
```sh
npm install && npm run update          # latest engine + scaffold
git checkout -b migrate/<old-domain>
```
Confirm the old site is reachable from this environment (`curl -sI <url>`). If it isn't,
stop and say so: a cloud session may need network access to that domain allowed.

### 2. Snapshot the old site
```sh
node .claude/skills/migrate-site/scripts/snapshot.mjs <url>
```
It discovers pages through sitemaps, RSS/Atom feeds, the WordPress API and crawling. It
saves every page and downloads all referenced media into `.migration/`. Read what it prints:

- **"crawl-only" note:** no sitemap, feed or API was found, so pages that a listing only
  loads with JavaScript, or old posts nothing links to, may be missing. Check what the site
  shows (archive pages, "older posts", post counts) and **report likely gaps**.
- **"JavaScript-rendered" warning:** the raw HTML has almost no text (common on Wix and
  some Squarespace sites). Try once more with a headless browser via `npx` (never add it to
  `package.json`). If that isn't possible, stop and report that the site needs an export
  from its owner.
- **Very large sites:** it stops at `--max-pages 200`. Raise the limit if needed, or report
  the rest.

### 3. Inventory and plan → `site-inventory` agent
Delegate to the **site-inventory** agent. It reads the snapshot and writes
`.migration/plan.json`: every old URL with an action (`page`, `post` or `skip` with a reason)
and its target file. It also returns a short brand summary and proposed navigation. Review
the plan before building. **Nothing in the inventory may be left without an entry.**

### 4. Brand and settings (you)
**Don't write `themeSettings`.** Tokens are set in the portal for every branch. Put the
proposed brand (the three colours, look, fonts) in the report's *Brand to apply in Theme
Studio* section for a person to apply.
Using the agent's brand summary and [reference.md §Brand](reference.md), set the
`src/content/*Settings/index.json` singletons:
- identity, contact and logo;
- (colours, look and fonts: **proposed in the report**, not written; see above);
- navigation (header, footer) using the **new** URLs from the plan.

### 5. Pages and posts → `page-builder` agents, in parallel
Give each **page-builder** agent a batch of plan entries: about 3–6 pages or 10 posts each,
with up to 4 agents at a time. Each agent writes its target files from the snapshot and
returns the list of gaps it couldn't build. Collect every gap; you'll need them for the report.
- Builders **don't run the build**: parallel builds would clash. You run it between batches
  (`npm run build`) and send failures back to the right builder.
- **Clear out the starter content:** delete placeholder pages and posts that have no
  counterpart on the old site, and their navigation links.

### 6. Media and redirects (you)
- Copy **only the media actually used** from `.migration/media/` into `public/uploads/`,
  following the naming and size rules in [reference.md §Media](reference.md). Report
  oversize files.
- For every old URL whose path changed, add `old new 301` to `public/_redirects`.

### 7. Audit → `migration-auditor` agent
Delegate to the **migration-auditor** agent. It does three things:
- runs `npm run build` and `npm run check:thin`;
- runs `node .claude/skills/migrate-site/scripts/coverage.mjs` and checks that every old
  page is accounted for and that its text made it across;
- reviews the low-coverage pages.

It writes `MIGRATION-REPORT.md` from the template, merging in every gap the builders
returned. Fix what it finds that's fixable, then re-run the audit until it's clean.

### 8. Restructure for Ferst → `content-architect` agent
Once the audit is CLEAN, delegate to the **content-architect** agent. It reviews the whole
site against [reference.md §The Ferst model](reference.md) and restructures it while keeping
every word:
- dated items kept as a page of links (newsletters, bulletins) become **posts**;
- overlapping pages are **merged** (e.g. Contact + Enquiries);
- walls of text get **structure**;
- navigation is **simplified**.

It updates `plan.json` and `_redirects` as it goes. Then **re-run the migration-auditor**
(coverage must still account for every old page), and add the agent's *Restructured* and
*Suggestions* lists to `MIGRATION-REPORT.md`.

### 9. Finish
```sh
rm -rf .migration
git add -A && git add -f src/content/posts public/uploads   # these folders are .gitignored for local dev
git commit -m "content: rebuild <old domain> on Ferst"
```
Open a **pull request**, never push to `main`. Paste `MIGRATION-REPORT.md` into its
description. In your final message, state the counts and the undeliverable list.

## Non-negotiables
- No code, `.astro` files, components, scripts in `src/`, or new block types. A gap is
  reported, never coded around.
- Use the client's own words: never invent text, prices, names, dates or quotes.
- Never hot-link the old site. Never commit `.migration/`.
- Every old URL ends up **built, redirected or reported**.
- Content is faithful; **presentation is Ferst's**. Restructure freely, but never drop, invent or
  reword facts.
