#!/usr/bin/env node
// Check every old address against the NEW site: the test copy before the domain moves, and
// the live site on the day. The redirect check of the migrate-site skill.
//
//   node .claude/skills/migrate-site/scripts/check-urls.mjs --base https://dev.<project>.pages.dev [--csv migration/urls.csv] [--redirects public/_redirects] [--write]
//
// For every address that still worked on the old site (urlmap.mjs explains the map):
//   - it must have a decision: keep, redirect or drop;
//   - keep: it must answer 200 (Cloudflare's own trailing-slash 308 first is fine);
//   - redirect: it must reach its new address in ONE 301 and answer 200 there. A chain (e.g.
//     the rule points at /contacts and Cloudflare adds the slash) fails: point the rule at the
//     final address. A redirect needs its line in public/_redirects;
//   - drop: not requested; its reason belongs in notes.
// --write records each result in the map's `checked` column. Exits 1 on any failure.
// On the day the domain moves, if the old site lived on http (its https broken), run it with
// --base http://<domain> too: each old address steps up to https first, which is free.
// First it asks for an address the site can't have: a site that answers that with anything
// but a 404 (a "soft 404") would pass every kept address, so the check refuses to run.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLive, judge, keyOf, parseRedirects, pathOf, readUrlMap, writeUrlMap } from './urlmap.mjs';

const UA = 'FerstSiteMigration/1.0 (+https://ferst.co.uk)';

/** Follow an address on the new site hop by hop (max 5), recording each response. */
export async function trailFor(base, path, fetchImpl = fetch) {
  const trail = [];
  let url = new URL(encodeURI(path), base);
  for (let i = 0; i < 6; i++) {
    let res;
    try {
      res = await fetchImpl(url, { redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
    } catch {
      trail.push({ status: 0, path: pathOf(url.href) });
      return trail;
    }
    await res.body?.cancel?.();
    const location = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !location) {
      trail.push({ status: res.status, path: pathOf(url.href) });
      return trail;
    }
    const next = new URL(location, url);
    // http → https on the same address: the domain's own step up, not a redirect rule.
    const upgrade = url.protocol === 'http:' && next.protocol === 'https:' && next.host === url.host && next.pathname === url.pathname;
    trail.push({ status: res.status, path: pathOf(url.href), ...(upgrade ? { upgrade: true } : {}) });
    url = next;
  }
  return trail;
}

/**
 * Does the new site answer a missing address with a real 404? Cloudflare Pages serves the home
 * page with a 200 when a build has no 404.html (ferst-core 0.8.0 and later always has one).
 * Then every "kept" address would answer 200 whatever happened to its page, so the check
 * can't be trusted. Returns why it refuses, or null when the site answers 404 (or 410).
 */
export async function softNotFound(base, fetchImpl = fetch) {
  const probe = `/ferst-check-missing-${Math.random().toString(36).slice(2, 10)}/`;
  const end = (await trailFor(base, probe, fetchImpl)).at(-1);
  if (end.status === 404 || end.status === 410) return null;
  if (end.status === 0) return `can't reach ${base}`;
  return `${base} answers ${end.status} at ${probe}, an address it doesn't have, so a missing page would pass as kept. ` +
    'Build with ferst-core 0.8.0 or later (it adds the "page not found" page), deploy, and check again.';
}

/**
 * The static checks that need no network: every live address decided, and every redirect
 * backed by a rule in _redirects.
 */
export function staticProblems(rows, redirectsText) {
  const rules = parseRedirects(redirectsText);
  const problems = [];
  for (const row of rows.filter(isLive)) {
    if (!row.action) problems.push({ row, problem: 'not decided: set action to keep, redirect or drop' });
    else if (row.action === 'redirect' && !rules.has(keyOf(row.old_url))) problems.push({ row, problem: 'no rule in public/_redirects' });
    else if (row.action === 'drop' && !row.notes) problems.push({ row, problem: 'dropped without a reason in notes' });
  }
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
  const base = flag('base', null);
  if (!base) {
    console.error('usage: check-urls.mjs --base <new site, e.g. https://dev.<project>.pages.dev> [--csv migration/urls.csv] [--redirects public/_redirects] [--write]');
    process.exit(2);
  }
  const refusal = await softNotFound(base);
  if (refusal) {
    console.error(`REFUSED: ${refusal}`);
    process.exit(1);
  }
  const csvPath = flag('csv', 'migration/urls.csv');
  const rows = readUrlMap(readFileSync(csvPath, 'utf8'));
  const redirectsPath = flag('redirects', 'public/_redirects');
  const failures = staticProblems(rows, existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf8') : '');

  const toCheck = rows.filter((r) => isLive(r) && (r.action === 'keep' || r.action === 'redirect'));
  const today = new Date().toISOString().slice(0, 10);
  const queue = [...toCheck];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const row = queue.shift();
      const verdict = judge(row, await trailFor(base, row.old_url));
      row.checked = `${today} ${verdict.result}${verdict.ok ? '' : ' FAIL'}`;
      if (!verdict.ok) failures.push({ row, problem: verdict.problem });
    }
  }));

  if (args.includes('--write')) writeFileSync(csvPath, writeUrlMap(rows));
  const live = rows.filter(isLive);
  console.log(`${base}: ${toCheck.length} addresses checked of ${live.length} live on the old site ` +
    `(${live.filter((r) => r.action === 'drop').length} dropped on purpose)`);
  if (!failures.length) {
    console.log('CLEAN: every live old address is kept, redirected in one step, or dropped with a reason.');
    return;
  }
  console.log(`NOT CLEAN: ${failures.length} problem(s)`);
  for (const { row, problem } of failures.slice(0, 200)) console.log(`  ${row.old_url}  ${problem}${row.checked ? `  [${row.checked}]` : ''}`);
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
