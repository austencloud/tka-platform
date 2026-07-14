import type { EntryGenerator, PageLoad } from "./$types";
import { GUIDE_BODY_PAGES } from "../_data/guide-manifest";

/**
 * One prerendered route per Level-1 topic — the crawlable + interactive guide
 * surface (spec: 2026-07-14-guide-crawlable-paginated-reader-design.md). `entries`
 * enumerates every body page so SvelteKit prerenders them all even before a
 * prerendered index links them. Static siblings (/print, /book) keep precedence
 * over this dynamic [slug] (SvelteKit routes specific-over-dynamic).
 */
export const prerender = true;

export const entries: EntryGenerator = () => GUIDE_BODY_PAGES.map((p) => ({ slug: p.id }));

export const load: PageLoad = ({ params }) => ({ slug: params.slug });
