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
- **`themeSettings`**: set `brand`, `ink` and `surface` as hex colours taken from the old site.
  The engine derives everything else from those three. Then set `corners`, `elevation` and
  `stroke` to match the look.
  - **Fonts:** the engine self-hosts **Inter, Playfair Display and Poppins** (see
    `node_modules/ferst-core/styles/fonts.css`). Use the closest of these in `fonts.heading`,
    `fonts.body` and `fonts.display`. If the old site uses another font, use the closest
    match and **report the substitution**. Don't add font files.
- **`navbarSettings` / `footerSettings`**: recreate the navigation using the **new** page
  URLs (see URLs).
- **`postsSettings`**: title and intro for the news listing. **`calendarSettings`**: if the old
  site embeds a Google Calendar, put its embed URL here.

## Pages

`src/content/pages/<slug>.json` is served at `/<slug>`. `index.json` is the home page, and
folders nest (`about-us/team.json` → `/about-us/team`). Each page is
`{ "title", "description", "blocks": [ … ] }`.

Map each section of the old page to the closest block. Typical matches:

| On the old site | Use |
|---|---|
| Big intro / banner at the top | `hero` |
| Paragraphs of text | `prose` (plain text; blank line = new paragraph), `heading` for sub-headings |
| A single image | `image` |
| Several images | `gallery`, or `mediaCards` if they have captions or links |
| Feature, service or value cards | `featureCards`, `tiles`, `bento` |
| Numbers / key facts | `stats` (or `stat`) |
| Step-by-step process | `steps` |
| Questions and answers | `faq`; other collapsible content → `accordion`; tabbed → `tabs` |
| Quotes and reviews | `testimonial`, `quote` |
| "Get in touch" strip, button rows | `cta`, `banner`, `button` |
| Important notice, alert | `notice`, `announcement` |
| Address, opening times, contact details | `contactCard`, `locations` |
| Map | `mapEmbed` |
| Prices, fixed data | `pricing`, `table` |
| "Latest news" section | `latestPosts` |
| Bullet lists | `list` |
| Side-by-side or grouped layout | `section`, `grid`, `stack` |
| Contact form | `contactForm` (see "always report" below) |

Rules:

- **Use the client's own words.** Copy text faithfully: fix obvious typos, never invent claims,
  prices, dates, names or quotes. If something is unclear, keep the original and mention it in
  the report.
- **Every image gets real alt text** describing it. Don't leave it blank unless the image is
  purely decorative.
- **Composition:** lead a page with its `hero`, then an introductory paragraph. Don't open a
  page with a small notice box; place notices after the intro.
- **One section = one block** where possible. Don't cram several sections into one `prose`.
- When unsure of a block's fields, copy the matching example from `examples/` and adapt it.
- After each few pages, run `npm run build`. It validates every page against the schema.
- **Clear out the starter content.** A new site starts with placeholder pages
  (`about`, `services`, `contact`, plus the home page) and a sample post (`*-welcome.md`).
  Replace them with the old site's content, and delete any placeholder page or post that
  has no counterpart on the old site, along with its navigation links. No placeholder copy
  may survive.

## URLs

- Prefer **the same paths as the old site** (e.g. `/about-us/our-team` →
  `src/content/pages/about-us/our-team.json`), so links, bookmarks and search rankings survive.
- Where a path has to change (file extensions like `.html` / `.php`, query-string pages, odd
  slugs), add a permanent redirect to `public/_redirects`, one rule per line:
  `/old-path /new-path 301`. Keep the rules that are already there.
- Old post URLs should redirect to `/posts/<slug>`.

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
  tag, per `tagSchema`), so add the ones you use.
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
- **Inline links or rich formatting inside paragraphs.** `prose` is plain text for now: put
  key links in a `button`, `cta` or `list` and report the rest.
- **Forms:** the `contactForm` block renders the form, but submissions need a destination
  (`action`). Report every form, what it collected, and where the old one sent it.
- **Video and other embeds** (YouTube, Vimeo, social feeds, booking, shop, donation and
  payment widgets): there is no video block yet.
- **Interactive features:** search, logins, member areas, e-commerce, event booking,
  comments, newsletter sign-up, cookie banners, analytics and tracking scripts.
- **Fonts** that had to be substituted (see Brand).
- **Media** that was too large, missing or unlicensed, and any text you couldn't read.
- **Pages left out** and why (duplicates, empty, behind a login, the post archive beyond the cut-off in Posts).

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

## Undeliverable (needs a decision or an engine change)
| Page | What | Why | Closest used / suggestion |
|---|---|---|---|

## Follow-ups for a human
- <forms to wire, content to confirm, archive beyond the cut-off, …>
```

The undeliverable list is the most important part of the report. Every gap must be listed
there. A gap that's missing from the report is worse than one that's reported.
