#!/usr/bin/env node
// Snapshot an existing website into .migration/ for the migrate-site skill.
//
//   node .claude/skills/migrate-site/scripts/snapshot.mjs <url> [--max-pages 200] [--out .migration]
//
// Dependency-free (Node 20+ fetch). It FREEZES the old site locally so the rebuild works
// from exact source — the client's real wording, every asset URL — instead of lossy
// page summaries, and so parallel page builders read from disk without re-fetching.
//
// Writes (all under --out, which git-ignores itself — nothing here is ever committed):
//   pages/<slug>.html   raw HTML of each page            pages/<slug>.txt  its visible text
//   media/<file>        every image + document referenced by the pages (downloaded once)
//   inventory.json      per page: title, description, headings, images, links, iframes,
//                       forms, flags · plus nav, brand hints (colours, fonts, logo), files
//
// Polite by default: same-site only, 4 requests at a time, an identifying User-Agent.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { reachOldSite } from './urls.mjs';

const args = process.argv.slice(2);
const startArg = args.find((a) => !a.startsWith('--'));
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
if (!startArg) {
  console.error('usage: snapshot.mjs <url> [--max-pages 200] [--out .migration]');
  process.exit(2);
}
// Over https, or over http when the site's https is broken (urls.mjs reachOldSite).
const given = new URL(startArg.includes('://') ? startArg : `https://${startArg}`);
const reach = await reachOldSite(given.href);
if (reach.error) {
  console.error(`old site: ${reach.error}`);
  process.exit(1);
}
if (reach.note) console.warn(`old site: ${reach.note}`);
const START = new URL(`${given.pathname}${given.search}`, reach.origin);
const MAX_PAGES = Number(flag('max-pages', '200'));
const OUT = flag('out', '.migration');
const UA = 'FerstSiteMigration/1.0 (+https://ferst.co.uk)';
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const CONCURRENCY = 4;

