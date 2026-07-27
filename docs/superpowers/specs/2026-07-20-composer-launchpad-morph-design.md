# Composer Launchpad + View-Transition Morph — Design

Date: 2026-07-20 (rev. 2 — incorporates external GPT-5.6 review + local verification)
Status: Design, approved-with-revisions. Ready to derive an implementation plan, then an ultra build.
Related: `2026-07-19-construct-attract-demo-design.md` (the wing sections this reuses), the composer-4k layout work, `feedback_never_hand_roll`, `research-before-building`.

---

## 1. Intent

The live `/composer` page (five-wings scrollable layout) becomes a **bento launchpad**: a grid of tiles, each a composer capability, where clicking a tile **expands it to fill the screen under the header** — a "dive into it" morph, not a jump-cut or a scroll. From the home page, clicking the Composer tile **morphs the whole page into `/composer`**.

The bar: cohesive, special, morphing app that "jumps you into content" — not the generic scrollable SaaS page. Explicit constraint: **do not over-build.** Prefer the platform + what's already installed, keep it feasible, degrade gracefully. A separate `/composer` URL is kept for SEO.

Non-goals: no new animation dependency; no 3D/WebGL flythrough (the rejected Showpiece tier); no change to what the wing sections _are_.

Ambition tier: **Signature** — bespoke depth cues (neighbors recede, staggered reveal) over a platform shared-element morph.

---

## 2. Key decisions (locked with Austen; refined by GPT-5.6 review)

1. **Drill target = the rich section we already built.** Expanding a tile full-bleeds the existing wing section (Construct ghost demo, Outputs Tunnel/Card/3D, etc.). Not a nested sub-launchpad, not the real app.
2. **Morph ceiling = Signature.** Shared-element expand + choreographed depth (neighbors recede/blur, interior clusters stagger in).
3. **Separate `/composer` URL stays.** The home→composer morph is a real SvelteKit navigation; URL changes, SEO preserved.
4. **Transition tech (revised):**
   - **Route morph (home→/composer):** native `startViewTransition()` via SvelteKit `onNavigate`.
   - **In-page dive (tile→section):** **Motion's `animateView()`** — `motion@12.42.0` is already installed and exports `animateView` + `stagger` (verified). It drives native VT underneath but adds pairing, interruption policy, exit/enter, and staggering. **No new dependency; no GSAP.**
   - Route prior art is the shared named-route driver in
     `src/lib/shared/transitions/navigation-morphs.ts`. The retired shop
     FLIP-ghost experiment is no longer a fallback.
5. **Tiles are per-section (9), not per-wing (5)**, tinted by wing color.
6. **Expanded state is hash-synced** with Back-button-aware history (§3c). Fragments are **not** a separate SEO surface, so no `/composer/[section]` routes unless a section later earns unique search intent + standalone SSR text.
7. **The base `/composer` route keeps its visible SSR capability copy.** The page now renders a `<Seo>` component plus hero and substantial capability prose (the flow-arts explanation, feature descriptions). The launchpad sits with/над that content — it does **not** replace it with decorative tiles, which would weaken a prerendered SEO page.

---

## 3. The two transitions

### 3a. Home → `/composer` (cross-page route morph)

- The root layout already runs `onNavigate` + `startViewTransition` (`src/routes/+layout.svelte:45`), gated by `navigationMorphs()` (`+layout.svelte:28-43`), today matching only `/browse`↔`/sequence`.
- **Change 1:** add a home↔`/composer` pair to `navigationMorphs()`.
- **Change 2 (correction):** the `onNavigate` block **must be edited** to add a `prefers-reduced-motion` check — it currently only feature-detects `startViewTransition`. (The earlier draft's "no edit needed" was wrong.)
- **Shared element:** the home Composer launchpad tile (`launchpad-tiles.ts:34`, the `id:"composer"` hero) and a counterpart container on `/composer` carry a static `view-transition-name: composer-launchpad`. Duplicate names abort a VT, so ensure only one element holds the name per snapshot.
- **Header holds still for free:** `MarketingChrome` + `SiteHeader` are mounted once at the root layout, outside the keyed page-swap (`MarketingChrome.svelte:109-123`; `SiteHeader.svelte:518-523`). Named elements create stacking/backdrop roots — validate header + any backdrop in the harness against the VT stacking spec.
- **Carve-out (correction — must be route-pair-aware in BOTH directions):** `MarketingChrome` runs a `{#key path}` crossfade; `/shop` opts out via `ownsViewTransition = path.startsWith("/shop")` (`MarketingChrome.svelte:71`). A path-only `startsWith("/composer")` fixes the entry but **not** Composer→home, where the _destination_ (home) re-enters the keyed fade and double-animates. Make ownership recognize the home↔composer **pair** in both directions.

### 3b. In-page tile → section expand (the dive)

Driven by **Motion `animateView()`**, not the Learn feature's `withViewTransition()` (that helper returns `void` so `transition.finished` can't be chained, and it belongs to `learn/play` — do not import it into Composer; if a shared same-doc adapter is wanted, promote one out of `learn/play/state/view-transition.ts:7`).

