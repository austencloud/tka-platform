# Guide Article System — Design Spec

**Date:** 2026-07-13
**Status:** Draft — awaiting Austen's review (written while he was on remote control; scoped for a desk session)
**Owner:** SEO overhaul, P0 lever ("flow arts education" search space)
**Related specs:** `2026-07-09-seo-overhaul-design.md`, `2026-07-09-guide-deep-links-design.md`, `2026-07-13-composer-marketing-page-design.md`

---

## 1. Problem

The "flow arts education" search space is our weakest SEO flank and our biggest
prize (competitor sweep 2026-07-13: notation/education content is video-first
and poi-centric; written, systematic, static-prop education is blue ocean).

The naive P0 — "make the 38 Level-1 guide topic pages crawlable" — is both
**blocked** and **misframed**:

1. **They can't prerender.** `guide/level-1/print/+page.ts` is `prerender=false`
   with the note *"Pictographs are prepared client-side, so there's nothing
   meaningful to prerender."* The pictograph pipeline is browser-only. The whole
   Level-1 reader (`/learn/guide/<slug>`) is served through the `[...appPath]`
   catch-all (`ssr=false, prerender=false`) — a client shell.
2. **They're fixed print sheets.** The `_pages/*.svelte` render inside
   `GuidePage` (`width: 8.5in`), scaled to fit. `GuideReader` notes a "future
   reflow frame" seam that does not exist yet. A prerendered sheet is
   mobile-hostile (mobile-first indexing penalty).
