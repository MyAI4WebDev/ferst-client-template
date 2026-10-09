import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
// The skill's scripts are plain .mjs (they ship to every site's .claude/); these steps drive
// their pure logic with sample data: no network, no browser.
import { judge, keyOf, mergeFound, oldStatus, parseSearchConsole } from '../../.claude/skills/migrate-site/scripts/urlmap.mjs';
import { softNotFound, staticProblems, trailFor } from '../../.claude/skills/migrate-site/scripts/check-urls.mjs';
import { reachOldSite } from '../../.claude/skills/migrate-site/scripts/urls.mjs';

const { Given, When, Then, Before } = createBdd();

type Row = Record<string, string>;
let found: Array<{ path: string; source: string }> = [];
let gscCsv = '';
let rows: Row[] = [];
let live: { old_status: string; old_url: string } | null = null;
let row: Row = {};
let verdict: { ok: boolean; result: string; problem?: string } | null = null;
let redirectsText = '';
let refusal: string | null | undefined;
let oldSiteFetch: typeof fetch = fetch;
let reach: { origin: string; note?: string; error?: string } | null = null;

Before(() => {
  found = [];
  gscCsv = '';
  rows = [];
  live = null;
  row = {};
  verdict = null;
  redirectsText = '';
  refusal = undefined;
  oldSiteFetch = fetch;
  reach = null;
});

const rowFor = (path: string) => rows.find((r) => keyOf(r.old_url) === keyOf(path));
const blank = (): Row => ({ old_url: '', kind: '', sources: '', old_status: '', clicks: '', impressions: '', tier: '', action: '', new_url: '', checked: '', notes: '' });

Given('the snapshot found {string} and {string}', async ({}, a: string, b: string) => {
  found.push({ path: a, source: 'snapshot' }, { path: b, source: 'snapshot' });
});

Given('the Wayback Machine knows {string}, {string} and {string}', async ({}, a: string, b: string, c: string) => {
  for (const path of [a, b, c]) found.push({ path, source: 'wayback' });
});

Given('Search Console reports {int} clicks for {string}', async ({}, clicks: number, url: string) => {
  gscCsv = `Top pages,Clicks,Impressions,CTR,Position\n${url},${clicks},340,3.5%,4.1\n`;
});

When('the URL map is built', async () => {
  const gsc = parseSearchConsole(gscCsv);
  rows = mergeFound([], [...found, ...[...gsc.keys()].map((path) => ({ path, source: 'search-console' }))], gsc);
});

Then('it has {int} addresses', async ({}, n: number) => {
  expect(rows).toHaveLength(n);
});

Then('{string} was found by {string} with {int} clicks', async ({}, path: string, sources: string, clicks: number) => {
  const r = rowFor(path);
  expect(r?.sources).toBe(sources);
  expect(r?.clicks).toBe(String(clicks));
});

Then('{string} is media', async ({}, path: string) => {
  expect(rowFor(path)?.kind).toBe('media');
});

When('the old site answers {string} with a redirect to {string}', async ({}, path: string, location: string) => {
  live = oldStatus(path, 301, `http://example.org${location}`);
});

Then('the address is live as {string}', async ({}, path: string) => {
  expect(live).toEqual({ old_status: '200', old_url: path });
});

Given('the map already says {string} redirects to {string}', async ({}, from: string, to: string) => {
  rows = [{ ...blank(), old_url: from, kind: 'page', sources: 'snapshot', old_status: '200', action: 'redirect', new_url: to, notes: 'merged into Contact' }];
});

When('the Wayback Machine finds {string} again', async ({}, path: string) => {
  rows = mergeFound(rows, [{ path, source: 'wayback' }]);
});

Then('{string} still redirects to {string}', async ({}, from: string, to: string) => {
  expect(rows).toHaveLength(1);
  expect(rowFor(from)).toMatchObject({ action: 'redirect', new_url: to, notes: 'merged into Contact', sources: 'snapshot;wayback' });
});

Given('{string} is redirected to {string}', async ({}, from: string, to: string) => {
  row = { ...blank(), old_url: from, old_status: '200', action: 'redirect', new_url: to };
});

Given('{string} is kept', async ({}, path: string) => {
  row = { ...blank(), old_url: path, old_status: '200', action: 'keep', new_url: path };
});

When('the new site answers 301, then 308, then 200 at {string}', async ({}, final: string) => {
  verdict = judge(row, [
    { status: 301, path: row.old_url },
    { status: 308, path: final.replace(/\/$/, '') },
    { status: 200, path: final },
  ]);
});

When('the new site answers 308, then 200 at {string}', async ({}, final: string) => {
  verdict = judge(row, [
    { status: 308, path: row.old_url },
    { status: 200, path: final },
  ]);
});

Then('the check fails with {string}', async ({}, text: string) => {
  expect(verdict?.ok).toBe(false);
  expect(verdict?.problem).toContain(text);
});

Then('the check passes', async () => {
  expect(verdict).toMatchObject({ ok: true });
});

When("the new site answers {int} for an address it doesn't have", async ({}, status: number) => {
  refusal = await softNotFound('https://dev.example.pages.dev', async () => new Response(null, { status }));
});

Then('the check refuses to run, because {string}', async ({}, text: string) => {
  expect(refusal).toContain(text);
});

Then('the check goes ahead', async () => {
  expect(refusal).toBeNull();
});

Given("the old site's https fails with {string} but it answers over http", async ({}, code: string) => {
  oldSiteFetch = (async (input: RequestInfo | URL) => {
    if (String(input).startsWith('https:')) throw Object.assign(new TypeError('fetch failed'), { cause: { code } });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
});

Given('the old site answers over https', async () => {
  oldSiteFetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
});

When('the migration reaches the old site at {string}', async ({}, start: string) => {
  reach = await reachOldSite(start, oldSiteFetch);
});

Then('it reads the old site at {string}', async ({}, origin: string) => {
  expect(reach).toMatchObject({ origin });
  expect(reach?.error).toBeUndefined();
});

Then('it warns that search engines likely know its http addresses', async () => {
  expect(reach?.note).toMatch(/CERT_HAS_EXPIRED/);
  expect(reach?.note).toMatch(/http:\/\/ addresses/);
});

When('the new site answers at {string}: 301 to https, then 301, then 200 at {string}', async ({}, base: string, final: string) => {
  const site = (async (input: RequestInfo | URL) => {
    const u = new URL(String(input));
    if (u.protocol === 'http:') return new Response(null, { status: 301, headers: { location: `https://${u.host}${u.pathname}` } });
    if (u.pathname === row.old_url) return new Response(null, { status: 301, headers: { location: final } });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  verdict = judge(row, await trailFor(base, row.old_url, site));
});

Given('a live address {string} with no decision', async ({}, path: string) => {
  rows.push({ ...blank(), old_url: path, kind: 'page', old_status: '200' });
});

Given('{string} is redirected to {string} with no rule in _redirects', async ({}, from: string, to: string) => {
  rows.push({ ...blank(), old_url: from, kind: 'page', old_status: '200', action: 'redirect', new_url: to });
  redirectsText = '# no rules yet\n';
});

Then('the static check reports {string} and {string}', async ({}, a: string, b: string) => {
  const problems = staticProblems(rows, redirectsText).map((p: { problem: string }) => p.problem).join(' | ');
  expect(problems).toContain(a);
  expect(problems).toContain(b);
});
