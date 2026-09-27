// Content collections come from ferst-core — the schemas, the resolver and the
// collection definitions all live in the package. This one line is the whole
// contract. Astro 5 requires the content config to live in the CONSUMER, so this
// is the ONE code file a thin client cannot shed; everything else is content DATA.
export { collections } from 'ferst-core/content/collections';
