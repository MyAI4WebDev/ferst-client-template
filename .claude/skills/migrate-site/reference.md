# migrate-site — reference

The rules the steps in [SKILL.md](SKILL.md) point to. The engine's own files (listed under
*Palette*) are the source of truth: where this file and the engine disagree, the engine wins.

## Palette — your only building material

The palette is defined in the installed engine. Read these first:

| What | Where |
|---|---|
| Every block type and its exact fields | `node_modules/ferst-core/content/blocks.ts` |
| A working example of **every** block | `node_modules/ferst-core/examples/primitives.ts`, `.../examples/recipes.ts` |
| Page, settings and theme schemas | `node_modules/ferst-core/content/schemas.ts` |
| Post and tag schemas | `node_modules/ferst-core/content/posts.ts` |
| Calendar and callout settings | `node_modules/ferst-core/content/calendar.ts`, `.../callout.ts` |
| Valid pages in this repo | `src/content/pages/*.json` |

## Brand

Edit the singletons in `src/content/*Settings/index.json`, following their schemas:

- **`siteSettings`**: the site name and tagline (`identity`); address, phone, email (`contact`).
- **`logoSettings`**: download the logo into `public/uploads/` and reference it as `/uploads/<file>`.
  Add light and dark variants if the old site has them.
- **`themeSettings`: don't edit it.** Tokens are portal-owned for every branch. Work out `brand`, `ink`
  and `surface` (hex) from the old site, plus the look and fonts, and **propose** them in the report's
  *Brand to apply in Theme Studio* section. The engine derives everything else from those
  three; propose `corners`, `elevation` and `stroke` to match the look.
  - **Fonts:** the engine self-hosts **Inter, Playfair Display and Poppins** (see
    `node_modules/ferst-core/styles/fonts.css`). Propose the closest of these. If the old
    site uses another font, **report the substitution**. Don't add font files.
- **`navbarSettings` / `footerSettings`**: recreate the navigation using the **new** page
  URLs (see URLs).
- **`postsSettings`**: title and intro for the news listing. **`calendarSettings`**: set
  `embedUrl` to the Events address `npx --no-install ferst-modules` prints. Never paste the old
  site's Google Calendar embed: list that calendar under *Calendar to set up* so it's connected
  in the portal.

## Pages

`src/content/pages/<slug>.json` is served at `/<slug>`. `index.json` is the home page, and
folders nest (`about-us/team.json` → `/about-us/team`). Each page is
`{ "title", "description", "blocks": [ … ] }`.

Map each section of the old page to the closest block. Typical matches:

