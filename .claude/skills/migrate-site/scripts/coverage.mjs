#!/usr/bin/env node
// Coverage check for the migrate-site skill — run by the migration-auditor.
//
//   node .claude/skills/migrate-site/scripts/coverage.mjs [--out .migration] [--min 0.8]
//
// Reads .migration/inventory.json (what the old site had) and .migration/plan.json (what
// was decided for each old URL) and answers, mechanically:
//   1. Is every old page ACCOUNTED FOR — built as a page/post, or skipped with a reason?
//   2. Does every planned target file EXIST?
//   3. For each built page/post, how much of the old page's text made it across?
//      (sentences ≥ 40 chars, normalised; site-wide boilerplate — header, footer, cookie
//      notices: sentences found on most pages — is ignored)
//
// plan.json shape:
//   { "entries": [ { "url": "<old url>", "action": "page" | "post" | "skip",
//                    "target": "src/content/pages/about.json", "reason": "why (for skip)" } ] }
//
// Prints a Markdown summary and writes .migration/coverage.json.
// Exits 1 if any old page is unaccounted for or a target file is missing.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const OUT = flag('out', '.migration');
const MIN = Number(flag('min', '0.8'));

const inv = JSON.parse(readFileSync(join(OUT, 'inventory.json'), 'utf8'));
const planPath = join(OUT, 'plan.json');
if (!existsSync(planPath)) { console.error(`no ${planPath} — write the plan first (see the skill)`); process.exit(2); }
const plan = JSON.parse(readFileSync(planPath, 'utf8'));
const entries = plan.entries ?? [];

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const sentences = (text) => text.split(/(?<=[.!?])\s+|\s{2,}|\n+/).map((x) => x.trim()).filter((x) => x.length >= 40);
const strings = (v, acc = []) => {
  if (typeof v === 'string') acc.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, acc));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, acc));
  return acc;
};
const targetText = (file) => {
  const raw = readFileSync(file, 'utf8');
  if (file.endsWith('.json')) { try { return strings(JSON.parse(raw)).join(' \n '); } catch { return raw; } }
  return raw; // markdown: frontmatter + body both count
};

// boilerplate = sentences present on more than half the pages
const pageSentences = new Map();
const freq = new Map();
for (const p of inv.pages) {
  const file = join(OUT, p.text);
  const ss = existsSync(file) ? [...new Set(sentences(readFileSync(file, 'utf8')).map(norm))] : [];
  pageSentences.set(p.url, ss);
  for (const s of ss) freq.set(s, (freq.get(s) ?? 0) + 1);
}
const boiler = new Set([...freq].filter(([, n]) => inv.pages.length > 3 && n > inv.pages.length / 2).map(([s]) => s));

const byUrl = new Map(entries.map((e) => [e.url, e]));
const unaccounted = inv.pages.filter((p) => !byUrl.has(p.url) && !byUrl.has(p.finalUrl)).map((p) => p.url);
const missingTargets = [];
const rows = [];
for (const e of entries) {
  if (e.action === 'skip') { rows.push({ url: e.url, action: 'skip', reason: e.reason ?? '(no reason given)' }); continue; }
  // After restructuring, one old page's content may live in several files (`targets`).
  const targets = Array.isArray(e.targets) && e.targets.length ? e.targets : e.target ? [e.target] : [];
  const absent = targets.filter((t) => !existsSync(t));
  if (!targets.length || absent.length) { missingTargets.push(`${e.url} → ${absent.join(', ') || '(none)'}`); continue; }
  const want = (pageSentences.get(e.url) ?? []).filter((s) => !boiler.has(s));
  const have = norm(targets.map(targetText).join(' \n '));
  const missing = want.filter((s) => !have.includes(s));
  const ratio = want.length ? (want.length - missing.length) / want.length : 1;
  rows.push({ url: e.url, action: e.action, target: targets.join(', '), sentences: want.length, coverage: Number(ratio.toFixed(2)), missingSample: missing.slice(0, 5) });
}

const low = rows.filter((r) => r.coverage !== undefined && r.coverage < MIN);
const result = { unaccounted, missingTargets, low: low.map((r) => r.url), rows, boilerplateIgnored: boiler.size, threshold: MIN };
writeFileSync(join(OUT, 'coverage.json'), JSON.stringify(result, null, 2));

const pct = (r) => (r.coverage === undefined ? '—' : `${Math.round(r.coverage * 100)}%`);
console.log(`# Coverage — ${inv.source}\n`);
console.log(`Old pages: ${inv.pages.length} · planned: ${entries.length} · unaccounted: ${unaccounted.length} · missing targets: ${missingTargets.length} · below ${Math.round(MIN * 100)}%: ${low.length}\n`);
if (unaccounted.length) console.log(`## Unaccounted (add to plan.json: build or skip with a reason)\n${unaccounted.map((u) => `- ${u}`).join('\n')}\n`);
if (missingTargets.length) console.log(`## Planned but not built\n${missingTargets.map((u) => `- ${u}`).join('\n')}\n`);
console.log('| Old URL | Action | Target | Text coverage |\n|---|---|---|---|');
for (const r of rows) console.log(`| ${r.url} | ${r.action} | ${r.target ?? r.reason ?? ''} | ${pct(r)} |`);
if (low.length) {
  console.log(`\n## Below threshold — check these (missing text is either a gap to fix or something to REPORT)`);
  for (const r of low) console.log(`\n### ${r.url} (${pct(r)})\n${r.missingSample.map((s) => `- “${s}”`).join('\n')}`);
}
process.exit(unaccounted.length || missingTargets.length ? 1 : 0);
