// The migration's URL map: one row per address the old site has (or had), and what became of
// it. It lives in the site's repo as migration/urls.csv and outlives the migration: it's the
// record that every old address that still worked was kept, redirected or deliberately let go.
//
// Pure helpers shared by urls.mjs (find and check the old addresses) and check-urls.mjs (check
// each one against the new site). No network, no files: easy to test.
//
// Columns:
//   old_url      the old address, path and query, in the form the old site served it
//   kind         page | media
//   sources      where it was found: snapshot;wayback;search-console
//   old_status   on the old site when found: 200 | 301 /elsewhere/ | 404 | ERR
//   clicks, impressions   from Search Console (blank without an export)
//   tier         A | B | C, from the platform's assessment (blank without one)
//   action       keep | redirect | drop   (blank = not decided yet)
//   new_url      where it lives now (keep: the same address; redirect: the target)
//   checked      the last check against the new site: <date> <trail>, e.g. "2026-10-09 301>200"
//   notes        why, for a drop or anything unusual

export const COLUMNS = ['old_url', 'kind', 'sources', 'old_status', 'clicks', 'impressions', 'tier', 'action', 'new_url', 'checked', 'notes'];

const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|odt|rtf|txt|csv|zip)$/i;
const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|avif|ico|bmp|mp3|mp4|mov|webm)$/i;

/** page or media, by the address's file extension. */
export function kindOf(path) {
  const p = String(path).split('?')[0];
  return DOC_EXT.test(p) || IMG_EXT.test(p) ? 'media' : 'page';
}

/**
 * An address's path and query, decoded, without the host. Accepts an absolute URL or a path.
 * Returns null for something that isn't one.
 */
export function pathOf(address) {
  try {
    const url = new URL(String(address).trim(), 'https://old.invalid');
    let path = url.pathname;
    try { path = decodeURIComponent(path); } catch { /* keep it encoded */ }
    return path + url.search;
  } catch {
    return null;
  }
}

/** The key two spellings of one address share: no trailing slash (except the root). */
export function keyOf(path) {
  const [p, q = ''] = String(path).split('?');
  const trimmed = p.length > 1 ? p.replace(/\/+$/, '') : p;
  return trimmed + (q ? `?${q}` : '');
}

/**
 * Addresses not worth a row: the CMS's own machinery, theme files, feeds, comment links and
 * search results. They never ranked as pages.
 */