| On the old site | Use |
|---|---|
| Big intro / banner at the top | `hero` (`layout: "media"` for a photo/video opener; `size: "screen"` for full-screen; `parallax: true` to drift). Title line breaks are kept. |
| A short, wide header strip (e.g. 1000 × 175) | `hero` `layout: "media"`, `size: "compact"`, `fullBleed: true`; `focus` (e.g. `"center 30%"`) picks which part shows. Never drop the picture for a plain hero. |
| The intro paragraph under the header | `prose` with `variant: "lead"` |
| Paragraphs of text | `prose` (blank line = new paragraph; inline `[links](url)`, `**bold**`, `*italic*`, `- ` lists), `heading` for sub-headings |
| A single image | `image` |
| An image that links somewhere (poster, badge, partner logo) | `tiles` with `variant: "image"`, tile `{ href, image: { src, alt } }`: shown whole, the alt names the link |
| A video (YouTube / Vimeo, incl. a live stream) | `video` (consent-gated; a channel's live page loads on demand and links to its streams; `note` for the schedule). A header video: `hero` `layout: "media"` with `media.video` (a file, or a YouTube/Vimeo link) and `poster` |
| Rotating header images | `hero` `layout: "media"` with `media.images: [...]` |
| PDFs and documents to download | `documents` (opens in a new tab: never an in-page viewer); dated, repeating issues → posts (see *The Ferst model*) |
| Several images | `gallery`, or `mediaCards` if they have captions or links |
| People (clergy, staff, trustees) with photos | `mediaCards` with `"ratio": "3/4"` (portrait) or `"1/1"`, and on each photo `"focus": "center 25%"` so faces stay in the crop. Never pre-crop images by hand. |
| Feature, service or value cards | `featureCards`, `tiles`, `bento` |
| Numbers / key facts | `stats` (or `stat`); a single figure is centred |
| Step-by-step process | `steps` |
| Questions and answers | `faq`; other collapsible content → `accordion`; tabbed → `tabs` |
| Quotes and reviews | `testimonial`, `quote` |
| "Get in touch" strip, button rows | `cta`, `banner`, `button` |
| Important notice, alert | `notice`, `announcement` |
| A contact's phone / email / website as a row (no full card needed) | `linkRow` (title, links, optional intro + note) |
| Several contacts or offices (a directory) | `contacts`: groups of compact cards (role, name, phone, email + subject, address, hours), one shared note per group. Not a stack of `contactCard`s. |
| An image beside a paragraph | `mediaText` (`imageSide: start / end`; stacks on phones). Not a `grid` with prose + image. |
| Weekly times for one or more places (service times, opening hours, sessions) | `timetable` (a card per place, empty days dropped; `layout: "table"` to compare). Never nested sections + tables. |
| A prayer, verse or poem | `quote`: line breaks are kept |
| A policy, terms, conditions or other legal text | `document`: one block, clauses numbered automatically, contents list, `updated` date. Don't type numbers into headings. |
| Address, opening times, contact details | `contactCard` (subtitle and note take links + line breaks; items take line breaks), `locations` |
| Map | `mapEmbed` |
| Prices, fixed data | `pricing`, `table` |
| "Latest news" section | `latestPosts` |
| Bullet lists | `list` |
| Side-by-side or grouped layout | `section`, `grid`, `stack` |
| A form (contact, booking, enquiry) | `form` placed by id: `{ "type": "form", "form": "<id>" }`, from `npx --no-install ferst-modules`. No matching form? Leave it out and list it under *Forms to create in the portal*. |

Rules:

- **Cropped images keep their subject:** any image a block crops (`image` with a `ratio`, `mediaCards`, `tiles`, `bento`, `mediaText`) takes `"focus"`, e.g. `"center 25%"` for a face or `"top"`.
- **Documents open in a new tab by themselves** (PDF, Word, Excel, PowerPoint links). Just link them.
- **Alignment: leave the defaults unless the client wants otherwise.** A page's `align`
  (start / center / end) sets every block on it; a `section` can override its blocks. Recipe
  titles are centred by default and cards follow the page, icons included. To follow a
  client's preference for one block, set `"align"` on that block (it re-aligns the whole
  block) or `"headingAlign"` (just a recipe's title and intro). Never add styling to fake it.
- **Use the client's own words.** Copy text faithfully: fix obvious typos, never invent claims,
  prices, dates, names or quotes. If something is unclear, keep the original and mention it in
  the report.
- **Every image gets real alt text** describing it. Don't leave it blank unless the image is
  purely decorative.
- **Composition:** lead a page with its `hero`, then an introductory paragraph. Don't open a
  page with a small notice box; place notices after the intro.
- **One section = one block** where possible. Don't cram several sections into one `prose`.
- When unsure of a block's fields, copy the matching example from `examples/` and adapt it.
- **Icons** must be names from `node_modules/ferst-core/lib/icons.ts`. An unknown name fails the build and lists the valid ones. Names describe shapes, not subjects (`steeple`, `chalice`, `shell`), so pick the shape that fits.
- After each few pages, run `npm run build`. It validates every page against the schema.
- **Clear out the starter content.** A new site starts with placeholder pages
  (`about`, `services`, `contact`, plus the home page) and a sample post (`*-welcome.md`).
  Replace them with the old site's content, and delete any placeholder page or post that
  has no counterpart on the old site, along with its navigation links. No placeholder copy
  may survive.

## URLs

Search rankings belong to addresses: Google ranks each old address on what it learned about it
over the years. `migration/urls.csv` (step 2b) lists every old address that still works; each
gets one decision.

- **Keep the old path where you can** (e.g. `/about-us/our-team` →
  `src/content/pages/about-us/our-team.json`): no redirect needed, nothing to lose.
- **Redirect in one step, to the final address.** One rule per line in `public/_redirects`,
  `/old-path /new-path/ 301`, and keep the rules already there. Write the target with its
  trailing slash: Cloudflare serves pages at `/page/`, so a rule to `/page` makes it add the
  slash as a second redirect, a chain. Redirect to the **equivalent** page: a redirect to the
  home page or an unrelated page counts as "not found" for search.
- **Old posts** go to `/posts/<slug>/`.
- **Documents** (PDFs and the like) get linked from emails and found through search. If one
  still works on the old site, bring it across and redirect to it, unless the client says
  it's obsolete.
- **WordPress image sizes** (`photo-300x197.jpg`, `photo-150x150.jpg`) go to the full-size
  image's new address. An image the new site doesn't use and that has no traffic can be
  dropped (`unused image`).
- **Query-string addresses** (`/?p=123`, `/?page_id=45`): Cloudflare's `_redirects` matches
  paths only, so they can't be redirected one by one; they land on the path (usually `/`).
  Note them; the old site's own pretty address for the same page is the one to redirect.
- **Limits:** a site can have about 2,000 plain rules (and 100 with splats or placeholders).
  For whole sections whose files keep their names, use one splat rule:
  `/wp-content/uploads/* /uploads/:splat 301`.
- **Dead already?** An address that's already 404 on the old site needs no rule. If the
  assessment shows it still has backlinks, a redirect can win them back.

## Telling Google (at cutover)

When the domain moves to the new site:
1. **The day before:** lower the domain's DNS time-to-live, and run the redirect check against
   the test copy: it must be CLEAN.
2. **Switch DNS.** Check HTTPS works on the bare domain and `www`, and that one redirects to
   the other (the one in `siteUrl` is the real one).
3. **Run the redirect check against the live site:**
   `check-urls.mjs --base https://<domain> --write`. Fix anything it finds the same day.
4. **Search Console:** verify the domain if it isn't already (a DNS record); submit
   `https://<domain>/sitemap.xml`; use URL inspection on the tier A pages to ask for
   re-crawling. The same domain needs no "change of address"; that's only for a new domain.
5. **For 4–8 weeks:** watch Search Console's Pages report (new "not found" addresses) and the
   Performance report. Each new 404 is a one-line `_redirects` fix plus a row in `urls.csv`.

## Posts

- One Markdown file per post: `src/content/posts/YYYY-MM-DD-<slug>.md`, with frontmatter
  per `posts.ts`:

```md
---
title: 'The post title'
date: 2026-05-04T00:00:00.000Z
summary: 'One or two sentences for the listing.'
tags:
  - news
heroImage: /uploads/<image>
attachment: /uploads/<file>.pdf      # optional, e.g. a newsletter PDF
draft: false
---
The post body in Markdown.
```

- Use the **original publication date**. Tags must exist in `src/content/tags/` (one JSON per
  tag, per `tagSchema`). A new site starts with four: `blog`, `news`, `announcement` and
  `events`. Keep, rename or replace them to match how the old site files its posts, and add
  the ones you need (a tag no post uses gets no page, so a leftover starter is harmless).
- If the old site has a very large archive, migrate the most recent ~12 months fully and report
  the rest as a follow-up, with counts and the oldest date.

## Media

- **Download** every image and file you use into `public/uploads/` and reference it as
  `/uploads/<file>`. Never hot-link to the old site, because it will go away.
- Name files in lowercase-with-hyphens, describing the content (`parish-hall-exterior.jpg`).
- Keep images reasonable: prefer around 2000px wide at most, under about 1 MB each. Files
  (PDFs) must be **under 8 MB**, the editor's upload limit. Report anything larger.
- Only use media that belongs to the site. Report embedded third-party content (videos,
  social feeds) rather than copying it.

## Undeliverable — always report

Build only from the palette. **Do not write code, `.astro` files, scripts or new block types.**
When something can't be built, keep the rest of the page and log the gap.

Always report:

- **Sections with no matching block:** what it was, on which page, and the closest block you
  used instead (if any).
- **Formatting with no Ferst equivalent:** underlined text (reads as a link on the web; use bold
  or italic), coloured or resized text, text inside images.
- **Forms:** forms are created in the portal, not here. Place an existing one by id (`form`
  block); for any the portal doesn't have yet, report what it collected and where the old one
  sent it under *Forms to create in the portal*.
- **Embeds other than video** (social feeds, booking, shop, donation and payment widgets):
  link out with a `button` and report. YouTube/Vimeo use the `video` block.
- **Interactive features:** search, logins, member areas, e-commerce, event booking,
  comments, newsletter sign-up, cookie banners, analytics and tracking scripts.
- **Fonts** that had to be substituted (see Brand).
- **Media** that was too large, missing or unlicensed, and any text you couldn't read.
- **Pages left out** and why (duplicates, empty, behind a login, the post archive beyond the cut-off in Posts).

## The Ferst model — presentation (step 8, and good practice throughout)

The migration keeps the **content**; Ferst decides the **presentation**. Old sites grew page
by page; a Ferst site is built from a few strong patterns. Apply them:

| Old site | Ferst way |
|---|---|
| A page listing newsletters / bulletins / minutes as links | One **post** per issue (date, `summary`, tag e.g. `newsletter`, the PDF as `attachment`; body optional, so a bodyless post is a tile opening the PDF). The old page becomes an intro + `latestPosts` with `tag`, or a 301 to `/posts/tag/<tag>`. |
| Two pages about one subject (Contact + Enquiries) | **One page**, a section per topic: a `contactCard` per contact, `locations` for places. 301 the retired URL. |
| One page about unrelated subjects | **Split it**, one page per subject. |
| Long unbroken text | Structure from its own content: `heading`s, `list`s, `accordion` / `faq` for reference material, `steps` for processes. |
| Sidebar page lists, "click here" links | Navigation (≤ ~7 top items, grouped by what visitors want) and real link text or buttons. |
| Policies, safeguarding, privacy, terms, complaints, reports, minutes, forms in the main menu (often a big dropdown) | **Footer columns**: `footerSettings.groups` headed *Policies / Documents / Forms*. The main menu keeps only what visitors come to do. |
| The same service or opening times written on several pages | **One** `timetable` page (e.g. `/times`) linked from the menu; every other page links to it ("See service times"). |
| Dated events in page text (a diary, "First Communion 14 May", a concert) | The **calendar** (`/calendar`, Events module). Pages link to it; list each event under *Calendar to set up* in the report. Never copy dates into pages. |
| Undated reference files (policies, forms) | A `documents` block on the relevant page. |
| A notice at the very top | Hero → lead paragraph → then the `notice`. |
| The same kind of content styled differently on each page | One pattern site-wide (every group a `mediaCards` card, every contact a `contactCard`). |

Never drop, invent or reword facts while restructuring. Moved content keeps its coverage
(update `plan.json`: `target`, or `targets: [...]` when it now lives in several files), and
every retired URL gets a 301.

## Report template

Write the report to `MIGRATION-REPORT.md` at the repository root, commit it with the content,
and paste it into the pull request description:

```md
# Migration report — <old URL> → Ferst
Engine: ferst-core <version> · Date: <date>

## Built
- Pages: <n> (list with old URL → new path)
- Posts: <n> (date range) · Tags: <list>
- Media: <n> files · Redirects added: <n>
- Brand: colours <brand/ink/surface>, fonts <heading/body> (substitutions noted below)
- Discovery: <sitemap / feed / WordPress API / crawl-only> · old pages found: <n>
- Text coverage: <n> pages ≥ 80% · below 80%: <list with % and why>

## Old addresses (`migration/urls.csv`)
- Found: <n> (snapshot <n>, Wayback <n>, Search Console <n>) · live on the old site: <n> pages, <n> media
- Kept: <n> · Redirected: <n> · Dropped on purpose: <n> (main reasons)
- Tier A (earning): <n>: <their addresses>, each kept or redirected to its equivalent
- Redirect check against <test copy address>: CLEAN on <date> (or the problems still open)

## Telling Google (for the day the domain moves)
- [ ] Lower the DNS time-to-live the day before; the redirect check on the test copy is CLEAN
- [ ] Switch DNS; HTTPS on the bare domain and www, one redirecting to the other (`siteUrl`: <address>)
- [ ] Redirect check against the live site: CLEAN
- [ ] Search Console: domain verified, sitemap submitted, tier A pages inspected
- [ ] 4–8 weeks of watching the Pages and Performance reports

## Restructured for Ferst
- <what → why, one line each (from the content-architect)>

## Brand to apply in Theme Studio
- brand <hex> · ink <hex> · surface <hex> · corners / elevation / stroke · heading + body fonts (from Inter, Playfair Display, Poppins)

## Calendar to set up
| Date | Time | Event | Place | Repeats | Source page |
|---|---|---|---|---|---|

## Forms to create in the portal
| Form | Fields | Where the old one sent it | Page |
|---|---|---|---|

## Undeliverable (needs a decision or an engine change)
| Page | What | Why | Closest used / suggestion |
|---|---|---|---|

## Follow-ups for a human
- <forms to wire, content to confirm, archive beyond the cut-off, …>
- <the content-architect's suggestions: rewording, outdated content, photos>
```

The undeliverable list is the most important part of the report. Every gap must be listed
there. A gap that's missing from the report is worse than one that's reported.
