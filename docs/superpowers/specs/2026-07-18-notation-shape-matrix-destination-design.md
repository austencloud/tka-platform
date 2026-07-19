# Interactive Shape Matrix Destination — Design Spec

> Status: Design approved (2026-07-18). Staged for Fable 5 to plan and execute.
> Owner handoff: Fable orchestrates the sandwich; Sonnet executors implement per phase.

## Problem

The public `/notation` page tells the lineage story of TKA notation. Its Shape
Matrix section renders two static WebP images side by side: Lorq Nichols' 2012
144 Shape Matrix and TKA's own baked 144 matrix. Both are dead rasters. No
interaction, no payoff.

Discovery (2026-07-18, 5-prong parallel audit) established that the full
interactive experience already exists as working code, walled inside the lab
test route `src/routes/test/shape-matrix/+page.svelte`. Clicking a cell already
resolves the six timing-and-direction realizations that draw that mandala, each
carrying a real playable `SequenceData`. The prop-drawing-with-fading-trail
player already ships on this same page lower down. Nothing new needs inventing.
The work is relocation, wiring, and one product decision about where it lives.

## The Decision

The interactive Shape Matrix becomes its own destination at
`/notation/shape-matrix`. The `/notation` page keeps the lineage narrative and a
bounded live teaser that hands off to the destination.

Rationale:

- The matrix is a tool people operate, not prose they read. Depth of this kind
  wants a focused page, a shareable URL, and room to breathe.
- "Shape matrix" is a searched, named artifact. A dedicated page can rank for it
  and become the definitive interactive shape matrix on the web. This is a
  pillar page, consistent with the SEO overhaul.
- Its own route makes a specific cell or variation deep-linkable.
- The information architecture precedent exists: `/roots/software` is a
  separately linked public page while `/roots` redirects to `/notation`. A
  nested `/notation/shape-matrix` matches that shape.
- A destination justifies the level of detail instead of cramming it into a
  reading page.

Route: nested `/notation/shape-matrix`. Breadcrumb back to `/notation`.

## Domain Grounding

The "six ways of timing and direction" are the six VTG timing/direction
categories, confirmed via the Flow Arts Knowledge MCP (`list_vtg_categories`,
2026-07-18):

| Timing | Same | Opposite |
|---|---|---|
| Split | SS | SO |
| Together | TS | TO |
| Quarter | QS | QO |

SS/TS/SO/TO are core VTG V1. QS/QO are the community quarter extension. One
mandala overlay maps to up to six timing-and-direction realizations. This is
exactly the set the existing drill produces (`MODE_ORDER` in
`shape-matrix-realizations.ts`).

Terminology guard: the rotation slice of a ratio band is expressed as a ratio
(1:1, 1:3, 1:5), never as "half turns" or "quarter turns." "Turn" is reserved
for prop turns and body turns.

## User Experience

### The arc on `/notation`

1. The work existed and it mattered. Lorq Nichols' 2012 Shape Matrix, shown as a
   small inline reference figure, credited by name.
2. Here is what TKA did with it. A bounded live teaser: the smallest matrix size
   (the 1:1 band), rendered live with real clickable tiles.
3. The invitation. "Explore the full shape matrix" leads to the destination.

### The destination at `/notation/shape-matrix`

1. The live matrix, full width, every tile clickable.
2. A size control (Small / Medium / Large) that sets how much of the matrix
   renders. Curious visitors expand. Casual visitors stay small.
3. Click a tile. The six timing-and-direction realizations that draw that
   mandala open in a panel (desktop) or a bottom sheet (mobile).
4. Pick one of the six. The panel crossfades to a hero animation: the prop(s)
   drawing that exact mandala live, with a fading trail. A back control returns
   to the six.

### The size control

The three sizes are the cumulative ratio bands, which is domain-meaningful
rather than arbitrary zoom:

- Small: 1:1 only. Blue axis 4 flowers by red axis 4 flowers, 16 tiles.
- Medium: 1:1 and 1:3. 8 by 8, 64 tiles.
- Large: 1:1, 1:3, 1:5. 12 by 12, 144 tiles.

This is a preset over the existing axis filter. `ShapeMatrixFilters` already
exposes turn-ratio toggles and `applyFilter` already narrows the axis. The size
control is a thin wrapper that sets the ratio-band subset on both axes at once.
Default: Large on desktop, Medium on mobile. The `/notation` teaser is Small, so
the escalation reads Small teaser, Medium on the mobile destination, Large on the
desktop destination.

