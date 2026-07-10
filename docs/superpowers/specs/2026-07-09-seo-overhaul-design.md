# SEO Overhaul — D+ to A+ (2026-07-09)

## Goal

Anyone searching flow arts, choreography games, card games, or flow-arts learning
materials finds the shop and app. Two grade jumps: **A** = fully indexed + rich
social unfurls; **A+** = actively found via query-targeted content.

Baseline audit (2026-07-09): 46/100. Landing page markup is near-best-practice;
everything under it is broken — stale static sitemap/robots shadowing the dynamic
handlers, shop and share pages client-only (invisible to crawlers and unfurl
bots), no structured data beyond the homepage.

## Decisions (locked)

- **Shop stays admin-gated** during this work. SEO plumbing ships now so launch
  day is SEO-ready; ComingSoon page indexes with waitlist.
- **Canonical for /q/[code] → tkaflowarts.com** (`/sequence/[id]` equivalent or
  the q URL on the main domain — never tka.run; short domain is a pure redirect
  utility).
- **Sequences in sitemap: curated subset only** (released deck sequences +
  featured). Full corpus stays crawlable + unfurl-able but not sitemap-pushed.
- **Content: full strategy.** Content-strategist pass produces a keyword-mapped
  roadmap; new targeted pages built against it (copy passes Austen review per
  writing-style rules).
- **Meta rendering approach: full SSR flip** (Approach A). No client-only head
  tags (fails unfurl bots), no bot-sniffing edge injection (cloaking-adjacent;
  the dead `seo-manager.ts` pattern — deleted, not revived).

## Phase 1 — Plumbing (D+ → B)

1. **Un-shadow dynamic robots/sitemap.**
   - `svelte.config.js`: remove `/robots.txt` and `/sitemap.xml` from adapter
     `routes.exclude` (lines ~40-41).
   - Delete `static/robots.txt` and `static/sitemap.xml`.
   - `src/routes/sitemap.xml/+server.ts`: add `/shop`, `/shop/loop-deck`,
     `/shop/tnd-trilogy`, `/about`, `/support`, guide chapter pages; remove
     `/app?module=*` query-param junk and nonexistent `/changelog`.
   - `src/routes/robots.txt/+server.ts`: add Disallow for `/1989`, `/1995`,
     `/1998`, `/2003`, `/coven`, `/hall-of-shame`, `/grant-feature`,
     `/endless-spinner`, `/render-pictographs`, `/embed/`, keep `/test/`,
     `/demo/`, `/admin/`, `/api/`.
2. **Cruft removal.** Delete `src/lib/shared/foundation/services/seo-manager.ts`
   (zero call sites, cloaking-adjacent). Remove the 58-term `meta keywords` tag
   from `src/routes/+page.svelte`.

## Phase 2 — SSR meta + structured data (B → A)

3. **/sequence/[id] and /q/[code]:** flip `ssr: true` (currently forced off in
   `sequence/+layout.ts` and `q/+layout.ts`); their `+page.server.ts` loaders
   already return word/creator/thumbnail. Add `<svelte:head>`: title,
   description, `og:*` (image = sequence thumbnail), Twitter card, canonical →
   `https://tkaflowarts.com/...`. Audit page import graphs for module-level
   `window`/`document`; guard browser-only code. Server HTML = head + skeleton;
   viewer hydrates client-side.
4. **/shop/[productId] and /shop:** flip product route to `ssr: true` (Firestore
   product read moves server-side; no auth involved). Per-product title, meta
   description, canonical, og:image = real product photo, `Product`/`Offer`
   JSON-LD (price, availability, image). Listing page keeps
   `prerender/ssr: true` and the ComingSoon gate.
5. **Curated sequence sitemap entries:** released deck sequences + featured, via
   the dynamic sitemap handler (server-side Firestore query with sane cap +
   cache headers).

## Phase 3 — Findability (A → A+)

6. **Content strategy:** content-strategist agent produces keyword-mapped
   roadmap for flow arts / choreography games / card games / learning-materials
   queries. Output: `docs/reference/seo-content-roadmap.md`.
7. **Guide schema:** `LearningResource`/`Article` + `BreadcrumbList` JSON-LD on
   `/guide/level-1/*`; retitle chapters to match real queries. Verify prerender
   output contains full instructional text (build + curl check), not a JS shell.
8. **Targeted pages:** new landing pages per roadmap (e.g. flow-arts card game,
   learn staff choreography). Copy through Austen review before ship.
9. **Funnel wiring:** shop CTA on landing page sections; `Shop` entry in app
   module nav as a plain link to `/shop` (no module boot — shop stays isolated
   from app shell by design).

## Verification

- `npm run build` + `curl` the SSR/prerendered output of `/`, `/shop`,
  `/shop/[productId]`, `/sequence/[id]`, `/q/[code]`, a guide chapter —
  asserting title/OG/canonical/JSON-LD present in raw HTML (no JS).
- Live `robots.txt`/`sitemap.xml` served from dynamic handlers post-deploy
  (curl production).
- Contract test (unit, ci) asserting head-tag presence on the three
  share-critical route components so meta can't silently regress.
- Unfurl spot-check: Discord paste of a sequence link shows title + thumbnail.

## Out of scope

- Ungating the shop (separate launch decision).
- hreflang / i18n routes (revisit when translated routes go public).
- `_headers`/`_redirects` edge tuning (low impact; adapter defaults fine).
