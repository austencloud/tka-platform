# Gallery Split-Pane Workspace Implementation Plan

> **For agentic workers:** Execute task-by-task, in order. Steps use checkbox
> (`- [ ]`) syntax — mark `- [x]` as you complete them, `- [~] deferred:
> <reason>` if skipped. Re-read this plan at the start of every task; the plan
> is authority, not your memory. Every commit uses an explicit pathspec
> (`git commit -m "..." -- <paths>`) per
> `.claude/rules/commit-only-your-own-changes.md`. Every completion claim
> carries tool-output evidence per `.claude/rules/verification-protocol.md`.
> Do not delegate to further subagents — finish this yourself.

**Spec:** `docs/superpowers/specs/2026-08-04-gallery-split-pane-workspace-design.md`
— read it in full before Task 1.

**Goal:** The gallery filter workspace becomes a two-column split pane on wide
screens (categories + value editor left, rule strip + live results right),
with the landing tiles morphing into the workspace's category grid via View
Transitions, and Collections converted from a door into a stackable filter.

**Architecture:** Phase 1 splits the 6,232-line `GalleryDrill.svelte` into
`GalleryLanding.svelte` + `GalleryWorkspace.svelte` + a shared `CategoryTile`
behind an unchanged `GalleryDrill` prop seam (consumers untouched). The split
pane then lands entirely inside `GalleryWorkspace.svelte`, with results
injected from `BrowseModule` as a Svelte snippet so the existing
`BrowsePanel`/engine wiring is reused, not re-plumbed.

**Tech stack:** Svelte 5 runes, same-document View Transitions API
(`document.startViewTransition`), existing
`view-transition-name-registry.ts`, `createBrowseEngine`, `BrowsePanel`,
`FilterRuleStrip`.

**Verified seams (2026-08-04, do not re-derive):**

| Thing | Path |
|---|---|
| The monolith | `src/lib/features/browse/gallery-home/GalleryDrill.svelte` (6,248 lines; props at :180–208) |
| Primary host + engine + `galleryView` state | `src/lib/features/browse/shared/components/BrowseModule.svelte` (drill at :641, GalleryTab at :711) |
| Results panel | `src/lib/shared/browse/components/BrowsePanel.svelte` (hosted by `GalleryTab.svelte` :88) |
| Rule strip | `src/lib/shared/browse/components/FilterRuleStrip.svelte` |
| Engine | `src/lib/shared/browse/engine/create-browse-engine.svelte.ts`, `types.ts` (no collection filter yet) |
| View-transition name dedup | `src/lib/shared/transitions/view-transition-name-registry.ts` (claim/release; names must be unique per document) |
| Other GalleryDrill consumers (must not change in Task 1) | `AddSequencesSheet.svelte`, `SmartCollectionBuilderSheet.svelte`, `GalleryFilterSheet.svelte`, `gallery-view-persister.ts`, `src/routes/test/gallery-redesign/+page.svelte` |
| Filter-type → section map | `BrowseModule.svelte` :152–165 |

**Browser verification loop (used by several tasks):** the shared debug Chrome
via `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`,
then chrome-devtools MCP: `new_page` (background), `emulate` viewport
`<w*1.1>x<h*1.1>x1.1` (the ×1.1 compensates 110% localhost zoom —
`reference_devtools_emulate_dpr`), `take_screenshot` with
`format: "webp", quality: 70`, `evaluate_script` for measurements. Dev server
is `https://localhost:5173` (HTTPS, never restart it). Close your own tab
when done. READ every screenshot for defects
(`.claude/rules/visual-verification-mandatory.md` — the checklist matters).

---

### Task 0: Recon (no code)

- [x] **Step 0.1:** Read the spec in full.
- [x] **Step 0.2:** Read `GalleryDrill.svelte` in full (yes, all of it — use
  offset/limit passes). Build a written inventory in your scratchpad:
  (a) every top-level template block and which product it belongs to
  (landing vs workspace vs shared), (b) every CSS rule block by selector
  prefix (`.hero-`, `.mini-`, `.choice-`, `.unified-`, `.desktop-filter-`,
  `.drill.` variants) and which product owns it, (c) every prop and which
  product consumes it.
- [x] **Step 0.3:** Read `BrowseModule.svelte` :100–260 and :600–740 (view
  state, workspace wiring, drill/tab render sites), `GalleryTab.svelte` in
  full, `FilterRuleStrip.svelte` in full, `create-browse-engine.svelte.ts`
  exports and `types.ts` in full.
- [x] **Step 0.4:** Baseline screenshot set of TODAY'S behavior, saved to
  your scratchpad (not committed): landing + workspace (one category open,
  one rule active) at 2112×1188×1.1, 1584×990×1.1, 4224×2376×1.1, and
  landing at 412×920×1.1 (phone flow). These are the Task 1 no-change
  reference.

### Task 1: File split — zero behavior change

**Files:**
- Create: `src/lib/features/browse/gallery-home/GalleryLanding.svelte`
- Create: `src/lib/features/browse/gallery-home/GalleryWorkspace.svelte`
- Create: `src/lib/features/browse/gallery-home/CategoryTile.svelte`
- Modify: `src/lib/features/browse/gallery-home/GalleryDrill.svelte` (becomes a thin dispatcher, public props UNCHANGED)
- Test: `tests/unit/browse/gallery-drill-split-contract.test.ts`

