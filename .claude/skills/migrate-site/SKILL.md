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

The work happens in two places:

```
.migration/           temporary and git-ignored, never committed
  inventory.json      what the old site has          (written by the snapshot)
  pages/*.html|*.txt  each old page, raw + its text  (snapshot)
  media/              every image and document        (snapshot)
  plan.json           what happens to each old URL    (site-inventory agent)
  coverage.json       how much made it across         (coverage check)

migration/            committed: the permanent record
  urls.csv            every old address and what became of it   (urls.mjs, check-urls.mjs)
  assessment.json     the platform's assessment of what each old address is worth
                      (present when the portal's Migrations tab has assessed the site)
```

**Search rankings belong to addresses.** Google ranks each old address on what it learned
about it over the years. An address that stops working loses that, so every old address
that still works must be **kept, redirected in one step, or dropped on purpose**, and
`migration/urls.csv` records which, for good.

## Steps

### 1. Set up
```sh
npm install && npm run update          # latest engine + scaffold
git checkout -b migrate/<old-domain>
```
Confirm the old site is reachable from this environment (`curl -sI <url>`). If it isn't,
stop and say so: a cloud session may need network access to that domain allowed.

**Search Console:** ask the client for read access to the old site's Search Console, or
for its export (Performance → Pages → Export → CSV). It's the only source that shows which
addresses actually bring visitors. If the platform has assessed the site,
`migration/assessment.json` is already here: read it first, since its tiers say which pages
carry search value.

List what the site has from its organisation in the portal: `npx --no-install ferst-modules`
(its forms, with their ids, and its calendar address). Keep the output: builders place forms
by id from it, and you set `calendarSettings.embedUrl` from it. If it can't reach the
platform, say so in the report and leave forms and the calendar as follow-ups.

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

### 2b. Find every old address → `migration/urls.csv`
```sh
node .claude/skills/migrate-site/scripts/urls.mjs <url> [--search-console Pages.csv]
```
The crawl only finds what the current site links to. This step merges what the snapshot
found with the **Wayback Machine** (every address it ever saw on the site, including old
posts and files nothing links to now) and **Search Console**. Then it checks each address on
the old site. **Only what still works today needs preserving:** an address that's already
dead on the old site has lost its rankings. The result is `migration/urls.csv`, one row per
address. You complete it as you go (`action`, `new_url`) and commit it.

**Tiers** come from the assessment. Without one, treat any address with clicks or
impressions as tier A.
- **A, earning:** keep the address (or redirect it to an exact equivalent), and keep the
  page's title, topic and main headings recognisable. The design is free.
- **B, live with little traffic:** redirect to the closest new page; the content is free.
- **C, no value:** let it go, with a reason.

### 3. Inventory and plan → `site-inventory` agent
Delegate to the **site-inventory** agent. It reads the snapshot and `migration/urls.csv`, and
writes `.migration/plan.json`: every old URL with an action (`page`, `post` or `skip` with a
reason) and its target file. It also returns a short brand summary and proposed navigation.
Review the plan before building.
- **Nothing in the inventory may be left without an entry,** and nor may any **live page
  row** in `migration/urls.csv`: the crawl may have missed old posts or pages.
- Tier A pages carry their constraint into the plan's `notes`.

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
with up to 4 agents at a time, plus the forms list from step 1. Each agent writes its target files from the snapshot and
returns the list of gaps it couldn't build. Collect every gap; you'll need them for the report.
- Builders **don't run the build**: parallel builds would clash. You run it between batches
  (`npm run build`) and send failures back to the right builder.
- **Clear out the starter content:** delete placeholder pages and posts that have no
  counterpart on the old site, and their navigation links.

### 6. Media and redirects (you)
- Copy **only the media actually used** from `.migration/media/` into `public/uploads/`,
  following the naming and size rules in [reference.md §Media](reference.md). Report
  oversize files.
- **Decide every live row in `migration/urls.csv`,** pages and media alike:
  - `keep`: the same address;
  - `redirect`: set `new_url`, and add `old new 301` to `public/_redirects`;
  - `drop`: give the reason in `notes`.

  [reference.md §URLs](reference.md) has the rules: one step to the final address (with its
  trailing slash), WordPress image sizes, documents, query-string addresses, and Cloudflare's
  limit on redirect rules.

### 7. Audit → `migration-auditor` agent
Delegate to the **migration-auditor** agent. It does four things:
- runs `npm run build` and `npm run check:thin`;
- runs `node .claude/skills/migrate-site/scripts/coverage.mjs` and checks that every old
  page is accounted for and that its text made it across;
- reviews the low-coverage pages;
- runs the redirect check against a copy of the new site:
  `node .claude/skills/migrate-site/scripts/check-urls.mjs --base <address> --write`. The
  address is the test copy once the work is on `dev`; before that, serve the build locally
  with `npx wrangler pages dev dist`, which applies `_redirects` like Cloudflare does. Every
  live old address must be kept, redirected in one step, or dropped with a reason: **CLEAN**.
  The check first asks for an address the site can't have. If the copy answers it with a
  200 (a "soft 404": a build without a "page not found" page, where Cloudflare serves the
  home page instead), every kept address would pass whatever happened to its page, so the
  check refuses to run. The engine has the page from ferst-core 0.8.0.

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

It updates `plan.json`, `_redirects` and `migration/urls.csv` as it goes, and restructures
tier A pages' presentation only. Then **re-run the migration-auditor** (coverage must still
account for every old page, and the redirect check must still be CLEAN). Add the agent's
*Restructured* and *Suggestions* lists to `MIGRATION-REPORT.md`.

### 9. Finish
Set `siteUrl` in `ferst-site.json` to the site's final public address: the bare domain (e.g.
`https://example.org`) unless the assessment shows the old site's strength is on `www`. The
engine builds every page's canonical address, the sitemap and `robots.txt` from it.
```sh
rm -rf .migration                    # the workspace goes; migration/ (the record) stays
git add -A && git add -f src/content/posts public/uploads   # these folders are .gitignored for local dev
git commit -m "content: rebuild <old domain> on Ferst"
```
Open a **pull request**, never push to `main`. Paste `MIGRATION-REPORT.md` into its
description. Its *Telling Google* checklist is for the day the domain moves
([reference.md §Telling Google](reference.md)). In your final message, state the counts, the
redirect check result and the undeliverable list.

## Non-negotiables
- No code, `.astro` files, components, scripts in `src/`, or new block types. A gap is
  reported, never coded around.
- Use the client's own words: never invent text, prices, names, dates or quotes.
- Never hot-link the old site. Never commit `.migration/`; always commit `migration/`.
- Every old address that still works ends up **kept, redirected in one step, or dropped with
  a reason** in `migration/urls.csv`, and the redirect check is **CLEAN**.
- Content is faithful; **presentation is Ferst's**. Restructure freely, but never drop, invent or
  reword facts.
