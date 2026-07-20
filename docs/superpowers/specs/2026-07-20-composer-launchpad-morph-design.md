# Composer Launchpad + View-Transition Morph — Design

Date: 2026-07-20
Status: Design (pre-implementation). Intended for external review (GPT-5.6) before an ultra build.
Related: `2026-07-19-construct-attract-demo-design.md` (the wing sections this reuses), the composer-4k layout work, `feedback_never_hand_roll`, `research-before-building`.

---

## 1. Intent

The live `/composer` page (just migrated to a five-wings scrollable layout) should become a **bento launchpad**: a grid of tiles, each a composer capability, where clicking a tile makes it **expand to fill the screen under the header** — a "dive into it" morph rather than a jump-cut or a scroll. From the home page, clicking the Composer tile should **morph the whole page into `/composer`**, not hard-swap.

The bar Austen set: it should feel like a cohesive, special, morphing app — "jumps you into content" — not the generic scrollable SaaS page seen a million times. Explicit constraint: **do not over-build.** Prefer the platform, keep it feasible, degrade gracefully. A separate `/composer` URL is kept for SEO.

Non-goals: no new animation library unless the platform genuinely can't do it; no 3D/WebGL "flythrough" (that was the rejected Showpiece tier); no change to what the wing sections *are* (they were just built and approved).

Ambition tier (chosen): **Signature** — bespoke depth cues (neighbors recede, staggered reveal) on top of a platform shared-element morph.

---

## 2. Key decisions (locked with Austen)

1. **Drill target = the rich section we already built.** Expanding a tile full-bleeds the existing wing section (Construct ghost demo, Outputs Tunnel/Card/3D, etc.), not a nested sub-launchpad and not the real app.
2. **Morph ceiling = Signature.** Shared-element expand + choreographed depth (neighbors recede/blur, content staggers in). Not a bare crossfade, not a 3D flythrough.
3. **Separate `/composer` URL stays.** The home→composer morph is a real SvelteKit navigation, so the URL changes and SEO is preserved.
4. **Transition tech = native View Transitions API, no library** (see §5).
5. **Tiles are per-section (9), not per-wing (5)**, tinted by wing color, stars sized 2×2.
6. **Expanded state is hash-synced** (`/composer#construct`) for shareability, without minting new routes.

---

## 3. The two transitions

### 3a. Home → `/composer` (cross-page route morph)

- The root layout **already runs `onNavigate` + `startViewTransition`** (`src/routes/+layout.svelte:45-56`), gated by a `navigationMorphs()` allowlist (`+layout.svelte:28-43`) that today only matches `/browse`↔`/sequence`.
- **Change:** add a home↔`/composer` pair to `navigationMorphs()`. No edit to the `onNavigate` block itself.
- **Shared element:** the home Composer launchpad tile (`src/lib/shared/landing/components/launchpad/launchpad-tiles.ts:34-44`, the 2×2 `id:"composer"` hero) and a counterpart container on `/composer` both carry a static `view-transition-name: composer-launchpad`. One specific pair, so one static name is correct (unlike the per-id `sequence-{id}` cases).
- **Header holds still for free:** `MarketingChrome` + `SiteHeader` are mounted once at the root layout and are *outside* the keyed page-swap, so they never unmount across `/`→`/composer` (`MarketingChrome.svelte:109-123`; `SiteHeader.svelte:518-523`, `position:fixed`). No work needed to keep the header fixed.
- **Carve-out (critical):** `MarketingChrome` runs a Svelte `{#key path}` crossfade on `.mkt-content`. `/shop` already opts out via `ownsViewTransition = path.startsWith("/shop")` (`MarketingChrome.svelte:65-71`) so the two engines don't double-animate and flicker. **`/composer` must join that carve-out** for the home↔composer pair.

### 3b. In-page tile → section expand (the dive)