`GalleryDrill.svelte` keeps its exact `Props` interface and remains the only
import consumers touch. Internally it renders `GalleryLanding` when no
section is active in landing composition, `GalleryWorkspace` otherwise —
mirroring today's internal branching. `CategoryTile.svelte` is the one tile
component both render (landing mini-tile composition and workspace catalog
composition are the same component with a `composition: "landing" | "catalog"`
prop or CSS-driven sizing — executor's choice, but ONE component).

- [x] **Step 1.1:** From the Task 0 inventory, move the landing template +
  landing-owned CSS into `GalleryLanding.svelte`; workspace template +
  workspace CSS into `GalleryWorkspace.svelte`; the mini-tile markup into
  `CategoryTile.svelte` consumed by both. Shared helpers (section maps,
  `showSection`, `sectionNarrowedOut`, art snippets used by both) go where
  their consumers are; if genuinely shared, a sibling
  `gallery-drill-shared.ts`. No selector may exist in both new files —
  that is the drift this split kills.
- [x] **Step 1.2:** Reduce `GalleryDrill.svelte` to props passthrough +
  the landing/workspace branch. Target: under 300 lines.
- [x] **Step 1.3:** Write the contract test asserting the split holds
  (same pattern as `tests/unit/sequence-viewer-shell-contract.test.ts`):
  GalleryDrill source contains no `<style>` block over 50 lines and no
  `.hero-`/`.unified-choice-grid` selectors; GalleryLanding source contains
  no `.unified-`/`.desktop-filter-` selectors; GalleryWorkspace source
  contains no `.hero-` selectors; both render `CategoryTile`.
  Run: `npx vitest run tests/unit/browse/gallery-drill-split-contract.test.ts`
  Expected: PASS.
- [x] **Step 1.4:** `npm run check > "$env:TEMP/check.log" 2>&1` then grep the
  log for `error` (one check per turn — `.claude/rules/fast-iteration-loop.md`).
  Expected: 0 errors. Then `npx vitest run tests/unit/browse/`
  Expected: same pass/fail set as before the split (the two protobufjs
  import failures and `browse-engine-solo-load-race` fail on HEAD already —
  they are the pre-existing baseline, not yours).
- [x] **Step 1.5:** Re-shoot the Task 0.4 screenshot set. Compare against
  baseline side by side. Expected: pixel-equivalent composition at every
  viewport (background animation may differ frame to frame).
- [x] **Step 1.6:** Commit:
  `git commit -m "refactor(gallery): split GalleryDrill into Landing + Workspace + CategoryTile" -- src/lib/features/browse/gallery-home/ tests/unit/browse/gallery-drill-split-contract.test.ts`

### Task 2: Split-pane layout (≥ seam) with live results

**Files:**
- Modify: `src/lib/features/browse/gallery-home/GalleryWorkspace.svelte`
- Modify: `src/lib/features/browse/gallery-home/GalleryDrill.svelte` (new optional props, passthrough)
- Modify: `src/lib/features/browse/shared/components/BrowseModule.svelte`

New prop seam on GalleryDrill/GalleryWorkspace:

```ts
interface Props {
  // ...existing props unchanged...
  /** Rendered as the right-hand live results pane on wide screens.
   *  When absent (sheets, narrow hosts), the step-through flow renders. */
  resultsPane?: Snippet;
  /** Rendered as the results-pane header (rule strip + count + Save). */
  resultsHeader?: Snippet;
}
```

`BrowseModule` passes both snippets: `resultsPane` renders the same
`BrowsePanel` composition `GalleryTab` uses, bound to the live engine;
`resultsHeader` renders `FilterRuleStrip` + Save exactly as the current
pinned bar does. The sheets (`AddSequencesSheet`,
`SmartCollectionBuilderSheet`, `GalleryFilterSheet`) pass neither and keep
today's flow automatically.

- [x] **Step 2.1:** Add the snippet props and, in `GalleryWorkspace`, the
  wide-tier grid: `grid-template-columns: minmax(25rem, 27.5rem) 1fr`
  behind `@media (min-width: 1200px)` when `resultsPane` is present
  (exact seam value: executor picks within 1140–1280 where the columns
  stop fitting; document the chosen value in a CSS comment). Left cell
  stacks the category grid (all 11 as compact `CategoryTile`s, 2–3 per
  row, labels always visible, count-dot on categories with active rules)
  above the active value editor. Right cell: `resultsHeader` then
  `resultsPane`. Value-editor card layouts inside the left column go to
  1–2 across — art is preserved, not shrunk to chips (spec Risk 1: if a
  category cannot read at ~420px, STOP and report rather than degrade it).
- [x] **Step 2.2:** In `BrowseModule`, build the two snippets and pass them
  to the drill only for the main gallery surface. While the workspace is
  live-rendering results, suppress the pinned top strip and the
  "View N results" button at the wide tier (they remain below the seam).
  The Save action moves into `resultsHeader`.
- [x] **Step 2.3:** `npm run check` (captured log, grep errors). Expected: 0.
- [x] **Step 2.4:** Browser loop, wide tier: at 2112×1188×1.1 open the
  workspace, tap values across Level, Grid mode, LOOPs. Evidence required:
  `evaluate_script` returning the results grid's rendered card count
  before/after each tap (proves live update, no "View results" press), and
  measured left-column width + category-tile widths. Screenshot each state.
- [x] **Step 2.5:** Browser loop, remaining viewports: 4224×2376×1.1,
  2816×1584×1.1, 1584×990×1.1 (above-seam set), then 1320×902×1.1 and
  1056×453×1.1 (960×412 fold) and 412×733 phone — the below-seam set must
  show today's step-through flow unchanged, "View N results" intact.
  Read every frame against the visual-verification checklist (absurd
  widths, dead space, orphans, dead-ends).
- [x] **Step 2.6:** Commit:
  `git commit -m "feat(gallery): split-pane workspace — live results right, filters left" -- src/lib/features/browse/gallery-home/ src/lib/features/browse/shared/components/BrowseModule.svelte`

### Task 3: The landing ↔ workspace morph

**Files:**
- Modify: `src/lib/features/browse/gallery-home/CategoryTile.svelte`
- Modify: `src/lib/features/browse/gallery-home/GalleryLanding.svelte`
- Modify: `src/lib/features/browse/gallery-home/GalleryWorkspace.svelte`
- Modify: `src/lib/features/browse/gallery-home/GalleryDrill.svelte` (or wherever the landing→workspace branch flips)

- [x] **Step 3.1:** Give each `CategoryTile` a stable name
  `gallery-cat-<sectionKey>` claimed through
  `claimViewTransitionName(name, onGrant)` from
  `src/lib/shared/transitions/view-transition-name-registry.ts` (claim on
  mount, release on destroy; apply `style:view-transition-name` only when
  granted). The hero doors (By level, By length) claim their mapped
  category names so they morph into the Level/Length tiles.
- [x] **Step 3.2:** Wrap the landing↔workspace state flip in
  `document.startViewTransition` when available:

```ts
function flipWithMorph(apply: () => void) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduced) { apply(); return; }
  document.startViewTransition(apply);
}
```

  DEVIATION: "Show all" keeps today's behavior (clear rules, hand off to the
  full-page grid tab) rather than opening the split pane with no active
  category. The split pane is keyed to an open value editor; a fourth
  "workspace, no category" state would have to be threaded through every
  GalleryDrill host (including the two sheets) for a surface that already
  exists as the grid tab. The spec's outcome — full results, no rules, no
  active category — is delivered.

  (Svelte flushes synchronously enough for same-document transitions when
  the state change happens inside the callback; if the capture misses the
  new layout, wrap `apply` with `flushSync` from `svelte`.) "Show all"
  enters the workspace with no rules and a full grid. Backing out reverses.