## Architecture

### Engine extraction (the one real structural decision)

The grid, drill, realization services, and flower domain currently live in
`src/lib/features/lab/vtg-lab/`, an internal, disposable feature. A public
marketing route importing lab internals is a smell.

Extract the engine into a shared feature module (proposed
`src/lib/features/shape-matrix/`) consumed by both the public destination, the
`/notation` teaser, and the lab dev harness. Register it via the `new-module`
skill and `module-definitions.ts`; the executor confirms shared-vs-feature
placement against module conventions before moving files. The lab route keeps
its filter and diagnostic harness and imports the engine from its new home.

A contract test asserts the module boundary: the public route imports only the
module's public surface, not deep lab paths.

### Reuse map

Grounded in the 2026-07-18 discovery audit. Executors verify exact signatures at
each source file before wiring.

| Need | Reuse | Path |
|---|---|---|
| Interactive grid | `ShapeMatrixGrid` (emits `onselect({blue,red})`) | `src/lib/features/lab/vtg-lab/components/ShapeMatrixGrid.svelte` |
| Six realizations | `buildModeCards(pair, overlay)` returns `ModeCard[]` incl. `seq` | `src/lib/features/lab/vtg-lab/services/build-realization-cards.ts` |
| VTG mode set | `MODE_ORDER`, `MODE_LABEL` | `src/lib/features/lab/vtg-lab/services/shape-matrix-realizations.ts` |
| Parity-corrected sequence | `verifyAndCorrect()` (`ParityResult.sequence`) | `src/lib/features/lab/vtg-lab/services/verify-realization-parity.ts` |
| Axis + geometry | `loadShapeMatrix()`, `applyFilter`, `defaultMatrixFilters` | `shape-matrix-flowers.ts`, `filter-flower-axis.ts` |
| Flower domain | `Flower`, `flowerKey`, `buildFlowerAxis` | `src/lib/features/lab/vtg-lab/domain/flower-signature.ts` |
| Cell thumbnails | `renderCell` / `renderHeader` | `src/lib/features/lab/vtg-lab/services/shape-matrix-render.ts` |
| Hero animation | `InlineAnimationPlayer` (chrome minimal, trails on by default) | `src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte` |
| Live-hero precedent on this page | `SequenceHeroDemo` | `src/lib/shared/landing/components/SequenceHeroDemo.svelte` |
| Responsive shell | `Drawer` + `DrawerHeader`, `placement={isMobile ? 'bottom' : 'right'}` | `src/lib/shared/foundation/ui/Drawer.svelte`, reference impl `GalleryFilterSheet.svelte` |
| Single-select control | `SegmentedControl` | `src/lib/shared/3d/components/controls/SegmentedControl.svelte` |
| Picker to hero transition | `Crossfade` (`fill` mode inside the sized stage) | `src/lib/shared/components/Crossfade.svelte` |
| Breakpoint constant | `BREAKPOINTS.MOBILE` | `src/lib/shared/device/domain/constants/device-constants.ts` |

### New code (small, enumerated)

1. Expose `ModeCard.seq` through the drill's public surface. The builder already
   computes it; today it is only baked to a PNG.
2. An onclick per mode-thumbnail that sets the chosen mode and crossfades to the
   hero player fed with `card.seq`.
3. The Small/Medium/Large preset that maps to ratio-band axis filters over the
   existing `applyFilter`.
4. The destination route `/notation/shape-matrix` host: layout, lineage credit,
   axis labels, size control, drill shell.
5. The `/notation` teaser: demote Lorq to a reference figure, render the bounded
   live Small matrix, add the "Explore the full shape matrix" call to action.
6. Route-local `isMobile` state via `BREAKPOINTS.MOBILE` plus a resize listener.
   The `/notation` route has no device plumbing today.

### Rejected

- `MandalaOverlayCanvas` stroke-by-stroke renderer. It is dead code with no prop
  layer. The requirement is the prop drawing the mandala, and the trail player
  renders the prop. The trail player is both closer to the intent and less work.
- Six simultaneous animation players in the drill. One hero player is smooth;
  the six are thumbnails until picked.
- Reverse `mandala-decoder`. The flower grid resolves the six realizations by
  forward construction and geometric parity, no catalog scan needed.

## Responsive

- Desktop: destination shows the full matrix, size default Large. Drill opens as
  a right-side panel via `Drawer` with `placement="right"`.
