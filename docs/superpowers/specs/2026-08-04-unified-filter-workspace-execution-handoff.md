# Unified Filter Workspace — Execution Handoff (2026-08-04, session 2)

## Mission

Executed both stages of the 2026-08-04 handoff: stage 1 (Match any/all
connectives + grouped rule-strip sentence) and stage 2 (the builder's filter
interaction layer becomes THE gallery filter workspace), per the approved
spec [2026-08-04-unified-filter-workspace-design.md](2026-08-04-unified-filter-workspace-design.md)
and plan
[2026-08-04-unified-filter-workspace.md](../plans/2026-08-04-unified-filter-workspace.md)
(ledger updated with per-task commits).

## Done — verified (all on `main`, pushed)

- **Stage 1 connectives** — `a0c9b8376a`. `FilterConnective` ("any"/"all")
  for LOOP_TYPE + TND_FAMILY: engine state (`connectives`, `setConnective`,
  persisted), `SmartFilterSpec.connectives` (Firestore-safe), migration
  (legacy ≥2 stacked entries → "all"), Match any | Match all
  SegmentedControl in both editors (default **any** — stacking widens in
  all eight categories), and the shared grouped rule strip
  (`FilterRuleStrip.svelte` + `filter-rule-groups.ts` — "Level: 2 · LOOPs:
  Mirrored or Swapped", chip body = edit, × = remove, redundant category
  prefixes trimmed). Evidence: 11 unit tests; live builder counts 45↔13
  (LOOPs any/all) and 183↔10 (families); screenshots at 7 viewports.
- **Migration test** — `48f95de304`. Legacy bare-type persisted keys load,
  apply, remove; legacy stacked LOOPs resolve "all".
- **Gallery workspace** — `ca5f763618`. BrowseModule's drill = in-page
  workspace: toggle-in-place, no bounce, pinned strip (count + grouped
  sentence + View N results + Save→SmartCollectionSaveDialog), editorial
  landing PRESERVED (no unified flat chooser; stability latch keys off
  `onToggleValue`; catalog rail only beside value editors). Persisted rules
  survive into the workspace; grid Back keeps the rule.
- **Complete option sets** — `b842e34efc`. All noise floors gone
  (length ≥3 + five zero-count filters); zero-count options dim everywhere.
- **Fork deletion** — `c2165ac19e`. `progressiveSecondaryChoices`, the More
  door, the screen-more hub, returnSection plumbing, ~600 CSS lines. Grep
  count: 0.
- **Sheet retirement (desktop)** — `4c36bccc5b`. Gallery Filters pill →
  workspace on desktop; `GalleryFilterSheet` mounts phone-only in
  GalleryTab (marked `TODO(phone-sheet-feel)`). AllLibraryView keeps its
  sheet — no workspace surface there; not in the spec's consumers table.
- **AddSequencesSheet** — `bcb10e9430`. Same workspace contract inside the
  sheet (strip + View N results + connectives + editor-seed on chip edit).
- **Whole-project verification** — browse suite: 68 pass, failures = the
  pre-existing baseline only (two protobufjs import failures +
  `browse-engine-solo-load-race` which fails on HEAD — proven by swapping
  HEAD files in). Full `npm run check`: **0 errors, 0 warnings**.
  **Production save walk landed**: gallery strip → Save → dialog → toast
  `Smart Collection "Level 2" saved.` — that collection now exists in
  Austen's library (keep or delete).

## Loose ends (ranked)

1. **Phone-sheet feel test** (spec decision 3): on a real phone, decide
   whether GalleryFilterSheet stays or the phone also uses the in-page
   workspace. Two `TODO(phone-sheet-feel)` markers in GalleryTab.svelte.
   Until decided, the drill's builder flags cannot collapse to defaults
   (the sheet mounts flagless).
2. **Pre-existing landing bug (NOT from this work — proven by removing the
   new flags and re-screenshotting):** the Grid mode mini-tile's
   LessonGridDisplay renders as a huge floating square over the "More ways
   to browse" header at ≥1920 widths. Visible in every desktop screenshot.
   One targeted fix in the chooser's `.mini-art` sizing.
3. **BrowsePanel sparse-results pass** (spec fast-follow): complete option
   sets make 1-match dead-ends reachable ("24 steps (1)").
4. **File split fast-follow**: GalleryDrill is 6,232 lines post-deletion;
   landing vs workspace CSS halves are nearly disjoint now.
5. **maxTurnIntensity stops** still filter `count > 0` (slider stops vanish
   when narrowed) — mild stable-option-sets violation, deliberately left.
6. AddSequencesSheet **selection tap** unexercised (writes real membership);
   walk it when convenient.

## Gotchas for the next session

- The Chrome DevTools MCP disconnected mid-session; verification ran
  through a scratchpad CDP driver (`cdp.mjs` — Node built-in WebSocket,
  PUT /json/new, Emulation.setDeviceMetricsOverride, webp screenshots,
  closes only its own tab). Pattern works; rebuild it if the MCP is still
  down (scratchpad is session-scoped).
- Browse tab restore fights programmatic module switches: clicking the
  "Gallery" nav from another tab sometimes snaps back (two persisted nav
  states sync against each other). Retry-until-visible was needed in every
  drive script. Pre-existing behavior; worth a look someday.
- All 2026-08-03 handoff gotchas still apply (110% localhost zoom → emulate
  ×1.1; `:global()` one selector; :5173 never restarted).
- The `$effect.root` test helper does not run its callback in the node test
  build — `browse-engine-solo-load-race` fails on HEAD for this reason; the
  migration test calls the factory directly.

## Decisions made this session (within spec authority)

- Editorial landing kept by NOT passing `unifiedFilterChooser` to the
  gallery; stability latch generalized to any `onToggleValue` host.
- Catalog rail hidden on the chooser screen for non-unified hosts (the
  landing IS the catalog).
- `valueDisabled` (dimmed zeros) now applies in onApply flows too — a tap
  that can only land on an empty grid is a dead end everywhere.
- Gallery mount-time filter clear removed — the strip makes persisted
  rules visible, which was the original reason for clearing.
