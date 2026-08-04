# Unified Filter Workspace — Design (2026-08-04)

## Decision

The Smart Collection builder's filter interaction layer becomes the one
filter workspace for every browse surface. The gallery's editorial landing
(hero doors, mini tiles, peeks, "show all") stays as the discovery entry;
entering any filter category puts you in the builder-pattern workspace,
**in-page** (no modal). End state: `GalleryDrill.svelte` has one interaction
model and one layout system per screen, and the count-keyed page-mode CSS
forks are deleted.

Approved by Austen 2026-08-04 after brainstorm. Origin: the 2026-08-03
Smart Collection audit/fix arc proved the builder pattern (universal
stacking, rule strip, stable option sets) and exposed the cost of the
page-vs-builder CSS fork (the dense-length regression, fixed in
`0d5cf46069`, existed only because the two modes hold parallel
count-keyed layouts).

## Sequencing

**Blocks on the Any/All connective work** (loose end #1 in
[2026-08-03-smart-collection-audit-fix-handoff.md](2026-08-03-smart-collection-audit-fix-handoff.md)):
Match any / Match all in LOOPs/T&D editors, grouped rule-strip sentence,
saved-spec migration. The gallery only ever adopts settled semantics and
the final strip. Building the strip twice is the failure mode this ordering
prevents.

## What unifies (the interaction layer)

- **Tap-to-stack everywhere.** Every category toggles in place via
  `onToggleValue`. OR within a category, AND across categories; LOOPs/T&D
  carry whatever Match any/all control the connective work ships.
- **Rule strip in the gallery.** Pinned once ≥1 filter is active: grouped
  sentence + live count, chip body = edit, × = remove. The same component
  as the builder's strip — never a copy.
- **Stable option sets.** Complete catalogs; zero-count options dim with an
  explanation; nothing unmounts mid-session. The gallery's ≥3 noise floors
  are removed (the `onToggleValue`-gated filters in `lengthValues` /
  `levelValues` become unconditional).
- **No bounce-backs.** Editors never eject to another screen on apply.
- **Unified chooser.** The ten-category chooser replaces the drill's
  secondary "more choices" hub when the user asks for filters beyond the
  hero doors.

## What stays editorial (explicitly NOT unified)

- The landing composition: hero doors with peeks, mini-tile grid,
  "show all N sequences."
- Value-screen art: level gradients + descriptions, position pictographs,
  LOOP colors, family icons, creator fans. Only layout math converges.
  Length keeps its dense chips (`0d5cf46069`) because numerals have no art
  to lose — that logic does not generalize to screens that teach visually.
- Results rendering (BrowsePanel) is untouched except the strip above it.

## Architecture: mode collapse

Today `GalleryDrill.svelte` (~6,800 lines) forks per screen per tier:
`progressive-secondary-choices` (page mode) vs `unified-filter-chooser` +
`adaptive-value-layout` + `persistent-desktop-catalog` (builder mode).

1. `BrowseModule`'s drill adopts the builder flags for its filter screens;
   landing screens keep their own styles.
2. Each converted screen's page-mode CSS fork is **deleted in the same
   phase** — no phase ends with both layouts alive. This is the guard
   against the three-modes failure state.
3. When the last fork dies, the flag surface collapses to
   "workspace + optional editorial landing." A file split (landing styles
   vs workspace styles) is the natural follow-up once the CSS halves are
   disjoint — in scope for the plan if the collapse makes it mechanical,
   otherwise a named fast-follow.

## Save bridge

With ≥1 filter active, the rule strip offers a small **Save** action that
hands the current rule object to the builder's existing naming/confirm
step; the user stays in the gallery afterward. Browsing becomes the
discovery funnel into Smart Collections. No new UI beyond the strip
affordance — the rule model is already shared. Degrades to a fast-follow
under scope pressure.

## Consumers

| Consumer | Fate |
|---|---|
| `BrowseModule` (main gallery) | Converts. Primary surface. |
| `AddSequencesSheet` | Inherits via the shared path; own verification checklist (selection chrome over the new workspace). |
| `GalleryFilterSheet` | Desktop path retires in favor of strip-edit. **Phone keeps the sheet for now** — settled by feel on a real phone during verification, not upfront. |
| `SmartCollectionBuilderSheet` | Unchanged; it is the donor. |

## Dependencies, fast-follows, risks

- **Blocks on:** connective work (above).
- **Fast-follow promoted:** BrowsePanel sparse-results pass (ledger
  C3-remaining) — complete option sets make 1-match dead-ends more
  reachable, e.g. "24 steps (1)".
- **Migration check:** persisted gallery filters saved under bare-type
  keys must load correctly under the per-value key scheme
  (`starting_position:alpha`). Removal already prefix-matches; loading
  needs a test.
- **Risk — flattening the editorial charm:** guarded by the
  "what stays editorial" section; any plan phase that converts a
  value screen must state what art it preserves.
- **Risk — three modes instead of one:** guarded by delete-in-same-phase
  (architecture rule 2).

## Verification

Per converted screen:

- Ten-viewport probe + screenshot sweep (3840 / 2560 / 1920 / 1440 /
  820×1180 / 750×832 / 960×412 / 412×960 / 375×667, emulated ×1.1 for the
  110% localhost zoom), zero drill-screen overflow.
- Grep-proof the deleted page-mode CSS fork is gone.

Whole-project:

- Persisted-filter reload test (bare-type → per-value keys).
- AddSequencesSheet selection walk.
- One full production interaction walk ending in a real save from the
  gallery rule strip.

## Decisions log (brainstorm answers)

1. Workspace location: **in-page** (not modal, not hybrid).
2. Option sets: **complete with dimmed zeros** everywhere.
3. GalleryFilterSheet: desktop retires; **phone TBD by feel**.
4. Save bridge: **yes**, strip affordance.
5. Sequencing: **connective first**, then this.
6. AddSequencesSheet: **converts in this project**.
