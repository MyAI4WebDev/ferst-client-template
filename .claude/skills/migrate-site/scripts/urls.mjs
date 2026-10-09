#!/usr/bin/env node
// Find every address the old site has (or had), check which still work, and keep the result
// as the migration's URL map, migration/urls.csv (urlmap.mjs explains the columns).
//
//   node .claude/skills/migrate-site/scripts/urls.mjs <old-site-url> [--search-console Pages.csv] [--csv migration/urls.csv] [--snapshot .migration]
//
// Sources, merged per address:
//   snapshot        what the snapshot found (.migration/inventory.json: sitemaps, feeds, the
//                   WordPress API, the crawl), if it has run
//   wayback         every address the Internet Archive has seen on the site: the best source
//                   when the site has no sitemap, and the one that finds old posts and files
//                   nothing links to any more
//   search-console  the site's Search Console "Pages" export: clicks and impressions, i.e. what
//                   Google actually sends where. Ask the client for it (or for read access).
//
// Then every address is requested on the OLD site to see whether it works today. Only what works
// today needs preserving: an address already dead on the old site has lost its rankings.
//
// Re-running merges into the existing CSV: decisions already made (action, new_url, notes,
// tier) are kept. Polite: 4 requests at a time, an identifying User-Agent.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeFound, oldStatus, parseSearchConsole, pathOf, readUrlMap, writeUrlMap, isLive } from './urlmap.mjs';

const UA = 'FerstSiteMigration/1.0 (+https://ferst.co.uk)';

/** Every address the Wayback Machine has captured under the site's host. */
export async function waybackPaths(host, fetchImpl = fetch) {
  const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}/*&output=json&fl=original&collapse=urlkey&limit=50000`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Wayback Machine answered ${res.status}`);
  const rows = await res.json();
  return rows.slice(1).map((r) => pathOf(r[0])).filter(Boolean);
}

/** The pages and media the snapshot found, if it has run. */
export function snapshotPaths(dir) {
  const file = join(dir, 'inventory.json');
  if (!existsSync(file)) return [];
  const inv = JSON.parse(readFileSync(file, 'utf8'));
  const pages = (inv.pages ?? []).map((p) => p.url ?? p.path);
  const media = (inv.media ?? []).map((m) => m.url ?? m.src);
  return [...pages, ...media].map(pathOf).filter(Boolean);
}

/**
 * Where to read the old site. Tries https first (a bare host means https). If that fails
 * (an expired or self-signed certificate, say) but http answers, reads the site over http
 * and says why: with its https broken, search engines likely know the old site by its
 * http:// addresses, so those need checking too on the day the domain moves. Read over
 * the broken https, every address would look dead and nothing would be kept.
 * @returns {Promise<{ origin: string, note?: string, error?: string }>}
 */
export async function reachOldSite(start, fetchImpl = fetch) {
  const url = new URL(start.includes('://') ? start : `https://${start}`);
  const answers = async (origin) => {
    try {
      const res = await fetchImpl(new URL('/', origin), { redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
      await res.body?.cancel?.();
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e?.cause?.code ?? e?.code ?? e?.name ?? 'no answer' };
    }
  };
  const first = await answers(url.origin);
  if (first.ok) return { origin: url.origin };
  if (url.protocol === 'https:') {
    const http = `http://${url.host}`;
    const second = await answers(http);
    if (second.ok) {
      return {
        origin: http,
        note: `${url.origin} fails (${first.code}), so the old site is read over http. With its https broken, ` +
          'search engines likely know it by its http:// addresses: check those too on the day the domain moves.',
      };
    }
    return { origin: url.origin, error: `can't reach ${url.origin} (${first.code}) or ${http} (${second.code})` };
  }
  return { origin: url.origin, error: `can't reach ${url.origin} (${first.code})` };
}

/** One request to the old site: its status, and where it redirects to, without following. */
async function probe(origin, path, fetchImpl) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(new URL(encodeURI(path), origin), {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(20_000),
      });
      await res.body?.cancel?.();
      return { status: res.status, location: res.headers.get('location') };
    } catch {
      if (attempt) return { status: 'ERR', location: null };
    }
  }
  return { status: 'ERR', location: null };
}

/**
 * Check every row on the old site and set old_status (and the slash form of old_url).
 * @param {string} origin  the old site, e.g. http://ourladyofransom.org.uk
 */
export async function checkOldSite(rows, origin, { fetchImpl = fetch, concurrency = 4, onProgress } = {}) {
  const queue = [...rows];
  let done = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const row = queue.shift();
        const { status, location } = await probe(origin, row.old_url, fetchImpl);
        Object.assign(row, oldStatus(row.old_url, status, location));
        onProgress?.(++done, rows.length);
      }
    }),
  );
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
  const start = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
  if (!start) {
    console.error('usage: urls.mjs <old-site-url> [--search-console Pages.csv] [--csv migration/urls.csv] [--snapshot .migration]');
    process.exit(2);
  }
  const reach = await reachOldSite(start);
  if (reach.error) {
    console.error(`old site: ${reach.error}`);
    process.exit(1);
  }
  if (reach.note) console.warn(`old site: ${reach.note}`);
  const site = new URL(reach.origin);
  const csvPath = flag('csv', 'migration/urls.csv');
  const existing = existsSync(csvPath) ? readUrlMap(readFileSync(csvPath, 'utf8')) : [];

  const found = snapshotPaths(flag('snapshot', '.migration')).map((path) => ({ path, source: 'snapshot' }));
  console.log(`snapshot: ${found.length} addresses`);
  try {
    const host = site.hostname.replace(/^www\./, '');
    const wayback = [...(await waybackPaths(host)), ...(await waybackPaths(`www.${host}`).catch(() => []))];
    found.push(...wayback.map((path) => ({ path, source: 'wayback' })));
    console.log(`wayback: ${wayback.length} addresses`);
  } catch (e) {
    console.warn(`wayback: unavailable (${e.message}): the map may miss old addresses nothing links to`);
  }
  let searchConsole = new Map();
  const gsc = flag('search-console', null);
  if (gsc) {
    searchConsole = parseSearchConsole(readFileSync(gsc, 'utf8'));
    found.push(...[...searchConsole.keys()].map((path) => ({ path, source: 'search-console' })));
    console.log(`search-console: ${searchConsole.size} addresses with clicks and impressions`);
  } else {
    console.warn('search-console: no export given: the map has no traffic numbers (ask the client for Search Console access)');
  }

  const rows = mergeFound(existing, found, searchConsole);
  const unchecked = rows.filter((r) => !r.old_status);
  console.log(`checking ${unchecked.length} addresses on ${site.origin} (4 at a time)...`);
  await checkOldSite(unchecked, site.origin, {
    onProgress: (n, total) => { if (n % 50 === 0 || n === total) console.log(`  ${n}/${total}`); },
  });

  mkdirSync(dirname(csvPath) || '.', { recursive: true });
  writeFileSync(csvPath, writeUrlMap(rows));
  const live = rows.filter(isLive);
  const undecided = live.filter((r) => !r.action);
  console.log(`\n${csvPath}: ${rows.length} addresses; live on the old site: ${live.length} ` +
    `(${live.filter((r) => r.kind === 'page').length} pages, ${live.filter((r) => r.kind === 'media').length} media); ` +
    `still to decide: ${undecided.length}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