Choreographed sequence (from GPT-5.6):

1. **Prefetch** the target section chunk on hover, keyboard focus, and touch intent. `LazyMount` already shares one in-flight import between prefetch and mount, so warming won't double-fetch.
2. Start `animateView()`.
3. Remove the **source tile** from the named pair while mounting the target host.
4. `await tick()` before the new snapshot.
5. Pair the selected tile with the expanded surface (`view-transition-name: composer-tile-{id}`; Motion's pairing handles the name handoff so source/target never share the name within one snapshot).
6. Animate neighboring tiles as **exits** (recede/blur).
7. **Stagger 3–6 interior reveal groups during the transition.** (Correction: the "interior can't stagger during VT" claim was too broad — a container is one flat snapshot, but _named descendants_ become their own groups and animate. Capture a few meaningful clusters, not every control.)
8. Move focus **after** the transition settles.

- **Cold-import guard:** never hold the old snapshot onscreen waiting on a cold dynamic import. If prefetch hasn't finished, morph into a **deterministic section shell** (skeleton), then reveal the interactive panel when loaded.
- **Failure UX:** `LazyMount` only `console.error`s on failure (`LazyMount.svelte:62`). A load failure in the takeover needs a **visible retry + close** control — the takeover host owns this, not bare LazyMount.
- **Focus gotcha:** do **not** move focus _into_ a freshly expanded section. `ConstructSection` (and `GenerateSection`) listen for captured `focusin` to detect user takeover of the attract act (`ConstructSection.svelte:326`); focusing inside immediately parks the ghost. Focus the **host title or close button**, which live _outside_ the loaded section.
- **Collapse:** reverse via `animateView()`, same names, back to the grid; restore focus to the originating tile.

### 3c. Hash + history

- `pushState` when a user opens a tile, so **Back collapses** it.
- `popstate` listener synchronizes expanded state (Back/Forward).
- `replaceState` only for normalization (invalid/legacy hash) or state restoration.
- **Direct hash visit** (`/composer#construct`) opens the section **instantly** on load — no replayed entrance animation after hydration.

---

## 4. Content model & tiles

- **9 per-section tiles**, tinted by their five wing colors. Spans total **16 grid cells** (a clean multiple of 4 — no last-row holes) against the existing `repeat(4,1fr)` dense grid:

  | Tile      | Wing    | Span | Cells | Tile preview (light) | Expand target                                |
  | --------- | ------- | ---- | ----- | -------------------- | -------------------------------------------- |
  | Construct | Create  | 2×2  | 4     | pictograph           | `_sections/ConstructSection.svelte`          |
  | Mandala   | Outputs | 2×2  | 4     | mandala              | `_sections/MandalaSection.svelte`            |
  | 3D        | Outputs | 2×1  | 2     | pictograph           | `_components/Composer3DViewerDemo.svelte`    |
  | Generate  | Create  | 1×1  | 1     | pictograph-fade      | `_sections/GenerateSection.svelte`           |
  | Tunnel    | Outputs | 1×1  | 1     | mandala (loop)       | `_components/ComposerTunnelDemo.svelte`      |
  | Card      | Outputs | 1×1  | 1     | choreo-card          | `_components/ComposerChoreoCardsDemo.svelte` |
  | Games     | Learn   | 1×1  | 1     | alphabet-strip       | `_sections/GamesStripSection.svelte`         |
  | Connect   | Connect | 1×1  | 1     | (creators preview)   | `_sections/ConnectSection.svelte`            |
  | Library   | Library | 1×1  | 1     | dictionary           | `_sections/LibrarySection.svelte`            |

  (Tunnel dropped to 1×1 per GPT-5.6 to make 16 cells; its loop preview tolerates a square. Spans still tuned by eye in the test page.)

- **Tile preview** = the small decorative slot (`pointer-events:none; aria-hidden`) with a lightweight living media.
- **Expand target ≠ a bare loader.** Each tile carries a **target manifest**, not just `expandLoader`:
  - `loader: () => import(...)` (client-only, §8),
  - `props` + a readiness signal (Tunnel and 3D need `demoSeq` at runtime; the host must supply/await it),
  - a `loadingShell` (the deterministic skeleton for the cold-import guard),
  - an `error` contract (retry/close).

---

## 5. Transition technology decision

**Route morph:** native View Transitions (same-document, cross-browser Baseline since 2025-10-14: Chrome/Edge 111+, Safari 18+, Firefox 144+) via SvelteKit `onNavigate`. The nav is a normal client navigation, so the URL changes and routes stay SSR/prerendered — SEO met without cross-document VT (which has no Firefox and forces reloads).

**In-page dive:** **Motion `animateView()`** (already installed). It uses native VT underneath but adds the pairing / interruption / exit-enter / stagger the raw API lacks — the reason we don't hand-roll `startViewTransition` for the dive.

Comparison (full sources §10):

| Technique                             | Morph geometry                        | Cross-nav morph  | Dep                   | Verdict                                                 |
| ------------------------------------- | ------------------------------------- | ---------------- | --------------------- | ------------------------------------------------------- |
| **Native VT via onNavigate**          | native                                | yes (client nav) | none                  | **route morph**                                         |
| **Motion `animateView()`**            | native VT + pairing/stagger/interrupt | yes              | **already installed** | **in-page dive**                                        |
| Native VT raw (`startViewTransition`) | native                                | yes              | none                  | too low-level for the dive (no interrupt/stagger API)   |
| FLIP + persistent coordinator/overlay | manual                                | **yes**          | none/Motion           | retired shop experiment; no live in-repo implementation |
| GSAP Flip                             | excellent                             | yes w/ overlay   | non-MIT JS            | rejected: adds a dependency for no gain here            |
| Svelte `crossfade`/deferred           | remount cross-fade                    | yes              | none                  | not used; known multi-item bugs (#10252, #13802)        |

Correction vs rev.1: "FLIP cannot cross a navigation" was **inaccurate**. A
persistent coordinator or ghost overlay can own both endpoints. The shop
experiment proved the pattern, but the live app now uses named native route
morphs.

**Fallback chain:** full support → full morph; no `startViewTransition` → instant swap/nav; `prefers-reduced-motion` → skip the transition entirely + reduced-motion CSS on the new names.

---

## 6. Components & decoupling (additive; homepage untouched)

1. **`LaunchpadGrid` — fuller decoupling** (prop-ifying `tiles`/`stripLinks` alone is insufficient; it also bakes in homepage nav labeling, layout assumptions, and anchor-only interaction — `LaunchpadGrid.svelte:49`). Add: `tiles` prop, configurable **accessible label**, **optional** strip, an **activation contract** (how a tile activates — see #3), and a **layout variant** so composer composition isn't locked to the homepage grid.
2. **`LaunchpadTile` — action/button mode** (`LaunchpadTile.svelte:41`). Tiles are always `<a>` today, but opening a takeover is an _action_, not navigation. Add a button/action mode (fires the expand) while retaining the homepage anchor behavior. (Keep a11y: buttons for actions, anchors for the home nav; visible focus; 44px targets.)
3. **Generic tile media** — replace the closed `media` union + if/else ladder (`LaunchpadTile.svelte:44-110`) with an optional `mediaLoader`/`mediaProps` path (the shape `LazyMount` already wants), keeping existing branches so the homepage needs no migration.
4. **`composer-launchpad-tiles.ts`** — the 9 composer tile defs with the **target manifest** (§4), spans, wing colors, preview media.
5. **`/composer` page** — render the (variant) launchpad grid + a **takeover host** that, for the current `expandedId`, lazy-loads the target manifest into a full-bleed surface carrying `composer-tile-{id}`, with loading shell, error/retry/close, Escape, focus restoration, `inert`/scroll-lock on the backdrop, and reduced-motion. **Keep the SSR capability copy** on the base route (§7).
6. **`+layout.svelte`** — add the composer pair to `navigationMorphs()`; add the reduced-motion check to `onNavigate`; make `ownsViewTransition` route-pair-aware (§3a).
7. **View-transition CSS** — reduced-motion rules for `composer-launchpad` and `composer-tile-{id}` (the global reduced-motion block only covers root/module/community/portal/drawer names; no catch-all).

Existing VT-name conventions followed: `sequence-{id}` (`ChoreoCardThumbnail.svelte:316` ↔ `SequenceViewerPage.svelte:557`), `composition-{id}`; root transition disabled (`view-transitions.css:26-29`), so only named elements morph.

---

## 7. Accessibility

- **Reduced motion:** the launchpad tiles already freeze breathing/tilt/press/magnetic/glow (`LaunchpadTile.svelte:508-534`, `LaunchpadGrid.svelte:160-166`). Add: skip the route/dive transitions under `reduce` (both the JS call and CSS for the new names). Motion honors reduced-motion, but validate.
- **Takeover host:** Escape to collapse; a visible **close button** (a button, not a bare link, per `clickables-look-like-buttons`); `inert` + scroll-lock on the backdrop while open; focus moves to the **host title/close** (outside the section — §3b focus gotcha), and returns to the originating tile on collapse.
- **Load failure:** visible retry + close in the host (LazyMount only logs).
- **Tiles:** action-mode tiles are real buttons with focus rings and 44px targets; the home Composer tile stays an anchor.

---

## 8. SSR / prerender + content discipline (non-negotiable)

- `src/routes/(public)/composer/+page.ts` sets `prerender = true`, no `ssr = false`. The wing sections pull the heavy pictograph graph (special-arrow-placement → **zod**); a static top-level import breaks the prerender. The current page already dodges this with client-only dynamic `import()` gated by IntersectionObserver.
- **Every tile target manifest loader is `() => import("./_sections/...")` invoked only through `LazyMount` / an `active`-gated mount** — never a static top-level import. Preview media follows the same rule.
- **Keep the visible SSR copy.** The base route renders a `<Seo>` component + hero + capability prose today. The launchpad is added _around_ that content; the prerendered page must still ship meaningful text (the flow-arts explanation, capability descriptions) or it regresses as an SEO surface even while staying prerendered.

---

## 9. Risks & mitigations

| Risk                                                                                    | Mitigation                                                                                                       |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Two engines (Svelte `{#key}` crossfade + VT) fight → flicker                            | Route-pair-aware `ownsViewTransition` carve-out (both directions), per the `/shop` precedent.                    |
| VT non-interruptible on rapid route re-triggers                                         | Motion `animateView` interruption policy for the in-page dive; the route morph uses the shared native lifecycle. |
| Prerender + zod trap on the expand target                                               | `LazyMount` client-only dynamic import.                                                                          |
| Reduced-motion not auto-honored                                                         | Skip transition + reduced-motion CSS on the new names + validate Motion.                                         |
| Duplicate `view-transition-name` aborts VT; named elements make stacking/backdrop roots | Per-id names, Motion pairing hands off; validate header/backdrop in harness.                                     |
| Cold import stalls the morph                                                            | Deterministic loading shell; prefetch on hover/focus/touch.                                                      |
| Load failure invisible (LazyMount logs only)                                            | Retry/close UI in the takeover host.                                                                             |
| Focusing into Construct/Generate parks the attract act                                  | Focus host title/close (outside the section).                                                                    |
| Launchpad gutting SSR text                                                              | Keep hero + capability prose on the base route.                                                                  |
| Rapid tile clicks / mobile drawer conflict                                              | Debounce; reuse the `view-transition-name: none !important` mobile suppression pattern if needed.                |

---

## 10. Sources

- Same-document VT Baseline / Firefox 144: web.dev `same-document-view-transitions-are-now-baseline-newly-available`; MDN `Document/startViewTransition`; caniuse `view-transitions`.
- Motion `animateView` (moved into main package 2026-07-01; pairing/interruption/stagger over native VT): motion.dev `docs/animate-view`, motion.dev `changelog`. Local: `motion@12.42.0`, `animateView`+`stagger` exported (verified).
- W3C CSS View Transitions 1 (naming/stacking): w3.org `TR/css-view-transitions-1`.
- Cross-document VT (Chrome+Safari, no Firefox): css-tricks `cross-document-view-transitions-part-1`; MDN `@view-transition`.
- SvelteKit `onNavigate` + VT: svelte.dev `blog/view-transitions`; kit PR #9605; geoffrich.net page-transitions.
- Google fragments/URL structure (hash not a distinct SEO surface): developers.google.com `search/docs/crawling-indexing/url-structure`.
- Svelte crossfade bugs: svelte #10252, #13802. GSAP Flip free/license: webflow.com `blog/gsap-becomes-free`.
- Reduced motion: MDN `@media/prefers-reduced-motion`.
- In-repo prior art: `navigation-morphs.ts`,
  `named-route-morph-state.svelte.ts`, `view-transitions.css`, and
  `LazyMount.svelte`.

Accuracy caveat: exact minor-version cut-ins (Safari 18.0 vs 18.2, Firefox 143-flag→144-ship) are corroborated across secondary sources, not each re-confirmed against vendor changelogs; the load-bearing cross-browser-Baseline claim is well-corroborated.

---

## 11. Revised approval record (post GPT-5.6)

- Nine section tiles, 16 grid cells (Tunnel → 1×1).
- Native SvelteKit VT for the route morph.
- Existing Motion `animateView()` for the in-page Signature choreography. No GSAP, no new dependency.
- Hash sharing with Back-button-aware history (pushState/popstate).
- Client-only cached target loaders with explicit props, loading shell, and failure contracts.
- Visible SSR capability copy retained on the base route.
- A route-local takeover host with close, Escape, focus restoration, `inert`/scroll behavior, reduced-motion.
- `onNavigate` gains a reduced-motion check; `ownsViewTransition` becomes route-pair-aware; `LaunchpadGrid`/`LaunchpadTile` gain the label/strip/activation/layout + action-mode decoupling.

---

## 12. Phasing (for the plan)

1. Decouple `LaunchpadGrid` (variant + activation contract) + `LaunchpadTile` (action mode) + generic media — additive, homepage regression-tested.
2. `composer-launchpad-tiles.ts` + target manifests; a `/composer` **test harness** rendering the grid (tune composition by eye).
3. In-page dive via Motion `animateView`: prefetch, deterministic shell, 3–6 reveal clusters, hash/history, reduced-motion, focus, failure UI.
4. Home→composer route morph: `navigationMorphs()` pair, shared name, reduced-motion in `onNavigate`, route-pair-aware carve-out.
5. Polish: neighbor-recede choreography, mobile suppression, debounce, backdrop `inert`/scroll-lock.
6. Swap the scrollable `/composer` for the launchpad — **retaining the SSR hero + capability copy**.

Implementation runs under ultra (multi-agent) once this design and the derived plan are approved. Browser choreography is validated in the visual harness, not asserted from the spec.

---

## 13. Rev 3 pivot (2026-07-20) — the morph lives on the landing bento

Austen's refinement after eyeballing the `/test/composer-launchpad` bento: **KEEP the current landing (`/`) layout** (hero animation left, bento boxes right) **AND the `/composer` wings layout** — replace neither. The "launchpad morph" lives on the EXISTING landing bento tiles: clicking a tile **dives** (expands to fill under the header) into its destination PAGE via the shared-element route morph.

Net effect on this spec:

- **§3a (route morph) is now the CORE**, generalized from the Composer tile to all landing launchpad tiles (Composer→`/composer` first, then Notation / Guide / Choreo-Cards / Glossary / FAQ). Each destination gets a matching named element at its top so the tile morphs into it; the other tiles recede as VT exits (automatic "neighbors recede").
- **DESCOPED: §3b (in-page tile→section dive) and §4/§6 (making `/composer` itself a bento).** `/composer` stays the wings layout. The `/test/composer-launchpad` harness + `composer-launchpad-tiles.ts` stay PARKED as a decoupling proof, not shipped.
- The "expand to fill under the header / dive" feel is delivered BY the route
  morph. Since this is now a cross-route morph, it uses **native VT via
  `onNavigate`**. Motion `animateView` remains scoped to the in-page dive.
- Workflow-1 decoupling (LaunchpadGrid props, action mode, generic mediaLoader) is committed + additive; the **action/button mode is now unused by the shipped path** (it was for the in-page dive) but harmless — landing tiles stay anchors (real nav), which is exactly what the route morph needs.
