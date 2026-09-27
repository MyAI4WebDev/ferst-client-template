import { defineConfig } from 'astro/config';
import ferst from 'ferst-core/integration.mjs';

// A thin ferst-core client. The ferst() integration injects ALL page routes
// (home + pages + calendar) from the package, so this repo carries NO page files
// — a routing fix ships as a ferst-core bump + rebuild. This repo holds only
// content DATA (src/content) + brand/config. Home is src/content/pages/index.json.
export default defineConfig({
  output: 'static',
  integrations: [ferst()],
});