const DOC_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.rtf', '.txt', '.csv', '.zip']);
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.ico', '.bmp']);
const SKIP_EXT = new Set(['.css', '.js', '.mjs', '.json', '.xml', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.mov', '.webm', '.mp3']);

mkdirSync(join(OUT, 'pages'), { recursive: true });
mkdirSync(join(OUT, 'media'), { recursive: true });
writeFileSync(join(OUT, '.gitignore'), '*\n'); // never commit the snapshot, whatever the repo's .gitignore says

// ── helpers ──────────────────────────────────────────────────────────────────
// Scope: the whole site, or — if the start URL has a path (example.org/news) — only
// pages under that path, so a sitemap for a big parent site can't flood the crawl.
const SCOPE = START.pathname.replace(/\/+$/, '') || '';
const sameHost = (u) => u.hostname.replace(/^www\./, '') === START.hostname.replace(/^www\./, '');
const sameSite = (u) => sameHost(u) && (!SCOPE || u.pathname === SCOPE || u.pathname.startsWith(`${SCOPE}/`));
const MAX_SITEMAPS = 40;
const MAX_DISCOVERED = 5000;
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const strip = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null;
};
// A same-site link is read over the scheme the site answers on (an absolute https link
// on a site whose https is broken is still the site's own page).
const abs = (href, base) => {
  try {
    const u = new URL(href, base);
    if (sameHost(u) && /^https?:$/.test(u.protocol)) u.protocol = START.protocol;
    return u;
  } catch { return null; }
};
const normPage = (u) => {
  const n = new URL(u.href);
  n.hash = '';
  n.search = ''; // query-string pages are noted by the crawl but snapshotted once
  if (n.pathname !== '/' && n.pathname.endsWith('/')) n.pathname = n.pathname.slice(0, -1);
  return n.href;
};
const slugFor = (u) => {
  const p = new URL(u).pathname.replace(/^\/|\/$/g, '');
  return (p || 'index').replace(/[^a-zA-Z0-9._-]+/g, '__').slice(0, 150);
};
const fileNameFor = (u, used) => {
  const url = new URL(u);
  let base = decodeURIComponent(url.pathname.split('/').pop() || 'file').toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'file';
  if (!extname(base)) base += '.bin';
  let name = base;
  for (let i = 2; used.has(name); i++) name = base.replace(/(\.[^.]+)$/, `-${i}$1`);
  used.add(name);
  return name;
};
async function get(url, { binary = false } = {}) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: binary ? '*/*' : 'text/html,application/xhtml+xml,*/*' }, redirect: 'follow' });
    if (!res.ok) return { ok: false, status: res.status, url: res.url };
    const type = res.headers.get('content-type') ?? '';
    if (binary) {
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len > MAX_MEDIA_BYTES) return { ok: false, status: 'too_large', bytes: len, url: res.url };
      const buf = Buffer.from(await res.arrayBuffer());
      return { ok: true, buf, type, url: res.url };
    }
    return { ok: true, text: await res.text(), type, url: res.url };
  } catch (e) {
    return { ok: false, status: String(e?.cause?.code ?? e?.message ?? e), url };
  }
}
async function pool(items, fn, n = CONCURRENCY) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// ── 1. seeds: sitemaps, feeds, the WordPress API, and the start URL ──────────
// A crawl only finds what is LINKED. Listings that load more with JavaScript, or show
// only the latest N posts, hide older content — so discover URLs every way a site
// publishes them. (Many sites answer unknown paths with their home page, so each
// source is accepted only if its body really is a sitemap / feed / JSON.)
const queue = [normPage(START)];
const seen = new Set(queue);
const discovery = { sitemaps: 0, feeds: 0, wordpressApi: 0 };
const sitemapUrls = new Set(['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/sitemap-0.xml', '/wp-sitemap.xml', '/page-sitemap.xml', '/post-sitemap.xml'].map((p) => new URL(p, START).href));
const robots = await get(new URL('/robots.txt', START).href);
if (robots.ok && !/<html/i.test(robots.text)) for (const m of robots.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)) sitemapUrls.add(m[1]);
const fromSitemap = [];
// feeds (RSS / Atom): advertised on the home page, plus the usual paths
const feedUrls = new Set(['/feed', '/rss.xml', '/feed.xml', '/atom.xml', '/index.xml', '/blog/feed', '/news/feed'].map((p) => new URL(p, START).href));
const home = await get(START.href);
if (home.ok) for (const m of home.text.matchAll(/<link\b[^>]*type=["']application\/(rss|atom)\+xml["'][^>]*>/gi)) {
  const u = abs(attr(m[0], 'href') ?? '', START);
  if (u) feedUrls.add(u.href);
}
for (const f of feedUrls) {
  const r = await get(f);
  if (!r.ok || !/<(rss|feed)\b/i.test(r.text)) continue;
  discovery.feeds++;
  for (const m of r.text.matchAll(/<link>\s*([^<\s]+)\s*<\/link>|<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/gi)) fromSitemap.push(decode(m[1] ?? m[2]));
}
// WordPress: the REST API lists every published post and page, paginated
const wpProbe = await get(new URL('/wp-json/', START).href);
if (wpProbe.ok && /^\s*\{/.test(wpProbe.text)) {
  for (const kind of ['posts', 'pages']) {
    for (let page = 1; page <= 20; page++) {
      const r = await get(new URL(`/wp-json/wp/v2/${kind}?per_page=100&page=${page}&_fields=link`, START).href);
      if (!r.ok || !/^\s*\[/.test(r.text)) break;
      const items = JSON.parse(r.text);
      if (!items.length) break;
      for (const it of items) if (it.link) { fromSitemap.push(it.link); discovery.wordpressApi++; }
      if (items.length < 100) break;
    }
  }
}
const visitedSitemaps = new Set();
async function readSitemap(u, depth = 0) {
  if (visitedSitemaps.has(u) || depth > 3 || visitedSitemaps.size >= MAX_SITEMAPS || fromSitemap.length >= MAX_DISCOVERED) return;
  visitedSitemaps.add(u);
  const r = await get(u);
  if (!r.ok || !/<(urlset|sitemapindex)/i.test(r.text)) return;
  discovery.sitemaps++;
  for (const m of r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    const loc = decode(m[1]);
    if (/sitemap.*\.xml(\?|$)/i.test(loc)) await readSitemap(loc, depth + 1);
    else fromSitemap.push(loc);
  }
}
for (const s of sitemapUrls) await readSitemap(s);
for (const loc of fromSitemap) {
  const u = abs(loc, START);
  if (u && sameSite(u) && !SKIP_EXT.has(extname(u.pathname).toLowerCase())) {
    const k = normPage(u);
    if (!seen.has(k)) { seen.add(k); queue.push(k); }
  }
}

// ── 2. crawl ─────────────────────────────────────────────────────────────────
const pages = [];
const files = new Map(); // url -> { url, referencedFrom: Set }
const mediaRefs = new Map(); // url -> { url, alts: Set, pages: Set }
const brand = { colors: new Map(), fonts: new Map(), logoCandidates: new Set(), stylesheets: new Set() };
const warnings = [];
const addMedia = (u, alt, pageUrl) => {
  const e = mediaRefs.get(u) ?? { url: u, alts: new Set(), pages: new Set() };
  if (alt) e.alts.add(alt);
  e.pages.add(pageUrl);
  mediaRefs.set(u, e);
};
const tally = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);
const scanCss = (css) => {
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    tally(brand.colors, `#${h}`);
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1].split(',')[0].trim().replace(/^["']|["']$/g, '');
    if (first && !/^(inherit|initial|var\()/i.test(first)) tally(brand.fonts, first);
  }
};

let nav = { header: [], footer: [] };
while (queue.length && pages.length < MAX_PAGES) {
  const batch = queue.splice(0, CONCURRENCY);
  await pool(batch, async (pageUrl) => {
    const r = await get(pageUrl);
    if (!r.ok) { warnings.push(`page ${pageUrl}: ${r.status}`); return; }
    if (!/html/i.test(r.type)) {
      files.set(pageUrl, { url: pageUrl, referencedFrom: new Set(['sitemap/crawl']) });
      return;
    }
    const html = r.text;
    const base = r.url;
    const slug = slugFor(pageUrl);
    writeFileSync(join(OUT, 'pages', `${slug}.html`), html);
    const body = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
    // The page's own text, one block per line: site chrome (header / nav / footer) left
    // out, block-level tags turned into line breaks so paragraphs stay separate.
    const main = body.replace(/<(header|nav|footer)\b[\s\S]*?<\/\1>/gi, '\n')
      .replace(/<(br|hr)\b[^>]*>/gi, '\n')
      .replace(/<\/?(p|div|section|article|main|aside|h[1-6]|li|ul|ol|tr|td|th|table|blockquote|figure|figcaption|dt|dd|details|summary)\b[^>]*>/gi, '\n');
    const text = main.split('\n').map((l) => strip(l)).filter(Boolean).join('\n');
    writeFileSync(join(OUT, 'pages', `${slug}.txt`), text);

    const title = strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const descTag = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0];
    const headings = [...body.matchAll(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => ({ level: m[1].toLowerCase(), text: strip(m[2]) })).filter((h) => h.text);

    const images = [];
    for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const src = attr(tag, 'src') ?? attr(tag, 'data-src') ?? (attr(tag, 'srcset') ?? '').split(',').pop()?.trim().split(/\s+/)[0];
      const u = src ? abs(src, base) : null;
      if (!u || u.protocol === 'data:') continue;
      const alt = attr(tag, 'alt') ?? '';
      images.push({ src: u.href, alt });
      addMedia(u.href, alt, pageUrl);
      if (/logo/i.test(`${src} ${alt} ${attr(tag, 'class') ?? ''}`)) brand.logoCandidates.add(u.href);
    }
    for (const m of body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
      const u = abs(m[1], base);
      if (u && IMG_EXT.has(extname(u.pathname).toLowerCase())) { images.push({ src: u.href, alt: '', background: true }); addMedia(u.href, '', pageUrl); }
    }

    const links = [];
    for (const m of body.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = attr(m[0], 'href');
      if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) {
        if (href && /^(mailto:|tel:)/i.test(href)) links.push({ href, text: strip(m[1]), kind: 'contact' });
        continue;
      }
      const u = abs(href, base);
      if (!u) continue;
      const ext = extname(u.pathname).toLowerCase();
      const internal = sameSite(u);
      links.push({ href: u.href, text: strip(m[1]), internal });
      if (DOC_EXT.has(ext)) {
        const f = files.get(u.href) ?? { url: u.href, referencedFrom: new Set() };
        f.referencedFrom.add(pageUrl);
        files.set(u.href, f);
        continue;
      }
      if (IMG_EXT.has(ext)) { addMedia(u.href, strip(m[1]), pageUrl); continue; }
      if (internal && !SKIP_EXT.has(ext)) {
        const k = normPage(u);
        if (!seen.has(k)) { seen.add(k); queue.push(k); }
      }
    }

    const iframes = [...body.matchAll(/<iframe\b[^>]*>/gi)].map((m) => attr(m[0], 'src')).filter(Boolean);
    const videos = [...body.matchAll(/<video\b[\s\S]*?<\/video>/gi)].length;
    const forms = [...body.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map((m) => ({
      action: attr(`<form ${m[1]}>`, 'action') ?? '',
      method: (attr(`<form ${m[1]}>`, 'method') ?? 'get').toLowerCase(),
      fields: [...m[2].matchAll(/<(input|textarea|select)\b[^>]*>/gi)]
        .map((f) => ({ name: attr(f[0], 'name') ?? '', type: attr(f[0], 'type') ?? f[1].toLowerCase() }))
        .filter((f) => f.name && !/hidden|submit|button/i.test(f.type)),
    }));

    // brand hints: inline <style> + same-site stylesheets (fetched once each, below)
    for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) scanCss(m[1]);
    for (const m of html.matchAll(/<link\b[^>]*rel=["']?stylesheet[^>]*>/gi)) {
      const u = abs(attr(m[0], 'href') ?? '', base);
      if (u) brand.stylesheets.add(u.href);
    }
    for (const m of html.matchAll(/<meta[^>]+name=["']theme-color["'][^>]*>/gi)) {
      const c = attr(m[0], 'content');
      if (c) tally(brand.colors, c.toLowerCase());
    }

    const scripts = (html.match(/<script\b/gi) ?? []).length;
    const flags = [];
    if (text.length < 300 && scripts > 5) flags.push('likely_js_rendered');
    if (iframes.length) flags.push('has_embeds');
    if (videos) flags.push('has_video');
    if (forms.length) flags.push('has_forms');
    if (/wp-content|wordpress/i.test(html)) flags.push('wordpress');
    if (/squarespace/i.test(html)) flags.push('squarespace');
    if (/wix\.com|wixstatic/i.test(html)) flags.push('wix');

    if (normPage(new URL(pageUrl)) === normPage(START)) {
      const pick = (re) => {
        const block = html.match(re)?.[0] ?? '';
        return [...block.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
          .map((m) => ({ text: strip(m[1]), href: abs(attr(m[0], 'href') ?? '', base)?.href ?? '' }))
          .filter((l) => l.text && l.href);
      };
      nav = { header: pick(/<(header|nav)\b[\s\S]*?<\/\1>/i), footer: pick(/<footer\b[\s\S]*?<\/footer>/i) };
    }

    pages.push({
      url: pageUrl, finalUrl: r.url, path: new URL(pageUrl).pathname, slug,
      html: `pages/${slug}.html`, text: `pages/${slug}.txt`,
      title, description: descTag ? attr(descTag, 'content') ?? '' : '',
      textLength: text.length, headings, images, iframes, videos, forms,
      links: links.filter((l) => l.internal === false || l.kind === 'contact').slice(0, 60),
      internalLinkCount: links.filter((l) => l.internal).length, flags,
    });
    process.stdout.write(`\rpages ${pages.length} · queued ${queue.length}   `);
  });
}
if (queue.length) warnings.push(`stopped at --max-pages ${MAX_PAGES}; ${queue.length} more URLs were queued`);
process.stdout.write('\n');

// stylesheets (same-site only) for colours + fonts
await pool([...brand.stylesheets].filter((s) => sameHost(new URL(s))).slice(0, 20), async (s) => {
  const r = await get(s);
  if (r.ok) scanCss(r.text);
});

// ── 3. download media + documents ───────────────────────────────────────────
const used = new Set();
const media = [];
const wanted = [
  ...[...mediaRefs.values()].map((m) => ({ url: m.url, kind: 'image', alts: [...m.alts], pages: [...m.pages] })),
  ...[...files.values()].map((f) => ({ url: f.url, kind: 'file', alts: [], pages: [...f.referencedFrom] })),
];
await pool(wanted, async (w) => {
  const r = await get(w.url, { binary: true });
  if (!r.ok) { media.push({ ...w, file: null, error: String(r.status) }); return; }
  const name = fileNameFor(r.url ?? w.url, used);
  writeFileSync(join(OUT, 'media', name), r.buf);
  media.push({ ...w, file: `media/${name}`, bytes: r.buf.length, type: r.type });
});
process.stdout.write(`media ${media.filter((m) => m.file).length}/${wanted.length} downloaded\n`);

// ── 4. inventory ────────────────────────────────────────────────────────────
const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, count]) => ({ value, count }));
const inventory = {
  source: START.href,
  fetchedAt: new Date().toISOString(),
  counts: { pages: pages.length, media: media.filter((m) => m.file).length, mediaFailed: media.filter((m) => !m.file).length },
  // How URLs were found. All zero = crawl-only: content a listing loads with JavaScript,
  // or only shows the latest N of, may be MISSING — check counts and report gaps.
  discovery: { ...discovery, crawlOnly: !discovery.sitemaps && !discovery.feeds && !discovery.wordpressApi },
  nav,
  brand: { colors: top(brand.colors, 15), fonts: top(brand.fonts, 8), logoCandidates: [...brand.logoCandidates].slice(0, 10) },
  pages: pages.sort((a, b) => a.path.localeCompare(b.path)),
  media: media.sort((a, b) => a.url.localeCompare(b.url)),
  warnings,
};
writeFileSync(join(OUT, 'inventory.json'), JSON.stringify(inventory, null, 2));
const jsPages = pages.filter((p) => p.flags.includes('likely_js_rendered')).length;
console.log(`inventory: ${OUT}/inventory.json — ${pages.length} pages, ${inventory.counts.media} media files, ${warnings.length} warnings`);
if (inventory.discovery.crawlOnly) console.log('NOTE: no sitemap, feed or WordPress API found — discovery was crawl-only; older posts may be missing.');
if (jsPages) console.log(`WARNING: ${jsPages} page(s) look JavaScript-rendered (little text in the raw HTML) — see the skill's fallback.`);
if (!existsSync(join(OUT, 'inventory.json'))) process.exit(1);
