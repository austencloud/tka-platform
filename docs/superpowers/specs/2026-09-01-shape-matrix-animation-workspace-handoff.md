# Shape Matrix Animation Workspace Handoff (2026-09-01)

## Mission

Finish and integrate the coordinated relationship selector, animation
workspace, and approved release-boundary pass described in
[the design spec](./2026-09-01-shape-matrix-animation-workspace-design.md),
then implement the mobile continuity phase only after Austen approves that
composition.

## Work location

- Worktree: `E:/tka-platform-shape-matrix-animation-workspace`
- Branch: `codex/shape-matrix-animation-workspace`
- Durable design and implementation checkpoints: `b4b31ae756`, `8a47d1c018`,
  `dead6c994e`, `0671ead0b7`
- The primary checkout has unrelated `human-generator/` work. Do not edit,
  stage, revert, or commit it.

## Implemented in the uncommitted workspace

- The persistent Hands/Props driver is gone. Hands is the canonical six-choice
  row and Prop result is passive for one exact result or selectable for a real
  two-phase branch.
- Legacy `driver=props&propMode=...` URLs still restore the exact edge. New URL
  writes retain only the disambiguating prop mode.
- `ShapeMatrixDrill` composes the canonical animation panel and bottom control
  dock for Prop, Effects, Effort, Playback/BPM/mode, Display, and play/pause.
- The redundant desktop header prop selector is gone.
- One feature-local animation workspace owns play intent, BPM, playback mode,
  effects, the active tray, and the assembled/disassembled stage target.
- Both retained crossfade players consume the same presentation intent.
- Disassembly closes an open tray before changing the stage and persists across
  Shape Detail category changes.
- Automatic disassembly composition stacks square/portrait containers and uses
  a sidecar only for genuinely landscape containers.
- The initial trails are one additional notch quieter and use right-end
  tracking without creating undo history during workspace initialization.
- The old Prop result row and Hands-to-Props footer are now one full-width
  relationship bridge under the six Hand choices. Deterministic results fill
  the Prop half; genuine phase branches retain two equal choices.
- The pane header is an explicit `Element relationships` return control. Only
  the relationship workspace or one animation-settings workspace is visible at
  a time, and the header names the active settings destination.
- Props opens the canonical `PropSelectionSheet`, which is a right drawer on
  side-by-side layouts and a bottom sheet on phone layouts. The catalogue is no
  longer compressed into the dock tray.
- Play/pause occupies the dock's compact trailing slot. The duplicate full-row
  action is gone.
- Shape Matrix uses the canonical Arc policy for Shift. The ordinary Shape
  Matrix and Sequence Viewer panels hide experimental path-shape controls,
  while Arc, Linear, Concave, and By Motion remain available to future study
  surfaces. Dash animator behavior was not changed; it is already linear.
- The About dialog and accessible pane label now describe the canonical Hand
  selection and derived Prop result.

## Verified

- Focused Vitest suite: 5 files, 51 tests passed.
- Command:
  `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/animation-panel/pill-resolution.test.ts tests/unit/shape-matrix/shape-matrix-app-state.test.ts tests/unit/shape-matrix/shape-matrix-url.test.ts tests/unit/shape-matrix/shape-matrix-animation-state.test.ts src/lib/shared/shape-matrix/services/__tests__/solve-prop-relationship-phase.test.ts`
- The graph sweep still proves six exact Hand × Prop edges outside quarter
  bands and eight at quarter bands.
- `git diff --check` was clean before the latest test/doc checkpoint.
- The task server at port 5175 verified the unified relationship bridge,
  settings-to-relationship header return, responsive Prop drawer/sheet, compact
  Pause action, and Playback tray without Motion paths. Checks covered the
  375×667, 960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, 3840×2160,
  an effective 200% layout, and Austen's level-four Fan URL. The current console
  contains no application errors; only the expected local PostHog-key warning
  remains.
- `vite build` compiled the changed Svelte client and server bundles. Project
  postbuild then stopped on the existing missing `#lineage` prerender id for
  `/notation`; the ordinary build command also requires the absent local
  `PUBLIC_GOOGLE_MAPS_API_KEY`.
