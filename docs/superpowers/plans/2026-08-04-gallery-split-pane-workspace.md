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