3. **BUT the prose is real and it is Austen's.** The pages carry his written
   explanations as text nodes/captions (not `<p>` blocks — e.g. *"If you
   memorize only one letter in each group, you know all of them,"* *"There are
   three types of reversals,"* *"This guide is written in diamond, but
   everything translates to box"*). The full written originals live in
   `static/guides/_proof/level-1-v05.pdf` and the `level-1/2/3.pdf` set.

So exposing the artboards as-is ships URLs with browser-blank pictographs and
poor mobile layout. The value isn't in un-trapping the sheets — it's in
**prose-first web articles that reflow Austen's existing guide prose and embed
the pictographs as hydrating figures.** The text (his words) prerenders and
ranks; the pictographs hydrate client-side as illustrations. No server
pictograph pipeline required.

Level 2 already proves the target shape: `/guide/level-2/turns/+page.svelte` is
a `prerender=true` route that sets guide data, renders `<GuideSeo>` + `<h1>` +
reflow section components. This spec generalizes that into a reusable system.

## 2. Core principle (load-bearing)

**Article prose is Austen's, lifted verbatim from the existing guide. Never
AI-written.** The guide IS his prose (his words, 2026-07-13). Baseline article
text comes from the existing `_pages` text and the v0.5 proof PDFs. AI arranges,
reflows, and marks up his words into `<h1>`/`<h2>`/`<p>` and figure captions —
it does not compose new explanatory prose. (Enforces `no-ghostwriting-austen`.)

## 3. Goals / Non-goals

**Goals**
- A reusable system to publish prerendered, prose-first, indexable education
  articles that embed pictographs as figures — mobile-first, zero layout shift.
- Ship the system + **one** fully-built reference article proving it end to end
  (prerenders, schema validates, figure hydrates, no shift, indexes).
- Establish the pillar→cluster internal-linking architecture the follow-on
  concept articles and prop pillars slot into.

**Non-goals**
- Server-side pictograph rendering (out of scope; figures hydrate client-side).
- Migrating / reflowing the existing print `_pages` or the `/learn/guide`
  reader (untouched — it stays the interactive app experience).
- Writing new prose. Every word ships from Austen's existing guide.
- The full concept cluster + all prop pillars (future batches, same system).

## 4. Architecture

### 4.1 Two reusable components (the system)

**`GuideArticle.svelte`** — the article layout wrapper.
- Props: `title`, `description`, `path`, `breadcrumbs`, optional `heroFigure`,
  optional `related` (prev/next + sibling links), `cta` (`"composer" | "shop" |
  "notation"`).
- Renders: the existing `GuideSeo` (canonical/OG/JSON-LD/breadcrumbs — the
  proven Level-2 primitive), a **mobile-first reflow editorial container**
  (reuse `public-editorial.css`; add a `guide-article` variant only if prose
  density needs it), the article prose as children/snippet, a related-links
  block, and a footer CTA. One place owns layout + SEO so articles never
  re-derive them (mirrors the `SequenceViewerShell` anti-drift discipline).

**`GuideFigure.svelte`** — a pictograph/sequence figure embed.
- Wraps the zero-context embed primitives (`GuidePictograph` for a single
  pictograph, `GuideSequencePlayer` for a mini-sequence — both proven
  standalone-embeddable per the composer marketing work).
- SSR renders a **reserved-aspect-ratio box + the crawlable `<figcaption>`**
  (Austen's caption text). The pictograph draws on hydrate into the reserved
  box → zero layout shift (`no-layout-shift`), caption is server-rendered →
  indexable + accessible.
- Props: the pictograph/sequence descriptor (letter/params or sequence id),
  `caption`, `size`.

### 4.2 Routes

Static per-article routes cloning the Level-2 pattern (NOT a `[slug]` param
route — a param under `/guide` or `/learn` would collide with the `/learn/guide`
reader via the catch-all; static exact routes are collision-safe and let each
article hold its own verbatim prose):

- **Concept / cluster articles** → `src/routes/(public)/guide/<slug>/+page.svelte`
  (e.g. `/guide/flow-arts-positions`). `/guide` is the cluster parent.
- **Prop pillars** → `src/routes/(public)/learn/<prop>-spinning/+page.svelte`
  (matches the existing `/learn/staff-spinning-choreography`).
- Each `+page.ts`: `export const prerender = true;`

### 4.3 Schema

Reuse `GuideSeo`. Extend it (small, additive) to accept an article `schemaType`
so concept articles can emit `LearningResource` / `HowTo` and prop pillars emit
`Article`, each with `BreadcrumbList`. Default stays whatever Level 2 uses so no
existing caller changes.

## 5. Prose sourcing (the per-article workflow)

For each article:
1. Identify the source guide page(s) + the matching v0.5 PDF section.
2. **Lift Austen's prose verbatim** — from the `_pages` text nodes/captions
   and/or the PDF text (extractable via pdf.js `getTextContent`, the same
   `level-1-v05.pdf` the `/book` compare tool already loads).
3. Mark it up: `<h1>` (target term), `<h2>` section heads, `<p>` for his
   sentences. Do not paraphrase; arrange only.
4. Embed the page's pictographs via `GuideFigure`, each with his caption.
5. Wire `GuideSeo` (title/description/canonical/breadcrumbs) — description also
   from his words (first explanatory sentence), truncated, not invented.

The rebuilt `_pages` already pair his prose with the pictographs; the article
re-expresses that pairing in reflow web form.

## 6. Reference article (this spec's build target)

**`/guide/flow-arts-positions`** — "Flow Arts Positions: Alpha, Beta, Gamma."

Chosen as the reference because it is: unambiguous (no term-mismatch risk),
maps directly to the `hand-positions` + `gamma` guide pages (clear existing
prose + position-glyph pictographs), links tightly to `/notation` (strong
cluster→pillar edge), and targets a clean, competitor-thin term set ("flow arts
positions", "alpha beta gamma flow arts", "flow arts hand positions").

- **Prose source:** the `hand-positions` / `hm-gamma` guide pages + the matching
  v0.5 PDF pages, verbatim.
- **Figures:** the three position pictographs / position glyphs the guide
  already renders (alpha, beta, gamma), via `GuideFigure`.
- **Proves:** prerender + `LearningResource`/`BreadcrumbList` schema + figure
  hydrate into a reserved box (no shift) + mobile reflow + sitemap entry +
  internal links in/out.

High-priority follow-ons (future batches, same system): `what-is-antispin`
(target "antispin" — confirm the anti↔antispin mapping against the guide's own
words + MCP before finalizing the keyword), `isolations`, `flower-patterns`,
and the first prop pillar `/learn/buugeng-spinning`.

## 7. SEO wiring

- **Sitemap** (`sitemap.xml/+server.ts`): add each article slug. Generate the
  guide-cluster list from a small article manifest so new articles auto-list.
- **Topic cluster / internal links:**
  - `/notation` ("Where to Start") + the `/guide` hub link into the concept
    articles (the `/guide` hub already gained an "Available now" section this
    session — extend it to list concept articles as they ship).
  - Concept articles link to each other (related) and → `/composer` (build it).
  - Prop pillars link → `/composer` + `/shop` + related concept articles.
- Each article: target-term `<h1>`, `<h2>` sections, schema, canonical, OG
  (sitewide `og-image.png` default until per-article cards exist).

## 8. No layout shift

`GuideFigure` reserves the pictograph's box via `aspect-ratio` (or fixed
`width`/`height`) so hydration never reflows. Headings, prose, and captions all
prerender at final size. Verified by the self-check in `no-layout-shift.md`.

## 9. Testing

- **Contract test** (`tests/unit/guide-article-contract.test.ts`, in the
  `web-ci` unit job — mirrors `sequence-viewer-shell-contract`): statically
  assert every route under the guide-article convention renders `GuideArticle`,
  declares `prerender = true`, and its `GuideArticle` usage carries
  `title`/`description`/`path`/`breadcrumbs`; and that `GuideFigure` is the only
  pictograph-embed path (no raw unsized pictograph in an article).
- **Build check**: the article routes appear in the prerender manifest and
  `npm run build` emits static HTML for each with a non-empty `<h1>` + prose.

## 10. Open questions (resolve at implementation)

1. Reflow container: reuse `public-editorial.css` as-is, or add a
   `guide-article` variant for figure-dense prose? (Start with reuse.)
2. Best verbatim prose source per topic — `_pages` text extraction vs the PDF.
   Confirm which is richer/cleaner for the reference article.
3. `GuideFigure` primitive: confirm `GuidePictograph` renders an SSR-safe
   reserved placeholder (it is "zero-context" per the composer work) or add a
   thin placeholder wrapper.
4. Does the bare `/guide/level-1` (currently a 308 → `/learn/guide`) become a
   Level-1 concept hub, or stay a redirect? (Default: leave the 308; the
   `/guide` hub is the cluster parent. Revisit if a Level-1 landing earns it.)

## 11. Scope of THIS spec

**Build now (one implementation pass):** `GuideArticle.svelte`,
`GuideFigure.svelte`, the `GuideSeo` schema extension, the sitemap + internal-
link wiring, the contract test, and **one** reference article
(`/guide/flow-arts-positions`) with verbatim prose + hydrating figures.

**Out of scope (future, same system, incremental):** the rest of the concept
cluster (`what-is-antispin`, `isolations`, `flower-patterns`, …) and the prop
pillars (`/learn/{double-staff,fan,buugeng,club,hoop}-spinning`). Each is just
Austen's existing prose + pictographs dropped into the system.

## 12. Related rules & memory

- Rules: `no-ghostwriting` (feedback), `no-layout-shift`, `never-hand-roll`,
  `primitive-discovery`, `sequence-viewer-shell` (contract-test pattern),
  `clickables-look-like-buttons` (the related-links block).
- Memory: `project_seo_overhaul`, `project_composer_marketing_page`,
  `project_guide_single_source`, `feedback_no_ghostwriting_austen`,
  `feedback_reuse_pictograph_renderer`.