- Same-document state change, so it uses the existing `withViewTransition()` helper (`src/lib/features/learn/play/state/view-transition.ts:7-19`), **not** `onNavigate` (its own doc comment says onNavigate doesn't apply to component-state changes).
- Click handler: `withViewTransition(() => { expandedId = tile.id })`.
- **Shared element:** the tile and its expanded full-bleed container both carry `view-transition-name: composer-tile-{id}` (per-id, matching the `sequence-{id}` / `composition-{id}` precedent).
- **Neighbors recede:** a class toggled inside the same mutation callback fades/scales the other tiles (they can also get their own named groups if we want them to animate individually via `::view-transition-group`).
- **Staggered dive-in:** the View Transitions snapshot is a flat image, so interior children **cannot** stagger *during* the transition. The stagger runs as a **follow-on** chained on `transition.finished` (CSS keyframes with incremental `animation-delay`, or Svelte `in:` transitions on the section's children). Dependency-free.
- **Collapse:** reverse — `withViewTransition(() => { expandedId = null })`, same names, back to the grid.
- **Shareability:** mirror `expandedId` into the URL hash (`replaceState`), so `/composer#construct` deep-opens that section. No new routes, no extra prerender surface.

---

## 4. Content model & tiles

- The bento is **9 per-section tiles**, tinted by their five wing colors, with **Mandala** and **Construct** as 2×2 stars; the rest 2×1 / 1×1 to fill a `repeat(4,1fr)` dense grid (cell count kept a multiple of 4 to avoid last-row holes, per the existing grid's own rule).
- **Tile media (small, decorative):** the existing homepage tile slot is `pointer-events:none; aria-hidden` and shows a lightweight living preview (`mandala`, `pictograph`, `choreo-card`, ...). Composer tiles reuse that for a cheap preview.
- **Expand target (heavy, interactive):** the full wing section (`src/routes/(public)/composer/_sections/*` + the `_components/*` demos). These are real interactive panels (toolbars, pickers, players) — they do **not** belong inside the small tile slot, but are exactly right as the expanded full-bleed content.
- Mapping table (tile → preview media → expand target):

  | Tile | Wing | Span | Tile preview | Expand target |
  |---|---|---|---|---|
  | Construct | Create | 2×2 | pictograph | `_sections/ConstructSection.svelte` |
  | Generate | Create | 1×1 | pictograph-fade | `_sections/GenerateSection.svelte` |
  | Mandala | Outputs | 2×2 | mandala | `_sections/MandalaSection.svelte` |
  | Tunnel | Outputs | 2×1 | mandala (loop) | `_components/ComposerTunnelDemo.svelte` |
  | Card | Outputs | 1×1 | choreo-card | `_components/ComposerChoreoCardsDemo.svelte` |
  | 3D | Outputs | 2×1 | pictograph | `_components/Composer3DViewerDemo.svelte` |
  | Games | Learn | 1×1 | alphabet-strip | `_sections/GamesStripSection.svelte` |
  | Connect | Connect | 1×1 | (creators preview) | `_sections/ConnectSection.svelte` |
  | Library | Library | 1×1 | dictionary | `_sections/LibrarySection.svelte` |

  (Spans are a starting composition, tuned by eye in a test page before ship.)

---

## 5. Transition technology decision

**Chosen: the native View Transitions API (same-document), no library.** Same-document VT reached cross-browser Baseline on 2025-10-14 (Chrome/Edge 111+, Safari 18+, Firefox 144+). One primitive covers both moves: `startViewTransition` for the in-page expand, and the same call wrapped in SvelteKit `onNavigate` for the route morph. Because the route morph is a normal SvelteKit client navigation, the URL changes and the routes stay SSR/prerendered — the SEO requirement is met **without** cross-document VT (which has no Firefox support and would force full reloads).

Condensed comparison (full table + sources in §10):

| Technique | Morph geometry | Cross-page morph | Dep | Verdict |
|---|---|---|---|---|
| **View Transitions (same-doc + onNavigate)** | native | yes (client nav) | none | **chosen** |
| View Transitions (cross-doc/MPA) | native | yes (full reload) | none | rejected: no Firefox, forces reload |
| FLIP hand-rolled | manual | no | none | reinvents native VT; no cross-page |
| GSAP Flip | excellent | no | non-MIT JS | escape hatch only; can't cross nav |
| Svelte `crossfade`/deferred | remount cross-fade | yes (client) | none | fallback flavor; known multi-item bugs (#10252, #13802) |

**Fallback chain (built-in graceful degradation):**
1. Full support → full morph.
2. No `startViewTransition` (old browsers) → feature-detect; the callback still runs → instant state swap / navigation, no morph.
3. `prefers-reduced-motion: reduce` → skip `startViewTransition` entirely (instant), and guard `::view-transition*` + the follow-on stagger behind the reduced-motion media query.

**Library verdict: not warranted.** GSAP Flip is free now but adds a non-MIT dependency and, like hand-rolled FLIP, **cannot morph across a real navigation** — the exact thing the home→composer move needs. Keep GSAP Flip documented as an escape hatch only if the interior dive-in later needs frame-perfect single-timeline orchestration.

---

## 6. Components & decoupling (all additive; homepage untouched)

1. **Prop-ify `LaunchpadGrid`** — it currently hardcodes `import { LAUNCHPAD_TILES, STRIP_LINKS }` (`LaunchpadGrid.svelte:17`). Add optional `tiles` / `stripLinks` props defaulting to those constants. Homepage behavior unchanged.
2. **Generalize tile media** — today `LaunchpadTile.svelte:44-110` is a closed `media` union matched by an if/else ladder, each branch hardcoding a `LazyMount` loader. Add a generic path: `mediaLoader?: () => Promise<{default: Component}>` + `mediaProps?` on `LaunchpadTileDef`, rendered by one `<LazyMount loader={tile.mediaLoader} {active} props={tile.mediaProps} />`. Keep the existing union branches so the homepage needs no migration.
3. **`composer-launchpad-tiles.ts`** — the 9 composer tile defs (spans, wing colors, preview media, and an `expandLoader` per §4).
4. **`/composer` page** — render the (prop-fed) launchpad grid + an **expand host** that, for the current `expandedId`, lazy-loads the section via `LazyMount` (client-only dynamic import; see §8) into a full-bleed container carrying `view-transition-name: composer-tile-{id}`.
5. **`+layout.svelte`** — add the composer pair to `navigationMorphs()`; add `/composer` to the `ownsViewTransition` carve-out.
6. **View-transition CSS** — add a reduced-motion rule for the new `composer-launchpad` / `composer-tile-{id}` names (the global reduced-motion block in `view-transitions.css` only covers root/module/community/portal/drawer names; there is no catch-all).

Existing VT-name conventions this follows: `sequence-{id}` (`ChoreoCardThumbnail.svelte:316` ↔ `SequenceViewerPage.svelte:557`), `composition-{id}`. Root transition is deliberately disabled (`view-transitions.css:26-29`) so only named elements morph — good, our names opt in explicitly.

---

## 7. Accessibility

- `withViewTransition()` already skips under `prefers-reduced-motion` and feature-detects (`view-transition.ts:8-14`). The route-level `onNavigate` block already feature-detects `document.startViewTransition`.
- **Must add:** a reduced-motion CSS rule for the new names, and ensure the follow-on stagger is gated (no motion when `reduce`).
- The launchpad tiles already freeze breathing/tilt/press/magnetic/glow under reduced motion (`LaunchpadTile.svelte:508-534`, `LaunchpadGrid.svelte:160-166`). Composer tiles inherit this.
- Focus management: on expand, move focus into the section; on collapse, return focus to the originating tile. The expanded view needs an Escape-to-collapse and a visible close control (buttons, not bare links, per `clickables-look-like-buttons`).

---

## 8. SSR / prerender discipline (non-negotiable)

`src/routes/(public)/composer/+page.ts` sets `prerender = true` with no `ssr = false`. The wing sections pull the heavy pictograph graph (special-arrow-placement → **zod**), so a static top-level import of any `_sections/*` file drags zod's schema code through the prerender's Node module runner and breaks the build. The current page already avoids this with client-only dynamic `import()` gated by an IntersectionObserver (`+page.svelte:17-24, 37-53`).

**The new launchpad must keep this discipline:** every tile's `expandLoader` is a `() => import("./_sections/...")` invoked only through `LazyMount` / an `active`-gated mount, never a static top-level import. The tile *preview* media follows the same rule (it already does on the homepage).

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Two animation engines (Svelte `{#key}` crossfade + VT) fight → flicker | Join the `/shop` `ownsViewTransition` carve-out for `/composer`. Proven precedent. |
| Interior can't stagger during the VT (flat snapshot) | Chain the stagger on `transition.finished`. |
| Prerender + zod trap on the expand target | Load via `LazyMount` client-only dynamic import (existing pattern). |
| Reduced-motion not auto-honored by VT | Skip `startViewTransition` + add reduced-motion CSS for the new names. |
| Duplicate `view-transition-name` on screen aborts the transition | Per-id names; only the expanding tile + its target share a name at once. |
| Rapid tile clicks interrupt an in-flight VT | Debounce / ignore clicks while a transition is running. |
| Sticky/fixed header clipped by the expanding group | Header keeps its own name/stacking; validate against the known sticky-element gotcha. |
| Mobile: morph fights a drawer/slide | Reuse the existing mobile `view-transition-name: none !important` suppression pattern if needed. |

---

## 10. Approaches considered & sources

Primary recommendation and full technique comparison come from a 2026 research pass. Load-bearing claim: **native same-document View Transitions are cross-browser Baseline as of 2025-10-14; cross-document VT is Chrome+Safari only (no Firefox).**

- Same-document VT Baseline / Firefox 144: web.dev `same-document-view-transitions-are-now-baseline-newly-available`; MDN `Document/startViewTransition`; caniuse `view-transitions`.
- Cross-document VT support: css-tricks `cross-document-view-transitions-part-1`; MDN `@view-transition`.
- SvelteKit `onNavigate` + VT: svelte.dev `blog/view-transitions`; kit PR #9605; geoffrich.net page-transitions series.
- Svelte crossfade bugs: svelte issues #10252, #13802.
- GSAP Flip free/license: webflow.com `blog/gsap-becomes-free`; gsap.com Flip docs.
- Reduced motion: MDN `@media/prefers-reduced-motion`.
- Chrome VT model / nested groups / stacking gotchas: developer.chrome.com view-transitions docs; purplesquirrels + nicchan.me on sticky elements & stacking context.

Accuracy caveat for reviewers: exact minor-version cut-ins (Safari 18.0 vs 18.2, Firefox 143-flag → 144-ship) are corroborated across secondary sources but not each re-confirmed against primary vendor changelogs; the load-bearing cross-browser-Baseline claim is well-corroborated.

---

## 11. Phasing (for the later plan, not this doc)

1. Decouple `LaunchpadGrid` (tiles prop) + generic `mediaLoader` — additive, homepage regression-tested.
2. `composer-launchpad-tiles.ts` + a `/composer` test harness rendering the grid (iterate composition by eye).
3. In-page tile→section expand via `withViewTransition` + hash sync + reduced-motion + focus management.
4. Home→composer route morph: `navigationMorphs()` pair + shared name + `ownsViewTransition` carve-out.
5. Polish: neighbor-recede choreography, staggered dive-in, mobile suppression, debounce.
6. Swap the scrollable `/composer` for the launchpad; keep SEO head + hero framing.

Implementation is expected to run under ultra (multi-agent) once this design and the derived plan are approved.

---

## 12. Open questions for the reviewer (GPT-5.6)

1. Is native same-document VT the right call for the Signature tier, or does the "neighbors recede + staggered dive-in" choreography justify GSAP Flip / a hybrid for the in-page expand specifically? (Note the cross-page move still needs VT regardless.)
2. Any prettier or more-proven pattern for the tile→fullscreen "dive" than shared-element VT + follow-on stagger — e.g. a container-transform recipe others have shipped?
3. Is hash-synced in-page expand the right shareability model, or is a real `/composer/[section]` sub-route worth the extra prerender/zod surface for per-section SEO?
4. Feasibility red flags in the VT-name/stacking/prerender plan above?
5. Is 9 per-section tiles the right granularity, or does grouping into 5 wing tiles with an intermediate step read better?
