import { defineConfig } from 'astro/config';
import ferst from 'ferst-core/integration.mjs';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

// ── Local core development (inert in production) ─────────────────────────────
// Set FERST_CORE_LOCAL in .env.local (gitignored) to build against a sibling
// `ferst-core` source checkout instead of the installed npm package — iterate on
// core + this client together, no publish loop. Values:
//   FERST_CORE_LOCAL=1        → alias to ../myai4-ferst-core/packages/core
//   FERST_CORE_LOCAL=<path>   → alias to that path
// Unset (the default, and on Cloudflare Pages) → the published package is used,
// so production always builds against a real release. This block is a no-op unless
// the env var is set, so it is safe to carry in every client (it is a seedPath).
const { FERST_CORE_LOCAL } = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), 'FERST_CORE_LOCAL');
const localCore =
  FERST_CORE_LOCAL === '1'
    ? fileURLToPath(new URL('../myai4-ferst-core/packages/core', import.meta.url))
    : FERST_CORE_LOCAL || null;
if (localCore) console.log(`[ferst] Using LOCAL core at ${localCore}`);
const localCoreFwd = localCore ? localCore.replace(/\\/g, '/') : null;

// A thin ferst-core client. The ferst() integration injects ALL routes from the
// package — home, the pages catch-all, calendar AND the blog (/posts, post pages,
// tag archives) — so this repo carries NO page files; a routing fix ships as a
// ferst-core bump + rebuild. This repo holds only content DATA (src/content).
//
// Legacy-URL redirects (for a migrated site) do NOT go here — they live in
// `public/_redirects` (Cloudflare Pages native 301s), which keeps this config
// standard across every client. See docs/UPDATING.md → "Legacy URLs".
export default defineConfig({
  output: 'static',
  integrations: [ferst()],
  vite: localCoreFwd
    ? {
        resolve: {
          alias: [{ find: /^ferst-core\/(.*)$/, replacement: `${localCoreFwd}/$1` }],
        },
        // The dev server sandboxes file reads to the project root; allow the
        // sibling core checkout so its source can be served.
        server: { fs: { allow: ['.', localCore] } },
      }
    : {},
});