- [x] **Step 3.3:** Verify: browser loop at 2112×1188×1.1, click a landing
  tile, capture a screenshot mid-transition (fire `take_screenshot`
  immediately after the click) plus the settled end state; then check
  `list_console_messages` for `InvalidStateError` (duplicate
  view-transition-name — the registry exists precisely to prevent this;
  any hit is a bug in your claiming). Repeat for back-out and "Show all".
- [x] **Step 3.4:** `npm run check` captured-log grep. Expected: 0 errors.
- [x] **Step 3.5:** Commit:
  `git commit -m "feat(gallery): landing tiles morph into workspace catalog via view transitions" -- src/lib/features/browse/gallery-home/`

### Task 4: Collections becomes a stackable filter

**Files:**
- Modify: `src/lib/shared/browse/engine/types.ts` (new rule kind)
- Modify: `src/lib/shared/browse/engine/create-browse-engine.svelte.ts`
- Modify: `src/lib/shared/browse/components/FilterRuleStrip.svelte` (label: `In: <name>`)
- Modify: `src/lib/features/browse/gallery-home/GalleryWorkspace.svelte` + `GalleryLanding.svelte` (Collections tile opens a value editor, never navigates)
- Modify: `src/lib/features/browse/shared/components/BrowseModule.svelte` (remove the Library-tab eject for collections)
- Test: `tests/unit/browse/collection-filter.test.ts`

- [x] **Step 4.1:** Investigate first (30 min cap): how collection
  membership is resolved today — start from
  `src/lib/features/browse/collections/components/CollectionsBrowsePanel.svelte`
  and `SmartCollectionDetailView.svelte` and find the service that maps a
  collection id to sequence ids. Write the finding (service + call
  signature) into this plan file under this step before coding.
- [x] **Step 4.2:** Add a `collection` filter kind keyed per value
  (`collection:<id>`), same stacking/connective-free semantics as other
  multi-value categories (OR within, AND across). A rule referencing a
  collection that no longer resolves degrades to matching nothing, with
  its strip chip still rendered and removable (spec Risk 4) — never a
  crash, never an invisible filter.
- [x] **Step 4.3:** Unit tests: (a) membership filter narrows to the
  collection's sequences, (b) stacks with a level rule (AND), (c) missing
  collection id yields empty results and a live, removable rule, (d)
  persisted `collection:<id>` key round-trips through the
  persister/migration path the other per-value keys use.
  Run: `npx vitest run tests/unit/browse/collection-filter.test.ts`
  Expected: PASS.
- [x] **Step 4.4:** Wire the value editor: Collections tile shows the
  collection list (cover + name + count, dimmed zeros like every other
  category) in the value row; tap = toggle rule. Delete the
  navigate-to-Library behavior for the gallery surface (grep
  `viewCollectionDetail` uses in `BrowseModule.svelte` :243–247 — only the
  gallery-drill path changes; GalleryTab shelf rows and detail views keep
  theirs).
- [x] **Step 4.5:** Browser walk at 2112×1188×1.1: add "In: <collection>",
  stack Level 2, screenshot strip + narrowed grid, remove via ×.
  `npm run check` captured-log grep: 0 errors.
- [x] **Step 4.6:** Commit:
  `git commit -m "feat(browse): collection membership is a stackable gallery filter" -- src/lib/shared/browse/ src/lib/features/browse/ tests/unit/browse/collection-filter.test.ts`

### Task 5: Full verification sweep + closeout

- [x] **Step 5.1:** The spec's ten-viewport sweep on the final build
  (landing, workspace with 2 stacked rules, both sides of the seam), all
  frames read against the checklist. Fix-and-reshoot until clean.
- [x] **Step 5.2:** Full `npm run check` (captured log): 0 errors, 0
  warnings. `npx vitest run tests/unit/browse/`: baseline failures only.
- [~] **Step 5.3:** deferred: ledger updated, but `git push` is held at the
  orchestrator's instruction while an unrelated history question is resolved.
  All five tasks are committed locally.
- [x] **Step 5.4:** Report back with: commit SHAs per task, the evidence
  per task (screenshot paths, measured numbers, test output), anything
  deferred, and any spec deviation you made with its justification.

## Baseline failures (pre-existing on HEAD, not yours)

`tests/unit/browse/`: two protobufjs import failures +
`browse-engine-solo-load-race` (fails on HEAD; `$effect.root` helper no-ops
in the node test build). Do not fix, do not count against yourself.


