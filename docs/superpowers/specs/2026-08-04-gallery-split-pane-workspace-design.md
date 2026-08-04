# Gallery Split-Pane Workspace — Design (2026-08-04)

## Decision

The gallery filter workspace becomes a Library-style split pane on wide
screens: one left column holding the category grid (top) and the active
category's value editor (below), one right column holding the rule strip and
a **live results grid**. The landing's category tiles and the workspace's
category grid become one shared component rendered in two compositions,
morphed between via same-document View Transitions. Collections converts
from a door (eject to Library tab) into a stackable filter. Narrow screens
keep today's step-through flow unchanged.

Approved by Austen 2026-08-04 after brainstorm. Executor: Opus 5, dispatched
per `fable-routing.md`.

Origin: the unified filter workspace shipped 2026-08-04
([2026-08-04-unified-filter-workspace-design.md](2026-08-04-unified-filter-workspace-design.md))
kept results behind a top-right "View N results" button. Austen, in the
workspace at 1920+: a newcomer picking variables sees two cards adrift in a
mostly-empty stage and the only way forward is a small corner button —
despite ample width to render the results live. The Library already taught
the answer: nav rail → left column → big browsable canvas on the right.

## Layout (≥ the split seam, ~1200px)

Two content columns inside the workspace:

- **Left column, ~400–440px:**
  - **Row 1 — category grid.** All eleven categories (Level, Length,
    Starting letter, Start position, Grid mode, LOOPs, Creator, Recently
    added, Timing & Direction, Max turn intensity, Collections) as compact
    labeled tiles, 2–3 per row, wrapping, always visible. Active category
    highlighted; categories carrying active rules show a count dot. No
    icon-only chips — every tile keeps its label.
  - **Row 2 — value editor.** The active category's values at full column
    width, 1–2 cards across. All existing editor behavior carries over
    unchanged: art (LOOP colors/icons, position pictographs, level
    gradients, creator avatars), descriptions, dimmed zero-count options,
    Match any / Match all where the category has it.
- **Right column — results.**
  - **Header: the rule strip.** Live count + grouped sentence chips
    (chip body = edit, × = remove) + Save, as the results pane's header
    row. Same shared strip component as the builder — never a copy.
  - **Body: live results.** `BrowsePanel` fed by the same
    `createBrowseEngine` state the workspace already mutates. The engine
    already recomputes matches on every toggle (that is where the live
    count comes from); the pane renders those matches. Every value tap
    updates the grid in place.

Deleted at this width: the top-right "View N results" button and the pinned
page-top rule strip. The search bar stays where it is.

## The morph (landing ↔ workspace)

- The landing's category tiles ("More ways to browse" mini-tiles plus the
  hero doors mapping By level → Level, By length → Length) and the
  workspace's category grid render **one shared tile component** in two
  compositions. One component, two layouts — drift between landing and
  workspace becomes impossible by construction.
- Transition: **same-document View Transitions API**
  (`document.startViewTransition`). Each tile carries a stable
  `view-transition-name`; on first category click the browser animates
  every tile from its landing position/size into its left-column slot in
  one choreographed pass. Backing out of the workspace reverses it.
- "Show all N sequences" opens the workspace with no rules — full results
  grid, no active category.
- Fallback (engine without same-document View Transitions, and
  `prefers-reduced-motion`): instant swap. No hand-rolled FLIP substitute.

## Collections becomes a filter

- Tapping the Collections tile shows the collection list (cover art +
  names) in the value row, same editor pattern as other categories.
- Picking one adds a stackable `collection:<id>` rule — a membership filter
  in the browse engine — so "Level 2 in Bella Sequences" is expressible.
  The rule strip renders it like any other rule ("In: Bella Sequences"),
  removable and editable.
- Nothing in the gallery navigates to the Library tab anymore. The Library
  tab remains the management home (create, edit membership, share) —
  unchanged.

## Narrow screens (below the seam, incl. fold-landscape 960×412)