- Mobile: size default Medium. Drill opens as a bottom sheet via the
  same `Drawer` with `placement="bottom"`. Follow the `GalleryFilterSheet`
  idiom (inline placement ternary plus `--drawer-width`), because the same
  `isMobile` boolean also drives grid density.
- The hero player reserves its aspect-ratio box so mounting never shifts layout.
- Reduced motion is owned by `Crossfade` and the animation engine. Consumers do
  not re-implement it.

## Information Architecture

- New route: `src/routes/(public)/notation/shape-matrix/+page.svelte`.
- Breadcrumb back to `/notation`.
- Add to sitemap.
- Update the `/notation` source-contract tests. The 144-cell matrix assertion
  moves to the destination. The teaser asserts the bounded preview plus the call
  to action.

## Phasing and Requirement Ledger

Fable execution scoping. Each phase is a dispatch unit with its own verification.
The ledger survives compaction; conversation context does not. Mark `- [x]` done,
`- [~] deferred` with reason.

### Phase 0 — Engine extraction (foundation)

- [x] Confirm shared-vs-feature placement against `module-definitions.ts` and the
      `new-module` skill; register the `shape-matrix` module. — Placed at
      `src/lib/shared/shape-matrix/` (not `src/lib/features/`). `new-module`
      governs navigable app tabs (`ModuleRenderer.svelte` + `MODULE_DEFINITIONS`);
      this engine has no tab, so no module registration applies. Precedent:
      the procedural-world-engine extraction moved a multi-destination engine
      to `src/lib/shared/3d/procedural-engine/`, not `features/`. Same shape here.
- [x] Move grid, drill, realization services, flower domain, render, filter into
      the module; update lab imports to the new home. — Moved via `git mv`
      (see report for the file list, including 2 test files not named in the
      spec's move list: `verify-realization-parity.test.ts`, plus the
      already-listed `filter-flower-axis`/`flower-signature`/
      `shape-matrix-realizations` tests).
- [x] Expose a public API surface: `loadShapeMatrix`, `applyFilter`,
      `defaultMatrixFilters`, `ShapeMatrixGrid`, `buildModeCards`, `ModeCard`
      (including `seq`), the size-preset helper. — No barrel export
      (`code-style` bans them); documented as direct import paths in
      `src/lib/shared/shape-matrix/README.md`. Added
      `matrixFiltersForSize(size)` in `domain/matrix-size-preset.ts`.
- [x] Contract test: public route imports only the module surface, not deep lab
      paths. — `tests/unit/shape-matrix-engine-contract.test.ts`.