## Executor closeout (2026-08-04)

**Commits** — Task 1 `eb02237788`, Task 2 `6854d7e845`, Task 3 `5ff9219008`,
Task 4 `681f979aaa`, Task 5 (this closeout + the 375px collections fix).

**Deviations, with reasons**

1. **The split pane lives in `GalleryDrill`, not `GalleryWorkspace`** (plan
   Task 2 named the latter). After the Task 1 split, `GalleryWorkspace` is the
   VALUE-EDITOR layer inside the per-section `<Crossfade>`; putting the results
   pane there would remount the whole grid on every category tap — the opposite
   of live results. `.drill-stage` (GalleryDrill) is the container that spans
   both columns, so the pane is there. The `resultsPane`/`resultsHeader` snippet
   seam is exactly as specced.
2. **The seam is a measured JS threshold (1240px of drill width), not a
   container query.** The host must retire its pinned strip and "View N results"
   in lockstep with the pane opening, and a media query and a container query
   cannot be kept in agreement. `drillWidth` is the same `bind:clientWidth` the
   art tiers already use, so the layout and the decision cannot drift.
3. **"Show all" keeps today's behavior** (clear rules → full-page grid tab)
   rather than opening the split pane with no active category — see the note
   under Step 3.2.
4. **The contract test's line cap for GalleryDrill is 800, not 600.** The shell
   legitimately grew by the split-pane columns; it is 672 lines against the
   original 6,248.
5. **`hideFilterChips` added to BrowseToolbar/BrowsePanel.** The results pane
   was rendering a second, contradicting copy of the filters already on the
   left. Extending the shared primitive beat forking it.

**Known, not fixed (out of scope per the spec)**

- Sparse results: sections holding 1–3 sequences leave the rest of their row
  empty in the results pane at 2560/3840. That is BrowsePanel's named
  fast-follow, unchanged by this work.
- The adaptive value screens' sticky `.drill-head` is translucent over a
  scrolled list at ~750px wide. Pre-existing on every value screen; the new
  Collections editor is simply the first place it was noticed.

---

## Task 6: Austen's review pass (2026-08-05)

Austen reviewed the shipped workspace on his real 4K monitor with DevTools
docked (effective content width ~1550px — just above the 1240px seam).
Verdict: *"Major improvement... we're on the right track but it needs a
serious pass."* Everything below is his punch list. Items 7 and 8 are
decisions he has now made — implement them, do not re-litigate.

**Additional verified seams for this task:**

| Thing | Path |
|---|---|
| Page-top search bar | `GalleryDrill.svelte` :415–425 (`{#if onSearch}` block), fed by `onSearch` from `BrowseModule.svelte` :812 |
| Show-all handler | `BrowseModule.svelte` :811 `onShowAll` → `applyToGrid` |
| The eject to the old page | `BrowseModule.svelte` :257–266 `applyToGrid()` sets `galleryView = "browse-all"` → renders `GalleryTab` (:826) instead of the workspace |
| "Start here" pill | `GalleryTab.svelte` :93 `backLabel="Start here"`; handlers `onBackToStart`/`onOpenWorkspace` at `BrowseModule.svelte` :836–845 |
| Split-pane liveness flag | `BrowseModule.svelte` :249 `splitPaneActive`, set by `onSplitPaneChange` :819 |
| T&D dots art | `CategoryTile.svelte` (`.element-dots` / `.element-dot`) |

### Visual polish

- [x] **Step 6.1 — top tiles are vertically smushed.** Give the category
  tiles real vertical breathing room. Check `min-height`/padding at every
  tier, especially 2560/3840 where the lockstep root ramp
  (`.claude/rules/4k-native-layout.md`) should already be growing them and
  evidently is not carrying the tile box. Express sizes in `rem`.
- [x] **Step 6.2 — dead space below the value chips.** The left column
  strands vertical space under the value grid (visible in the length
  screen: chips end at ~60% height, nothing below). Use the column's
  height — 4K rule 4, "a wide screen is also a tall one."
- [x] **Step 6.3 — awkward spacing in the value-screen header.** The
  "Pick a length" header row (back arrow + title + neighboring control)
  has an awkward gap. Fix the row's composition.
- [x] **Step 6.4 — Timing & Direction dots overflow their art container.**
  The colored dots spill outside the tile's art slot. Same class of bug as
  the grid-mode preview fixed in `907b9778c1` (unconstrained art in an
  auto-sized flex slot). While there, audit EVERY art variant in
  `CategoryTile.svelte` for a missing box constraint and fix all of them,
  not just T&D.
- [x] **Step 6.5 — unify the results surface.** The results pane's
  background is visibly darker than the workspace panels beside it, so the
  page reads as two products. Unify the surface styling (one token family
  for both panes).
- [x] **Step 6.6 — the animations are gone.** Austen sees no transitions in
  real use. DIAGNOSE FIRST, with evidence, before changing anything.
  Candidate causes to rule out: (a) the workspace is entered from persisted
  state on load so the landing↔workspace morph never fires; (b) the
  per-section `<Crossfade>` was lost or neutralized in the Task 1 split, so
  category/value switches no longer animate; (c) a `prefers-reduced-motion`
  or emulation artifact that makes it look fine in your harness and dead on
  his machine. Report the finding, then make transitions present on the
  paths a real user actually takes.

### Flow (decisions already made — implement)

- [x] **Step 6.7 — delete the page-top search bar from the gallery.**
  Austen: search is not how people will primarily find sequences, and a
  full-width search bar at the top of the page claims otherwise. Remove it
  from the gallery surface (`GalleryDrill.svelte` :415–425 / the `onSearch`
  wiring that renders it). The results toolbar's own search affordance
  becomes the search — verify it works in the split pane. Re-screenshot the
  landing composition without the top bar and confirm it still balances.
  Other `GalleryDrill` hosts (`GalleryFilterSheet`, `AddSequencesSheet`)
  keep whatever search they pass today.