Today's step-through flow, byte-for-byte: category screen → value screen →
"View N results", pinned top strip. Already verified at seven viewports on
2026-08-04. The split pane is a wide-screen enhancement only. The open
phone-sheet-feel decision (GalleryFilterSheet on real phones) stays its own
decision, untouched by this project.

## Architecture: file split first (Phase 1, no behavior change)

`src/lib/features/browse/gallery-home/GalleryDrill.svelte` is 6,232 lines
holding two nearly-disjoint products. Phase 1 splits it before any layout
work:

- `GalleryLanding.svelte` — hero doors, mini-tile grid, peeks, editorial
  CSS.
- `GalleryWorkspace.svelte` — catalog, value editors, strip wiring,
  workspace CSS.
- Shared `CategoryTile` (name at executor's discretion, follow
  `primitive-discovery.md`) — the tile both surfaces render; the piece
  that makes the morph "one component, two compositions" real.
- Value-editor subcomponents split out where mechanical.

Phase 1 exit criteria: zero behavior change (screenshot-identical sweep),
grep-proof that no landing selectors live in the workspace file and vice
versa, all existing unit tests green.

## Out of scope

- BrowsePanel internals (the sparse-results pass stays a named
  fast-follow).
- The phone sheet decision.
- `AddSequencesSheet` — keeps its in-sheet step-through flow; no room for
  a results pane inside a sheet.
- Saved-spec semantics, connectives, migration — all untouched.

## Risks

- **Editorial flattening.** The value-editor art is where newcomers learn
  what the variables mean — Austen's original complaint. The left column
  must keep cards with real art at 1–2 across; if a category's editor
  cannot read at ~420px, that phase stops and says so rather than
  shrinking art to chips.
- **Engine perf.** Live rendering on every toggle. The engine already
  recomputes per toggle; if grid re-render cost shows jank at 4K, virtualize
  or debounce the pane, not the engine.
- **Morph brittleness.** View-transition-names must be stable and unique
  per tile; duplicated names silently break the whole transition. Verify
  the morph by recording it, not by assuming.
- **`collection:<id>` rules in persisted specs.** A gallery-persisted rule
  referencing a deleted collection must degrade to a no-op rule with a
  clear strip chip, not a crash or an invisible filter.

## Verification (per `visual-verification-mandatory.md`)

- Ten-viewport sweep with webp screenshots: 3840 / 2560 / 1920 / 1440 /
  820×1180 / 750×832 / 960×412 / 412×960 / 375×667, emulated ×1.1 for the
  110% localhost zoom (`reference_devtools_emulate_dpr`). The ~1200px seam
  checked from both sides.
- Measured (not eyeballed) left-column width, tile widths, and results-grid
  column counts at 1920 / 2560 / 3840 via `evaluate_script`.
- A live-toggle walk: tap values across ≥3 categories, prove the grid and
  count update with no "View results" press.
- A collection-rule walk: add `collection:<id>`, stack a second rule,
  remove via strip.
- The morph recorded (screenshot series or trace) and eyeballed.
- Phase 1 gets its own before/after screenshot comparison proving zero
  visual change prior to any layout work.

## Decisions log (brainstorm answers)

1. Value-editor placement: **left column, stacked under the category
   grid** (Austen's proposal — two columns total, column 1 = two rows).
2. Category section form: **wrapping compact-tile grid**, all eleven
   always visible, labeled (option A over icon row / collapsing list).
3. Rule strip: **atop the results column** as its header (option B).
4. Landing tiles morph into the category grid via **View Transitions**;
   one shared component (Austen's proposal).
5. Collections: **becomes a stackable filter** (option A); Library tab
   stays the management home.
6. Narrow screens: **fall back to today's step-through flow** below
   ~1200px (option A); seam exact value at executor's discretion within
   1140–1280 based on where the columns stop fitting.
7. File split is **Phase 1**, before any layout change.