- [x] Verify: `npm run check` green, lab `/test/shape-matrix` still works
      (screenshot or runtime query), build green. — `npm run check` was run
      twice during this phase (before Austen's later directive to stop running
      it per-phase, machine load): first run surfaced 3 errors, 1 of which
      (`Cannot find module '../verify-realization-parity'`, from a test file
      not on the spec's move list) was mine — fixed by also moving
      `verify-realization-parity.test.ts`. Second run: 2 errors remain, both
      pre-existing/unrelated (`src/routes/test/landing-directions/_components/
      {EditorialFrontPage,ReadingIndex}.svelte`, a `demoJson as SequenceData`
      cast) — reproduced against the untouched `build-flower-sequence.test.ts`
      in vtg-lab too, confirming they predate this move. `npm run build:fast`
      was run once and succeeded (`✓ built in 5m 59s`). No interactive browser
      screenshot taken (no DevTools permission sought this turn per
      `CLAUDE.md`). Per Austen's direction mid-phase: full `check`/`build` are
      NOT to be re-run per-phase going forward — one full run at the very end
      of the project. `[~] no further full check/build until final phase gate,
      per Austen (machine load).`

### Phase 1 — Destination route with live matrix and size control

- [x] Pre-step: closed Phase 0's loose end for `build-realization-sequence.ts`
      (`loadBaseIndex`/`resolveBase`) — moved via `git mv` into
      `src/lib/shared/shape-matrix/services/` (it had no lab-only dependency).
      `resolve-rotation-style-matrices.ts` and `build-flower-sequence.ts` stay
      in `features/lab/vtg-lab/services/` — each pulls in lab-only domain
      modules (`classify-rotation-style.ts`, `tnd-turn-patterns.ts`,
      `prepare-mandala-club-sequence.ts`) shared with other genuinely
      lab-only consumers (`bake-mandala-clips.ts`,
      `render-mandala-overlay-layer.ts`, `resolve-tnd-family-cards.ts`).
      Documented as a deliberate divergence in `shape-matrix/README.md`.
      Contract test extended with an allowlist assertion covering exactly
      the two remaining documented lab-import lines; commit `5c9f4b0d4a`.
- [x] Create `/notation/shape-matrix` with the live `ShapeMatrixGrid` at Large.
      — `src/routes/(public)/notation/shape-matrix/+page.svelte`, commit
      `0af3abac6f`.
- [x] Size control as `SegmentedControl` (S/M/L) mapping to cumulative ratio
      bands (16 / 64 / 144 tiles) via `matrixFiltersForSize`.
- [x] Axis labels and lineage credit (Lorq 2012, reusing `/notation`'s
      existing framing verbatim; Ben Drexler's VTG:153 explainer as further
      reading, same URL already used on `/notation`).
- [x] Breadcrumb back to `/notation` (JSON-LD BreadcrumbList + visible
      `.back-link`, matching the `/notation/staves` idiom); sitemap entry
      added (`src/routes/sitemap.xml/+server.ts`). Dual-registry check: both
      `MARKETING_EXACT`/`MARKETING_SUBTREES` (`src/routes/+layout.svelte`)
      and `PUBLIC_PATH_PREFIXES` (`src/config/domains.ts`) already
      `startsWith`-match on `/notation`, confirmed by reading both files —
      no edit needed, nested route already covered.
- [~] Verify: page renders each size correctly (screenshot per size), tile
      click logs the selected pair (runtime query), no layout shift on size
      change — pending browser check (no DevTools permission sought this
      turn; verified statically instead: `matrixFiltersForSize`/`applyFilter`
      wiring matches the working lab harness at `/test/shape-matrix`, the
      contract test suite passes (4/4), and the matrix stage uses a fixed
      `height: min(78vh, 60rem)` box so the size control cannot resize the
      stage). Ask Austen to open
      [localhost:5173/notation/shape-matrix](https://localhost:5173/notation/shape-matrix),
      click through Small/Medium/Large, click a tile, and confirm no jump.

### Phase 2 — Drill and hero animation (the payoff)

- [x] Tile click opens the drill with six labeled mandala thumbnails
      (SS/TS/QS/SO/TO/QO) plus element accent and parity badge. —
      `src/lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte`,
      built new under the shared module (not the lab modal, which is a
      route-boundary violation for a public route per the contract test).
      Reuses `buildModeCards`/`MODE_ORDER`/`MODE_LABEL` from
      `build-realization-cards.ts` verbatim; thumbnails render `ModeCard`'s
      already-baked `frontUrl` with `--el` accent border/tint and a
      match/px-offset parity badge (same verdict styling as the lab modal).
- [x] Onclick per thumbnail crossfades to `InlineAnimationPlayer` fed with the
      chosen `card.seq`; back control returns to the six. — `Crossfade`
      `fill` mode inside a fixed `.drill-stage` box (`height: min(64vh,
      42rem)`) so the size control and lineage prose above/below never move
      when a tile is picked or Back is pressed. `card.seq` is
      already parity-corrected by `verifyAndCorrect` inside
      `buildModeCards` (`ParityResult.sequence`) — not double-corrected.
      Back is a real `<button>` (icon + "Back to the six" label, visible
      background/border/hover, 44px floor) per
      `clickables-look-like-buttons.md`.
- [x] Trails on by default; blue and red props draw the mandala. — No trail
      prop exists on `InlineAnimationPlayer`; it reads the global
      `animationSettings.trail`, whose persisted default
      (`DEFAULT_ANIMATION_SETTINGS` in `animation-settings-state.svelte.ts`)
      forces `TrailMode.FADE` + glow for every user. Rendered with
      `bluePropType`/`redPropType` = `"club"` (`PropType.CLUB`), matching
      the prop the mode cards themselves were baked with
      (`REVIEW_PROP` in `build-realization-cards.ts` — clubs give an
      unambiguous tip so the drawn orientation reads clearly, staves don't).
      `InlineAnimationPlayer` is imported via `LazyMount` + dynamic import
      directly inside the new shared component, following the existing
      `SequenceHeroDemo.svelte` precedent (a shared/landing component doing
      the exact same import) rather than route-level prop-injection — see
      the component's header comment for the full reasoning. Any
      user-visible word (`ModeCard.word`, e.g. "OROR") is routed through
      `simplifyRepeatedWord` before display in the hero caption.
- [~] Verify: pick each of the six, confirm the animation plays and the
      drawn mandala matches the clicked cell (screenshot); back returns to
      the six. — Not run: no interactive DevTools permission sought this
      turn (`CLAUDE.md` → Browser Verification requires explicit verbal
      permission before `navigate_page`/`click`). Verified statically
      instead: the shape-matrix contract test suite passes (4/4,
      `npx vitest run tests/unit/shape-matrix-engine-contract.test.ts`);
      grepped the new component and route diff for banned patterns —
      no `type="checkbox"`, no em dash in any user-visible string (only in
      code comments, which the rule doesn't cover), no "half turn"/"quarter
      turn" phrasing. Ask Austen to open
      [localhost:5173/notation/shape-matrix](https://localhost:5173/notation/shape-matrix),
      click a tile, confirm the six labeled thumbnails render with visible
      element-accent borders and parity badges, click one to confirm the
      crossfade to the hero player plays the prop drawing the mandala with a
      visible trail, confirm nothing above/below the drill box shifts during
      the crossfade, then click Back and confirm it returns cleanly to the
      six with no layout jump.

### Phase 3 — Responsive and mobile drawer

- [x] `isMobile` via `BREAKPOINTS.MOBILE` plus resize listener on the route. —
      No shared media-query hook exists; grepped for one (`MediaQuery`,
      `matchMedia`, `isMobile`) and found every consumer (ArrangeTab,
      InboxDrawer, CreateModule, etc.) hand-rolls its own local state per the
      spec's own note ("The `/notation` route has no device plumbing
      today"). Followed the `ArrangeTab.svelte`-style inline `resize`
      listener (closest existing idiom using a raw listener rather than
      `matchMedia`), but read the initial value from `BREAKPOINTS.MOBILE`
      instead of a hand-rolled `768` — `isMobile` is `$state`-initialized
      directly from `window.innerWidth < BREAKPOINTS.MOBILE` (so the correct
      value is present on first client render, no flash), then a
      `$effect`-scoped `resize` listener keeps it live.
- [x] Drill uses `Drawer` with `placement={isMobile ? 'bottom' : 'right'}`. —
      Re-hosted `ShapeMatrixDrill` inside `Drawer` + `DrawerHeader`,
      following the `GalleryFilterSheet.svelte` idiom verbatim: outer
      `style:--drawer-width={isMobile ? "100vw" : "min(640px, 48vw)"}`
      wrapper, `.drill-sheet-content` fixed `height: calc(85dvh - 60px)`
      on mobile / `flex:1` under `[data-placement="right"]` on desktop,
      `--sheet-width: var(--drawer-width, ...)` on the drawer class. Tile
      click sets `selectedPair` and opens the drawer (`drillOpen = true`);
      closing (backdrop/escape/header X) sets `drillOpen = false` but
      deliberately does NOT null `selectedPair` — matches
      `GalleryFilterSheet`'s pattern of not clearing sheet state on close, so
      re-opening the same tile shows the same six without a rebuild flash;
      a NEW tile click always overwrites `selectedPair` regardless.
      `ShapeMatrixDrill` needed a re-host adjustment (not a rebuild): its
      `.drill`/`.drill-stage` were sized off `vh` units for the old
      full-page-below-the-grid placement; changed to `height:100%` /
      `flex:1; min-height:0` so it fills the Drawer's fixed-height box
      instead of fighting it (documented in the component's header comment).
- [x] Size default Medium on mobile; grid density adapts. — `size` is
      `$state`-initialized from `isMobile ? "medium" : "large"` (mirrors the
      `isMobile` initializer above) — an INITIAL value only; the resize
      effect never re-touches `size` once set, so a later manual choice is
      never fought. Grid density: `ShapeMatrixGrid.svelte` has no explicit
      density prop to invent one for — it already self-adapts, measuring its
      own `wrapW`/`wrapH` via `bind:clientWidth`/`clientHeight` and computing
      `cell = Math.max(44, Math.min(maxCellPx, fit))`, i.e. it auto-shrinks
      cells to fit whatever viewport it's given (down to the 44px AAA
      touch-target floor) with no code change needed; the mobile default of
      Medium (64 tiles) additionally keeps the grid smaller than Large by
      itself.
- [~] Verify: emulate a phone viewport, confirm bottom-sheet drill and the size
      default (screenshot); confirm desktop right-panel drill (screenshot). —
      Not run: no interactive DevTools permission sought this turn. Verified
      statically instead: `npx vitest run
      tests/unit/shape-matrix-engine-contract.test.ts` (4/4, unaffected by
      this phase — no module-surface changes), grepped the diff for banned
      patterns (no `checkbox`, no em dash in user-visible template/string
      text — the only em dashes are in `<script>`/CSS comments, matching the
      pre-existing comment style in this same file), and no "half turn"/
      "quarter turn" phrasing. Ask Austen to open
      [localhost:5173/notation/shape-matrix](https://localhost:5173/notation/shape-matrix):
      resize the window below 768px (or DevTools device emulation) and
      confirm (a) the size control lands on Medium by default, (b) clicking a
      tile opens the drill as a bottom sheet that doesn't overflow the
      viewport, (c) at desktop width a fresh load defaults to Large and a
      tile click opens the drill as a right-side panel, (d) picking one of
      the six and hitting Back inside the sheet doesn't resize or shift it.

### Phase 4 — `/notation` teaser and IA

- [x] Demote Lorq to a small reference figure inside the arc.
- [x] Render the bounded live Small matrix as the teaser
      (`ShapeMatrixTeaser.svelte`, Small size, 1:1 band, 16 tiles).
- [x] Add the "Explore the full shape matrix" call to action to `/notation`
      (button-styled `<a>` reusing the page's `.cta-button` idiom, target is
      the destination). Deep-linking a specific cell was checked and skipped:
      `/notation/shape-matrix` has no query-param entry point yet, only
      component `$state`.
- [x] Update `/notation` source-contract tests (matrix assertion moved to the
      destination in `tests/unit/notation-roots-remediation-contract.test.ts`;
      teaser test asserts preview plus call to action). Note: the old
      144-cell assertion in that file was already failing before this phase
      (stale from a prior static-image pass on `/notation`). It is replaced
      here, not loosened.
- [~] Verify: contract tests green (proven via `npx vitest run`). Screenshot /
      browser confirmation still pending — needs Austen's go-ahead per
      `CLAUDE.md` Browser Verification (ask before interactive DevTools use).
      AI-bust pass applied to the new copy in this turn.

## Fable Dispatch Guidance

Applies when Fable is the session model (see `.claude/rules/fable-routing.md`).

- Explore: Sonnet or Haiku, effort low. Map exact signatures at each reuse file
  before wiring. The 2026-07-18 discovery audit is the starting map; re-verify
  signatures that a phase touches.
- Plan: Fable, main loop. Decompose each phase into tasks, order by risk.
- Execute: Sonnet executors. Include in every executor prompt: re-read this spec
  and the phase ledger at the start of the phase; prove completion with tool
  output (test run, grep, build, screenshot); commit with an explicit pathspec
  per `commit-only-your-own-changes.md`.
- Review: Fable, main loop. Diff review, edge cases, ship judgment, then mark
  ledger items.
- Every `Agent` and `agent()` call passes `model` and `effort` explicitly. No
  unbounded fan-outs.

## Acceptance Criteria

- `/notation/shape-matrix` exists, renders the live matrix at three sizes, and
  every tile opens the six realizations.
- Picking a realization plays the prop drawing the exact clicked mandala with a
  fading trail.
- Mobile presents the drill as a bottom sheet; desktop as a right panel.
- `/notation` shows the lineage arc, a bounded live teaser, and a call to action
  to the destination.
- No public route imports deep lab paths; the engine lives in one shared module.
- `npm run check` and the production build are green. Notation contract tests are
  green.

## Related

- Discovery audit: workflow `notation-mandala-interactive-discovery` (2026-07-18).
- Rules: `never-hand-roll.md`, `crossfade-primitive.md`, `no-layout-shift.md`,
  `chip-primitives.md`, `fable-routing.md`, `visualization-routing.md`,
  `commit-only-your-own-changes.md`, `simplified-word-display.md`.
- Prior specs: `docs/superpowers/specs/shipped/2026-03-31-live-mandala-drawing-design.md`
  (the dead-code stroke renderer, considered and rejected here),
  `docs/superpowers/specs/2026-07-17-notation-roots-merge-design.md`.
- Memory: `project_sequence_mandala`, `project_mandala_decoder`,
  `project_seo_overhaul`, `project_fable_dispatch`.