export function isJunk(path) {
  const p = String(path).toLowerCase();
  if (/\/wp-(admin|includes|json|login|cron)|xmlrpc\.php|\/wp-content\/(themes|plugins|cache)\//.test(p)) return true;
  if (/\/feed\/?$|\/comments\/feed|[?&]feed=|\/trackback\/?$|\/embed\/?$/.test(p)) return true;
  if (/\.(css|js|mjs|map|json|xml|woff2?|ttf|eot)(\?|$)/.test(p)) return true;
  if (/[?&](replytocom|share|amp|utm_[a-z]+|fbclid|gclid|s)=/.test(p)) return true;
  return false;
}

/** A minimal RFC 4180 CSV reader: quoted fields, embedded commas, quotes and newlines. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

const quote = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The URL map's rows (objects keyed by COLUMNS) from CSV text. */
export function readUrlMap(text) {
  const [header, ...lines] = parseCsv(text);
  if (!header) return [];
  return lines.map((cells) => Object.fromEntries(COLUMNS.map((c) => [c, cells[header.indexOf(c)] ?? ''])));
}

/** CSV text for the URL map, pages first, then media, each in address order. */
export function writeUrlMap(rows) {
  const sorted = [...rows].sort((a, b) => (a.kind === b.kind ? a.old_url.localeCompare(b.old_url) : a.kind === 'page' ? -1 : 1));
  return [COLUMNS.join(','), ...sorted.map((r) => COLUMNS.map((c) => quote(r[c])).join(','))].join('\n') + '\n';
}

/**
 * Search Console's "Pages" export (Performance → Pages → Export → CSV): address, clicks and
 * impressions per page. The header names vary a little by language and export; this reads
 * the address column (the first, or one named like "page"/"url") and Clicks/Impressions.
 * @returns {Map<string, {clicks: number, impressions: number}>} keyed by keyOf(path)
 */
export function parseSearchConsole(text) {
  const [header = [], ...rows] = parseCsv(text);
  const lower = header.map((h) => h.trim().toLowerCase());
  let addr = lower.findIndex((h) => /page|url|address/.test(h));
  if (addr < 0) addr = 0;
  const clicks = lower.findIndex((h) => /click/.test(h));
  const impressions = lower.findIndex((h) => /impression/.test(h));
  const out = new Map();
  for (const r of rows) {
    const path = pathOf(r[addr]);
    if (!path) continue;
    out.set(keyOf(path), {
      clicks: clicks >= 0 ? Number(String(r[clicks]).replace(/[^0-9.]/g, '')) || 0 : 0,
      impressions: impressions >= 0 ? Number(String(r[impressions]).replace(/[^0-9.]/g, '')) || 0 : 0,
    });
  }
  return out;
}

/**
 * Merge newly found addresses into the existing map. One row per address (keyOf); sources
 * accumulate; Search Console numbers refresh; decisions already made (action, new_url,
 * notes, tier) are never overwritten.
 * @param {Array<object>} existing  rows from readUrlMap
 * @param {Array<{ path: string, source: string }>} found
 * @param {Map<string, {clicks: number, impressions: number}>} [searchConsole]
 */
export function mergeFound(existing, found, searchConsole = new Map()) {
  const byKey = new Map(existing.map((r) => [keyOf(r.old_url), { ...r }]));
  for (const { path, source } of found) {
    if (!path || isJunk(path)) continue;
    const key = keyOf(path);
    const row = byKey.get(key) ?? Object.fromEntries(COLUMNS.map((c) => [c, ''])) ;
    if (!row.old_url) { row.old_url = path; row.kind = kindOf(path); }
    const sources = new Set(String(row.sources || '').split(';').filter(Boolean));
    sources.add(source);
    row.sources = [...sources].sort().join(';');
    byKey.set(key, row);
  }
  for (const [key, metrics] of searchConsole) {
    const row = byKey.get(key);
    if (row) { row.clicks = String(metrics.clicks); row.impressions = String(metrics.impressions); }
  }
  return [...byKey.values()];
}

/**
 * What a request to the OLD site says about an address, as `old_status`, and the form to keep
 * in old_url. A redirect to the same address with a trailing slash is just the old site's own
 * spelling: the address is live at the slash form.
 * @param {string} path
 * @param {number|string} status
 * @param {string|null} location
 * @returns {{ old_status: string, old_url: string }}
 */
export function oldStatus(path, status, location) {
  if (typeof status === 'number' && status >= 300 && status < 400 && location) {
    const target = pathOf(location);
    if (target && keyOf(target) === keyOf(path)) return { old_status: '200', old_url: target };
    return { old_status: `${status} ${target ?? location}`, old_url: path };
  }
  return { old_status: String(status), old_url: path };
}

/** Is this row live on the old site (so it must be kept, redirected or deliberately dropped)? */
export const isLive = (row) => String(row.old_status).startsWith('200');

/** The rules in a Cloudflare Pages `_redirects` file: from (key) → { to, status }. */
export function parseRedirects(text) {
  const rules = new Map();
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [from, to, status = '302'] = line.split(/\s+/);
    if (from && to) rules.set(keyOf(pathOf(from) ?? from), { from, to, status });
  }
  return rules;
}

/**
 * Judge one address against the new site from the trail of responses it gave.
 * @param {object} row  a URL-map row
 * @param {Array<{ status: number, path: string }>} trail  each response in order; the last is the final one
 * @returns {{ ok: boolean, result: string, problem?: string }}
 */
export function judge(row, trail) {
  const result = trail.map((t) => t.status).join('>');
  const last = trail[trail.length - 1];
  const hops = trail.length - 1;
  if (!last || last.status !== 200) {
    return { ok: false, result, problem: `ends in ${last ? last.status : 'no response'}` };
  }
  // Cloudflare adds a page's trailing slash with a 308: harmless on a kept address, but on a
  // redirect it's a second hop, so the rule should point at the slash form.
  const slashOnly = (from, to) => keyOf(from) === keyOf(to);
  if (row.action === 'keep') {
    if (hops === 0 || (hops === 1 && slashOnly(trail[0].path, last.path))) return { ok: true, result };
    return { ok: false, result, problem: `a kept address should not redirect (lands on ${last.path})` };
  }
  if (row.action === 'redirect') {
    if (row.new_url && keyOf(last.path) !== keyOf(pathOf(row.new_url) ?? row.new_url)) {
      return { ok: false, result, problem: `lands on ${last.path}, expected ${row.new_url}` };
    }
    if (hops > 1) return { ok: false, result, problem: 'a redirect chain: point the rule at the final address (with its trailing slash)' };
    if (hops === 0) return { ok: false, result, problem: 'no redirect happened' };
    return { ok: true, result };
  }
  return { ok: true, result };
}
