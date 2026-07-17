# SEO A+ Plan — 2026-07-16

Source: full SEO audit (4-agent codebase sweep + live-site probe). Austen approved all recommendations; target is A+ across every code-controllable grade component.

## Ledger

### Wave 1 — architecture + head fixes
- [x] W1-A1: /guide hub links every Level-1 topic page (level1-toc nav, 35 links grouped 1.0/1.1/1.2, titles from guide-page-seo.ts)
- [x] W1-A2: Level-1 index — N/A: it's a deliberate 308 → /learn/guide (retired landing per 2026-07-14 spec); orphan problem solved by W1-A1 instead
- [x] W1-A3: All editorial `/learn/guide/*` hrefs repointed (notation→/guide, choreography-cards→/guide, staff page→/guide/level-1/{the-grid,base-letters,words}); grep-proof zero survivors
- [x] W1-B1: `src/lib/shared/components/Seo.svelte` created (GuideSeo generalization, LANDING_DOMAIN-sourced og:image default, snippet passthrough)
- [x] W1-B2: Seo applied to /terms, /privacy, /delete-account, /shop/starter-pack, /shop/loop-deck/architect, /shop/success (noindex)
- [x] W1-B3: /guide hub og:image + Twitter card; title → "Flow Arts Guide | The Kinetic Alphabet"; stale "rewrite in progress" description refreshed (Fable, inline)
- [x] W1-B4: sequence/q SSR heads emit /og-default.png (verified 1200x630) when no thumbnail; contract test 5/5
- [x] W1-C1: Landing H1 = "The Kinetic Alphabet" + in-h1 span "Notation for Flow Arts"; visual byte-identical (display:block on span)
- [x] W1-C2: Landing title/og:title/twitter:title → `Flow Arts Notation | The Kinetic Alphabet`
- [x] W1-C3: Pillar sweep — glossary/roots/shop/about left (already keyword-first or no keyword to front)
- [x] W1-X1: /q/[code] title/description routed through simplifyRepeatedWord + em dashes removed (rule fixes found during review)

### Pre-existing failures on main (NOT from this work, left for their owners)
- svelte-check: `arrow-svg-parser-half.test.ts:17-18` ('dims.center' possibly undefined)
- svelte-check: `Type1HybridPage.svelte:10` (PLAIN_QUARTER_SAME_EXPLANATION no longer exported from @tka/domain — likely in-flight domain refactor)

### Wave 2 — content (after Wave 1)
- [ ] W2-1: Per-prop pillar pages: fans, clubs, hoop, buugeng (modeled on /notation + /learn/staff-spinning-choreography)
- [ ] W2-2: Poi explainer page ("why poi works differently in TKA") targeting "poi notation"
- [ ] W2-3: Question-intent pages (e.g. "how to write down staff choreography")
- [ ] W2-4: Sequence-page thin-content + og:image programmatic pass
- [x] W2-5: "flow arts software" commercial cluster: /composer retitle + description + JSON-LD keywords, keyword configs, FAQ entry, varied link web (2026-07-16, feat/flow-arts-software-seo)
- [x] W2-6: /roots/software lineage page: fact-verified roster (VTG app, LAB simulators, VisualSpinner3D, today's tools), sitemap entry, /roots cross-link (2026-07-16, feat/flow-arts-software-seo)

### Wave 3 — verification + external
- [ ] W3-1: One full `npm run check` + `npm run build`; grep built HTML for new links
- [ ] W3-2: Lighthouse/CWV pass on landing (needs Austen's browser permission — asked)
- [ ] W3-3: Scoped commits per file-ownership pathspec
- [ ] AUSTEN-1: Search Console URL Inspection live test (Cloudflare 403 check)
- [ ] AUSTEN-2: Backlinks: YouTube descriptions, Flow Arts Institute, r/flowarts
- [ ] DECISION-1: AI-search crawler stance (robots contradicts Cloudflare content signals) — awaiting Austen

## File ownership (Wave 1)
- Executor A: guide/+page.svelte, guide hub components, level-1 index, notation/+page.svelte, learn/staff-spinning-choreography/+page.svelte, shop/choreography-cards/+page.svelte (link hrefs only)
- Executor B: new src/lib/shared/seo/*, terms, privacy, delete-account, shop/starter-pack, shop/loop-deck/architect, shop/success, guide/+page.svelte HEAD BLOCK ONLY, sequence/[id]/+page.svelte, q/[code]/+page.svelte (head only)
- Executor C: landing HeroCarouselSection.svelte (H1), src/routes/+page.svelte (title/meta strings only), pillar page title strings

Conflict note: guide/+page.svelte touched by A (body links) and B (head block) — B edits ONLY inside <svelte:head>, A does NOT touch the head.