- [x] **Step 6.8 — search and Show all stay in the workspace.** This
  REVERSES deviation 3 above; Austen's experience proved the spec's original
  call. Today `onShowAll` and `onSearch` both call `applyToGrid()`, which
  flips `galleryView` to `"browse-all"` and renders the old full-page
  `GalleryTab` with its "Start here" pill — a completely different screen,
  and backing out of a search dumps the user there rather than where they
  were. Above the seam: Show all = the workspace with no active rules (full
  live grid); a search = one more narrowing of the live grid. The gallery's
  own flows must never land on the "Start here" screen at desktop widths.
  Below the seam, today's step-through + `GalleryTab` behavior stays exactly
  as it is. `GalleryTab` may remain reachable for other hosts; it just stops
  being a destination of the gallery's own desktop flows.

### Readability sweep

- [x] **Step 6.9 — 4K pass over the whole workspace.** Viewport sweep at
  1920 / 2560 / 3840 **plus ~1550px content width** (Austen's
  DevTools-docked reality — confirm the seam behaves sanely there rather
  than degenerating into a squeeze). Read every frame for smushed controls,
  stranded space, overflow, and contrast; fix what the frames show. This is
  the item that decides whether the pass is done — arithmetic is not
  verification of composition.
- [x] **Step 6.10 — verify + commit.** `npm run check`: 0 errors, 0
  warnings. `npx vitest run tests/unit/browse/`: baseline failures only.
  Commit with explicit pathspecs. Do NOT push.

## Task 6 closeout (2026-08-05)

**Step 6.6 diagnosis (evidence, before any change).** All three candidate
causes were tested in the live app at 1920×1080:

- `document.startViewTransition` present; `prefers-reduced-motion` false. Not (c).
- The per-section `<Crossfade>` DOES run: sampling `getComputedStyle(layer).opacity`
  per rAF across a category switch gave `0 → 0.166 → 0.333 → 0.5 → 0.666 → 0.833 → 1`.
  Not (b) — it was never lost in the split.
- The landing→workspace morph DOES fire: a landing tile click produced 75
  view-transition animations including 11 `::view-transition-group(gallery-cat-*)`
  at 250ms; the back-out measured ready 81ms / finished 345ms.

So nothing was broken. What was true:

1. **(a) confirmed.** `restoreSection()` reads sessionStorage, so a reload lands
   straight in the workspace; from there every move is a rail tap, which never
   crosses the landing boundary and therefore never morphs. During review Austen
   reloads constantly — for him the morph effectively never fired.
2. **The one animated path animates nothing that matters.** The app globally
   disables `::view-transition-old/new(root)` (`shared/transitions/view-transitions.css`),
   so a transition only shows where a NAMED element moves. A category switch
   moves no named element; wrapping it in a view transition measured ready 124ms
   / finished 462ms and produced no visible motion, so that half was reverted.
3. **The biggest change on screen had no transition at all.** A filter tap goes
   from 1412 cards to 288 with zero animation. Every card already carries a
   `sequence-<id>` view-transition name, so wrapping the value-tap mutation
   (`withResultsMorph` in GalleryDrill) makes the grid rearrange. Measured:
   ready 347ms, settled 657ms. The 347ms is the engine recompute, which was
   always paid — it is now spent behind a morph instead of a frozen frame.

Also added: `background-color`/`box-shadow` to the CategoryTile transition, so
selecting a category eases its highlight in instead of snapping.

**Deviations**

1. **Step 6.6 half-reverted by measurement** — see above; category switches keep
   the `<Crossfade>`, value taps get the view transition.
2. **`showAllPane` is a bindable prop, not internal state.** 6.8 needs "Show all"
   AND the landing's "View N results" to open the pane; the latter lives in
   BrowseModule's pinned strip, so the host needs to set it.
3. **Contract-test line cap raised 800 → 900.** GalleryDrill is 857: the pane's
   show-all state and the unified surface. Original file was 6,248.
4. **The split-pane column seam moved 2600 → 2300 of drill width.** 4K at 150%
   scaling is a ~2470px drill, which the old seam missed entirely — the exact
   failure `4k-native-layout.md` names. A 3300 tier was tried and removed: it
   pushed the column past 900px, where the rail composition's rules clobbered
   the catalog grid. Those rail rules are now guarded with `:not(.catalog-layout)`.

**Known, not fixed**

- **Sparse results at 2560/3840.** Sections holding 2–4 sequences leave most of
  their row empty in the results pane. Dominant visual defect at 4K, but it is
  BrowsePanel's own layout and the spec puts BrowsePanel internals out of scope
  (named fast-follow, unchanged since the Task 5 closeout).
- **The app does not scale at 3840 (4K @ 100%).** Type and cards render tiny
  because the lockstep root ramp is scoped to marketing/legal shells, not the
  app. The catalog tiles now step at 1680 and 2600, but a whole-app ramp is a
  systemic change well outside this punch list.

---

## Task 7: Consistent filter motion + readability (2026-08-05)

Austen on the Task 6 result: *"Well done, very pleased, I like it."* One
follow-up from him, two defects from the orchestrator's review sweep.

### 7A — The card morph, everywhere (Austen's ask)

Austen: *"sometimes when I toggle certain filters on and off the cards do a
flip animation where they kind of fade away and then the other cards animate
in to fill their space and it's very pleasing... if we could employ such
animations consistently throughout the filtering process I think it'll be
both informative and aesthetically pleasing."*

That is the results-grid view transition added in `dcbadffea7`, which today
fires only on the value-tap path. Make it fire on EVERY path that changes the
result set, so the grid always morphs rather than blinking.