- The one allowed project `check:fast` capture contained 965 unrelated baseline
  errors. Do not rerun the full check in this turn.

## Approval still needed

### Mobile continuity phase

Austen proposed editing individual hand turn values from the compact detail
screen and a reversible shared-element transition between the selected matrix
mandala and the hero. Repository tracing supports this composition:

1. Replace the static compact summary with a turn trigger that exposes Blue,
   Red, and Both targets plus the current cumulative turn choices.
2. Reuse `ShapeMatrixAppState.setActiveAxis`, `setTurn`, `setLabelMode`, and
   `updateSelectedPairTurns`; add a stay-on-detail seam instead of duplicating
   matrix state.
3. Establish one reusable mandala artwork primitive used by the grid tile and
   hero cold floor.
4. Use the canonical claimed native view-transition name for tile-to-hero and
   hero-to-tile motion. Claim only the active endpoint because compact
   PanelGroup retains both panes.
5. Keep `AnimatorCanvas` as the moving renderer and crossfade from shared
   artwork only when the animator is ready.

This produces the visual continuity of one object without physically
reparenting a live canvas between two layout owners.

## Implemented release boundary

Austen approved the following connected composition changes:

1. `PropRelationshipChipRow` now owns one full-width relationship bridge
   beneath the six Hand choices. Its Prop side is a centered passive result for
   one edge and two equal buttons for a genuine phase branch. `Derived` and the
   duplicate hero caption are gone.
2. The Props tab now routes through the existing `PropSelectionSheet`, which
   opens as a bottom sheet on narrow layouts and a right drawer on side-by-side
   layouts. Play/pause occupies the dock's compact trailing slot instead of a
   separate full-width row.
3. Motion paths are hidden from the ordinary release surface. MCP ground truth says
   Shift uses a curved arc for both Pro and Anti, Dash is straight, and Static
   does not travel. The current `By Motion` policy maps Anti to Concave and
   therefore conflates prop rotation behavior with hand-path geometry. Public
   playback should use Shift→Arc, Dash→Linear, Static→no path; arbitrary Arc,
   Linear, Concave, and experimental topology work belong in a study/lab.

The renderer still owns all experimental path values so they can support a
future study and nomenclature page. The existing multi-grid package composes
diamond, box, and skewed grids. It does not yet model Austen's three-, five-,
six-, or ten-point nomenclature, so that work remains a separate
topology/enumeration specification rather than a playback toggle.

## Remaining work in order

1. Receive explicit approval for the mobile turn editor and shared-mandala
   transition.
2. Implement the approved compact turn tray and shared-mandala transition.
3. Add focused state/motion tests for turn edits that remain in detail and
   unique shared-element ownership.
4. Exercise assembled/disassembled category changes through the remaining
   mobile continuity work.
5. Fix task-owned regressions found by that phase. Treat the documented
   `#lineage`, Maps key, and global check failures as baseline unless this diff
   is proven to cause them.
6. Commit only explicit task paths, bring the branch current with `main`, run
   `npm run wt:finish -- codex/shape-matrix-animation-workspace --route
/notation/shape-matrix` from the primary checkout, and report any safety
   gate that prevents integration.

## Gotchas

- `ShapeMatrixDrill` deliberately retains two animation players for its
  readiness-gated crossfade. Do not replace them with keyed remounting.
- `AnimatorCanvas.externalToggleDisassemble` belongs to Fuse's external split
  rendering contract. Preserve it while using the new controlled internal
  disassembly seam.
- Compact PanelGroup keeps both matrix and detail DOM mounted. A shared view
  transition name cannot exist on both endpoints at once.
- Grid cells currently display cached SVG data URLs from `renderCell`; the hero
  cold floor uses a separate canvas and `drawAlignedMandala`. Consolidate their
  artwork primitive without creating a second animation renderer.
- The current compact `setTurn` path forces `activeView = "matrix"`; detail-side
  editing needs an explicit stay-in-detail path.
- Port 5173 belongs to Austen's primary checkout and must not be restarted or
  killed.
- Worktree `node_modules` is a junction to the primary checkout. Never delete
  it recursively.
