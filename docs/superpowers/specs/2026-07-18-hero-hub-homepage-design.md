# Homepage Hero + Hub — Design (2026-07-18)

Supersedes the "pure hub" framing of `2026-07-18-landing-hub-fable-brief.md`. That
brief's Launchpad concept, interaction stack, and component inventory all stand;
this doc changes the page shape and fixes four gaps found in review. Read the
Fable brief alongside this one — it carries the tile-level detail; this doc is
the authority where they disagree.

## Why the shape changed

The homepage's explainer content was extracted into standalone article pages,
leaving the page with no hand-hold for someone brand new to TKA. The pure-hub
brief optimized for insiders, but insiders don't route through the homepage —
search arrivals and shared links do, and they arrive without the vocabulary.
The fix is not restoring the funnel; it's one screen of orientation above the
hub.

## Page structure (top to bottom)

1. **Hero (~one viewport, minus enough to let the hub grid peek above the
   fold).** Contents:
   - One `<h1>` line stating what TKA is (~10 words, "A notation system for
     flow arts" tier — vocabulary-correct, no marketing adjectives, per the
     ai-writing guide). No paragraphs, no feature list.
   - `SequenceHeroDemo.svelte` (`src/lib/shared/landing/components/`) playing
     a real library sequence with the **`onReroll` dice enabled** — the
     "touch it" moment: a stranger clicks the dice and watches the notation
     generate a new sequence live. `note` caption names the word via
     `simplifyRepeatedWord`.
   - A one-line pointer under the demo linking the deep-dive article pages
     ("New here? Start with [What is TKA?]") — the extracted articles are the
     hand-hold now; the hero just has to route to them.
2. **The Launchpad bento grid** — exactly as specced in the Fable brief
   (tiles, spans, routes, living assets, juice stack, SSR link layer), with
   the amendments below.
3. **Secondary strip** — trimmed (see below).

The current funnel sections (`HeroCarouselSection`, `LazyHowTkaWorksSection`,
`PlayWithItSection`, `GuidesSection`, `ShopCtaSection`) are removed from `/`.
`PlayWithItSection` already has a host on `/composer`; it lives there, not
here. Guides/Shop become tiles. Do not delete the section components — other
routes consume some of them; only unwire them from `+page.svelte`.

## Amendments to the Fable brief

### 1. Secondary strip trimmed to public routes only

Every homepage link must resolve in landing mode. Most of the brief's
secondary strip (Arena, Tika, Retro, Stage, Watch, Social, Festivals, Levels,
Hand Paths, Video, Compose, Choreo) is **not** in `PUBLIC_PATH_PREFIXES`
(`src/config/domains.ts`) — those links boot the app-shell splash for
logged-out visitors. The strip is only: FAQ `/faq`, Software Roots
`/roots/software`, Support `/support`, About `/about`, plus any primary-tile
sub-links already public. **Build-time gate:** verify every `href` on the page
against `MARKETING_EXACT` + `PUBLIC_PATH_PREFIXES` before calling it done; do
NOT add app routes to the public registry to make a tile work — cut the tile
instead.

### 2. Performance budget (desktop too, not just mobile)

- Above the fold: the hero player is the **only** animation engine instance.
- Grid tiles lazy-mount on intersection (they start below the fold, so this
  is honest lazy-loading, not a crutch).
- At most 2 concurrently animating tile players on desktop, 1 on mobile
  (hero counts). Others hold poster/first frame until hovered or scrolled
  prominent.
- Museum tile: prefer `FramedSequence.svelte` over `Environment3D`. A 3D
  scene crop drags the three.js boot weld (~4.4 MB gz risk) onto the front
  door; only use `Environment3D` if a profile shows the chunk doesn't load
  until the tile intersects AND total JS for `/` stays within ~200 KB gz of
  the current page. If in doubt, no 3D on the homepage.

### 3. Success criteria (beyond "it renders")

- `curl https://tkaflowarts.com/` (and local equivalent) returns the H1, the
  hero caption, and every destination as a distinct `<a href>` + heading
  before JS.
- Lighthouse on `/`: performance and SEO scores no worse than the current
  funnel page (capture a baseline first).
- The page answers, within one viewport and zero scroll: "what is this site"
  (H1), "show me" (live demo), "where do I go" (grid peeking).
- Post-ship signal to watch: click-through from `/` to `/create` and the
  article pages.

### 4. SEO text weight

The funnel's prose largely disappears; compensate structurally, not with
filler: keep all existing `<svelte:head>` meta + JSON-LD from the current
`+page.svelte` (WebSite w/ SearchAction, Organization), and give every tile
its short insider descriptor as real SSR text. The extracted article pages
now carry the long-form ranking content; the homepage's job is to link them
with vocabulary-correct anchor text.

## Unchanged from the Fable brief (binding)

Tile table + spans, the juice stack (`attachTiltEffect` /
`attachCursorGlowEffect` / `createSpring` from `@austencloud/backgrounds/card`,
breathing, spotlight-and-dim, elastic press, magnetic nudge on Composer tile),
semantic `<nav><ul>` grid, distinct vocabulary-correct link text, fixed-aspect
boxes on all living tiles (no-layout-shift), mobile single-column + tilt off
under `pointer:coarse`, reduced-motion and both-themes handling, 44px targets,
`BackgroundHost` backdrop, `simplifyRepeatedWord` on all displayed words,
never-hand-roll discipline, and the definition of done (verified with runtime
evidence, `npm run check` clean).

## Build notes

- This is a multi-agent-worthy build: hero, grid shell + SSR layer, tile
  content wiring, and a verification/review pass decompose cleanly. Executors
  follow `fable-routing.md` (explicit model/effort) and
  `commit-only-your-own-changes.md` (pathspec commits).
- Sketches for visual reference: `/sketches/2026-07-18-hub-launchpad.html`
  and `-v2.html` (throwaway; the real build uses real components per
  `visualization-routing.md`).