- [x] **Step 7.1 — inventory the mutation paths.** Grep every call site that
  changes the engine's result set from the gallery surface and write the list
  into this plan file (file:line each) before coding. At minimum: value tap
  (already done), rule-strip chip removal (`onRemoveFilter`), Match any/all
  connective change, search submit and search clear, Show all / clear-all,
  collection filter toggles, and any category switch that changes results.

  **Inventory (line numbers as of `5c74456b51`, before the Task 7 edits):**

  | # | Path | Call site | State before 7.2 |
  |---|---|---|---|
  | 1 | Value tap, single-valued category | `GalleryDrill.svelte:386` `pickValue` | morphed |
  | 2 | Value tap, LOOP component | `GalleryDrill.svelte:402` `pickLoop` | morphed |
  | 3 | Value tap, T&D family | `GalleryDrill.svelte:417` `pickFamily` | morphed |
  | 4 | Collection filter toggle | routes through `pickValue` (`onToggleValue`, `BrowseModule.svelte:777`) | morphed |
  | 5 | "Show all" above the seam | `GalleryDrill.svelte:342` `handleShowAll` → `BrowseModule.svelte:825` `clearUserFilters` | morphed (via `flipWithMorph`) |
  | 6 | LOOP Match any/all | prop `onLoopConnectiveChange` → `BrowseModule.svelte:791` | **not morphed** |
  | 7 | T&D Match any/all | prop `onFamilyConnectiveChange` → `BrowseModule.svelte:810` | **not morphed** |
  | 8 | Rule-strip chip × (results header) | `BrowseModule.svelte:649` | **not morphed** |
  | 9 | Rule-strip chip × (pinned strip, below seam only) | `BrowseModule.svelte:735` | n/a — no live grid below the seam |
  | 10 | Results-toolbar search apply + clear | `BrowseToolbar.svelte:596` `engine.setSearch` | **not morphed** |
  | 11 | Results-toolbar sort change | `BrowseToolbar.svelte:157` `handleSortSelect` | **not morphed** |
  | 12 | Results-toolbar clear-all / chip dismiss / Level / Favorites / Length / LOOP chips | `BrowseToolbar.svelte:236–331` | **not morphed** (hidden in the gallery pane by `hideFilterChips`, live on other hosts) |
  | 13 | Empty-state "Clear all filters" | `BrowsePanel.svelte:351` | **not morphed** |
  | 14 | Category switch (rail/catalog tap) | `GalleryDrill.svelte:328` `goToSection` | deliberately NOT morphed — the `<Crossfade>` owns it (Task 6 measured a view transition here as 124ms of freeze and zero visible motion) |
  | 15 | Page-top search submit | `GalleryDrill.svelte:372` `submitSearch` | dead on the gallery (the bar was deleted in 6.7); still live for the filter sheet, which is below the seam |

  Deliberately OUT: `BrowseFilterBar.svelte:140–164` (clear-all / search chip) —
  the gallery pane renders `showFilterBar={false}`, so it is not a gallery path.

- [x] **Step 7.2 — route them all through one helper.** A single shared
  wrapper (e.g. `withResultsMorph(mutate)`) rather than `startViewTransition`
  sprayed across call sites — one seam is what keeps this consistent as paths
  get added later. It must no-op cleanly when the API is absent, under
  `prefers-reduced-motion`, and below the seam where there is no live grid.

  Landed as `src/lib/shared/transitions/results-morph.ts`:
  `startMorph(mutate)` (unconditional primitive — `flushSync` inside
  `document.startViewTransition`, no-ops on missing API / reduced motion /
  a transition already in flight) and `withResultsMorph(mutate)` (the same,
  gated on a live results grid). `setResultsMorphActive(owner, active)` is the
  claim: `GalleryDrill` sets it from `splitPane` and releases it on destroy, so
  shared components (`BrowseToolbar`, `BrowsePanel`) can route their mutations
  through the seam and stay byte-for-byte inert on every other host.

- [x] **Step 7.3 — verify each path animates.** For every path in the 7.1
  inventory, capture evidence the transition actually ran (`transition.ready`
  / `finished` timings plus a non-zero animation count, the way the Task 6
  diagnosis did). A path that silently no-ops is exactly the bug this task
  exists to prevent. Report the results as a table.

  Measured live at 1920×1080 (×1.1 emulation) on `https://localhost:5173/browse`
  by wrapping `document.startViewTransition` and counting
  `document.getAnimations()` entries whose `pseudoElement` starts with
  `::view-transition-group(` at `transition.ready`. Every group animation
  carried `duration: 250ms`.

  | Path | ready | finished | groups (sequence / category) | card fades |
  |---|---|---|---|---|
  | Value tap — Grid mode Diamond (1412→1389) | 202 ms | 485 ms | 31 (19 / 11) | — |
  | Value tap — Level (1412→515) | 152 ms | 456 ms | 13 (1 / 11) | 25 |
  | Value tap — LOOPs stack (54→31) | 222 ms | 524 ms | 22 (10 / 11) | 49 |
  | Connective → Match all | 186 ms | 455 ms | 28 (16 / 11) | 64 |
  | Connective → Match any | 239 ms | 521 ms | 28 (16 / 11) | 64 |
  | Rule chip × (results header) | 150 ms | 427 ms | 18 (6 / 11) | 24 |
  | Toolbar search apply (54→7) | 174 ms | 453 ms | 16 (4 / 11) | 19 |
  | Toolbar search clear (7→54) | 220 ms | 497 ms | 16 (4 / 11) | 19 |
  | Toolbar sort change | 105 ms | 401 ms | 14 (2 / 11) | 26 |
  | Collection filter toggle (1412→6) | 173 ms | 536 ms | 12 (0 / 11) | 24 |
  | Empty-state "Clear all filters" | 147 ms | 410 ms | 12 (0 / 11) | 0 |
  | "Show all" (landing → pane) | 134 ms | 178 ms* | 12 (0 / 11) | 6 |
  | Landing tile → workspace (pre-existing control) | 106 ms | 403 ms | 12 (0 / 11) | 16 |
  | Category switch (control — must NOT morph) | — | — | none | — |

  Zero paths silently no-op. `seqGroups` counts cards that persist across the
  change (they slide); `card fades` counts cards that only exist on one side
  (they fade). Both are non-zero on every path that changes the card set.

  \* Measurement hazard, recorded honestly: a parallel session was editing
  `src/lib/shared/animation-engine/*` in this shared checkout throughout the
  run, and each Vite HMR reload that lands mid-transition ends it early —
  that regime shows up as `finished ≈ ready + 15 ms` with the animations
  cancelled at `currentTime: 0`. Samples taken between reloads (the table
  above) show the full 250 ms group animation. The "Show all" row is one of
  the short ones and was not re-sampled clean.

- [x] **Step 7.4 — guard the feel.** Austen likes the current character
  (cards fade out, the rest slide in to fill). Keep it: same duration and
  easing on every path. Do not let a slow engine recompute stretch the morph
  into a freeze — if a path's recompute is long enough to feel stuck, report
  the measured number instead of shipping it.

  Character is identical on every path by construction: one helper, no
  per-path CSS, so every card group uses the browser default 250 ms /
  ease. The recompute (the frozen part) is 130–265 ms on every path measured
  warm — the same beat the value tap already shipped with and Austen approved.
  One outlier worth naming: the FIRST search of a session measured
  ready 1411 ms / finished 3738 ms while the search index built cold;
  subsequent searches measured 174 ms. That cost is the engine's, not the
  morph's — the same synchronous work blocks the thread with or without a
  transition; the transition only decides whether the frozen frame is the old
  grid or a half-painted one.

### 7B — Readability defects from the review sweep

- [x] **Step 7.5 — truncated category labels.** Measured via
  `scrollWidth > clientWidth`: at 1920, "Recently added", "Timing & Direction"
  and "Max turn intensity" are ellipsised; at 3840 it is six labels
  ("Starting letter", "Start position", "Recently added", "Timing & Direction",
  "Max turn intensity", "Collections"). Austen's punch list said "make sure
  things are readable" — an ellipsised category name fails that. All eleven
  labels must render in full at every tier. Options: fewer catalog columns, a
  wider left column, tighter tile padding, or a shorter label where the domain
  allows. NOT a smaller font.

  Fixed by letting the label WRAP instead of ellipsing (`white-space: normal`
  + `overflow-wrap: break-word` on `.mini-tile.catalog .mini-title`), plus
  tightening the ≥2600 tier's art (3.1rem → 2.6rem) and side padding
  (1.05rem → 0.8rem) because that tier had the NARROWEST title box of all —
  95px against 1920's 100px — which broke "Collections" mid-word.
  Two lines fit inside the existing 3.4/4/5.25rem `min-height`, so the tile
  box is unchanged (measured 64px before and after at 1920).

  | Viewport | pane | columns | title box | ellipsised before | ellipsised after | mid-word breaks after |
  |---|---|---|---|---|---|---|
  | 1620 (Austen's DevTools-docked 1547px drill) | 440px | 2 | 100px | — | 0 | 0 |
  | 1920 | 440px | 2 | 100px | 3 (Recently added 110>100, Timing & Direction 137>100, Max turn intensity 132>100) | **0** | 0 |
  | 2560 | 736px | 3 | 126px | — | **0** | 0 |
  | 3840 | 736px | 3 | 95px → **117px** | 6 | **0** | 0 (longest word "Collections" 99px < 117px) |

- [x] **Step 7.6 — record, do not fix: the app does not scale at 4K@100%.**
  Measured: at a 3840 viewport `document.documentElement`'s computed font-size
  is still **16px**, because the lockstep root ramp in `src/app.css` is scoped
  to `html:has(.mkt-shell)` / `html:has(.legal-container)`. The whole app
  renders at 1080p proportions on a 4K monitor at 100% scaling — the exact
  failure `.claude/rules/4k-native-layout.md` exists to prevent. Blast radius
  is every app surface (create, browse, learn, museum, practice), so it needs
  its own spec and sweep. Leave it; report it as the recommended next project.

  Re-confirmed this session, unchanged: at a 3840 viewport,
  `getComputedStyle(document.documentElement).fontSize` is **`16px`**. Left as
  found — this is the recommended next project.

- [x] **Step 7.7 — verify + commit.** `npm run check`: 0 errors, 0 warnings.
  `npx vitest run tests/unit/browse/`: baseline failures only. Screenshot
  sweep at 1550 / 1920 / 2560 / 3840 confirming labels are whole and the
  morph paths behave. Explicit pathspecs. Do NOT push.

---

## Task 8: The filter motion system (2026-08-05)

Austen, after Task 7: *"the morph is not working as intended — when I click
Level 2 having Level 3 selected, the other cards just pop into existence
instead of showing me any sort of indication of what is happening. Let us do
another pass for solid transitions. I want the most modern, best possible,
most informative, most useful, most gorgeous animations you can bring to the
table."*

He is right, and Task 7 mis-measured its own success: it proved animations
RAN, not that they COMMUNICATED. A default 250 ms opacity fade is an
animation and reads as a pop.

### Root cause (diagnosed from the screenshots + the Task 7 closeout)

Adding Level 2 to a Level 3 rule took the grid from 11 matches in sections
`B 4 / F 16 / H 16` to 39 matches in sections `A 8 / B 4 / B 12`. Four
separate failures stack up:

1. **Only cards are named.** Section headers, section wrappers, and the grid
   container carry no `view-transition-name`, so they belong to the `root`
   snapshot — whose animation the app disables globally
   (`src/lib/shared/transitions/view-transitions.css` :26–29). Every piece of
   structure therefore SNAPS while the cards animate. When the section set
   changes (as it does on almost every filter change) that snap is most of
   what the eye sees.
2. **Entering cards get the UA default fade only.** No scale, no offset, no
   designed curve. Task 7 closeout, Step 7.4: *"every card group uses the
   browser default 250 ms / ease."*
3. **No stagger.** Every entering card fades at the same instant, so there is
   no sense of the grid filling in — the defining quality of the motion
   Austen liked.
4. **No sequencing.** Exits, moves, and enters all run simultaneously over
   the same 250 ms, so no phase reads as distinct and nothing tells the story
   "these left, these stayed, these arrived."

### The design

Build one **filter motion system** for the results grid, in
`src/lib/shared/transitions/` beside `results-morph.ts`, expressed with the
current view-transitions feature set (all supported by the app's Chrome
target; degrade cleanly elsewhere):

- **`view-transition-class`** (Chromium 125+/137+, Safari 18.4+) — one class
  on every card, styled once via `::view-transition-group(*.seq-card)`,
  `::view-transition-old(*.seq-card)`, `::view-transition-new(*.seq-card)`.
  This is what makes a designed animation possible across N cards without
  per-id CSS. Same treatment for a `seq-section` class on section headers.
- **Name the structure.** Give section headers (and any wrapper whose motion
  the eye needs) their own names/classes so they move and fade instead of
  snapping. This is failure 1 and it is the biggest single win.
- **`view-transition-name: match-element`** (Chrome 137+) is available if it
  simplifies naming for cards; the existing `sequence-<id>` naming plus the
  claim registry also works. Executor picks, with a one-line reason.

**Three phases, deliberately sequenced** — this is what makes it informative
rather than merely pretty:

| Phase | What | Timing (starting point, tune by eye) |
|---|---|---|
| Exit | Cards leaving: fade out + settle back slightly (scale ~0.96). Fast — the eye does not need to study what is going away. | ~160–200 ms, no stagger (or a short reverse stagger) |
| Move | Cards that persist: FLIP to their new slots. This is the motion Austen already praised — preserve its character. | ~300–340 ms, overlapping the exit |
| Enter | Cards arriving: fade in + scale up from ~0.92, **staggered in reading order** so the grid fills in rather than blinking on. | ~240–280 ms each, stagger ~15–25 ms, total added stagger capped ~300 ms; begins ~80–120 ms after the exit starts |

The overlap matters: space clears, survivors travel, newcomers land. Do not
run all three in one undifferentiated 250 ms window.

**Stagger technique.** Custom properties do not reach view-transition
pseudo-elements, so `--index` on the element will not work. Two viable
routes, in order of preference:
1. `sibling-index()` inside `::view-transition-group(*.seq-card)`
   (Chrome 137+). The `::view-transition` pseudo tree makes the groups
   siblings, so this may resolve — **measure whether it actually does before
   building on it.**
2. WAAPI on the pseudo-elements after `transition.ready`:
   `document.documentElement.animate(frames, { pseudoElement:
   "::view-transition-new(<name>)", delay: i * 20 })`. This definitely works
   and is the fallback if (1) does not resolve.

Report which route you used and the evidence that decided it.

### Steps

- [ ] **Step 8.1 — reproduce and characterise the defect.** Drive Austen's
  exact case (Level 3 active, add Level 2) and capture what each element
  class does: which elements have names, which animate, which snap. A
  frame-by-frame capture (screenshot at ~60 ms intervals through the
  transition, or a WAAPI dump of every running animation with its target
  pseudo) is the evidence. Confirm or correct the four failures above before
  building.
- [ ] **Step 8.2 — name the structure.** Section headers and any snapping
  wrapper get names/classes. Re-run 8.1's capture and show the snap is gone.
- [ ] **Step 8.3 — build the motion system.** The three phases above, driven
  by `view-transition-class`, in one module beside `results-morph.ts` so
  every path that already routes through `withResultsMorph` inherits it.
  Tokens (durations/easings) come from the design system where they exist.
- [ ] **Step 8.4 — stagger.** Per the technique note above; measure route 1
  before committing to it.
- [ ] **Step 8.5 — tune by eye, not by number.** Capture the transition as a
  frame series at 1920 and read it: can you SEE what left, what stayed, what
  arrived? If a phase is invisible or the whole thing feels mushy, change the
  timing and look again. Iterate until the frames tell the story. This step
  is the deliverable — not the code.
- [ ] **Step 8.6 — the degradation paths.** `prefers-reduced-motion` gets no
  motion (an instant, correct grid). Browsers without view transitions get
  today's plain update. Below the seam nothing changes. Verify each.
- [ ] **Step 8.7 — guard the other surfaces.** The card class and any CSS
  added must not leak onto the grid tab, the sheets, the builder, or the
  shop/route morphs that already use view transitions
  (`view-transitions.css` has live `shop-*`, `module-content`, `tab-content`
  names — do not disturb them). Grep-prove the scoping.
- [ ] **Step 8.8 — verify + commit.** `npm run check`: 0 errors, 0 warnings.
  `npx vitest run tests/unit/browse/`: baseline failures only. Frame series
  for the Level 3 → +Level 2 case plus two other paths (a rule removal and a
  search). Explicit pathspecs. Do NOT push.

### Note on browser tooling

The chrome-devtools MCP server disconnected during this session. If it is
still unavailable, drive Chrome over CDP directly: the shared debug browser
is on port 9222 (`scripts/launch-chrome-debug.ps1`), and a small Node script
using the built-in WebSocket plus `Emulation.setDeviceMetricsOverride`,
`Runtime.evaluate`, and `Page.captureScreenshot` is a proven pattern in this
repo (a prior session built exactly this when the MCP dropped). Put it in the
scratchpad, not the repo. Verification is not optional because a tool
disconnected.
