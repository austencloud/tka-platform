# Shape Matrix Animation Workspace — Handoff (2026-09-01)

## Mission

Complete the coordinated relationship selector and Sequence Viewer-grade
animation workspace described in
[the design spec](./2026-09-01-shape-matrix-animation-workspace-design.md).
The work removes the hidden Hands/Props driver mode, exposes all exact
flower-preserving Hand × Prop pairings, shares playback/disassembly intent
across retained canvases, and fixes portrait disassembly composition.

## Done — verified

- Relationship reachability was measured on branch
  `codex/shape-matrix-animation-workspace`. The focused Vitest run passed 8/8
  tests and swept every pro/anti × in/out pairing at 0, 0.25, 0.5, and 1 turn.
  It found six exact edges outside quarter bands and eight at quarter bands.
  Commit `b4b31ae756`; verification command:
  `pnpm exec vitest run --config tests/config/vitest.config.ts src/lib/shared/shape-matrix/services/__tests__/solve-prop-relationship-phase.test.ts`.

## Believed done — unverified

- Nothing. Existing Shape Matrix behavior mentioned below is treated as current
  source evidence until the final runtime verification pass.

## In flight

- Worktree: `E:/tka-platform-shape-matrix-animation-workspace`
- Branch: `codex/shape-matrix-animation-workspace`
- Design/task ledger and the first stable graph assertions are committed in
  `b4b31ae756`.
- The primary checkout contains unrelated `human-generator/` work and must not
  be edited, staged, reverted, or committed by this task.

## Loose ends (ranked)

1. Replace the driver UI with six canonical Hand choices plus the stable
   contextual Prop result slot.
2. Preserve old `driver=props&propMode=...` URLs while removing the driver from
   new interaction state.
3. Establish one local animation workspace and compose the canonical
   `AnimationPanel`/`ControlDock` controls.
4. Share play/pause and BPM intent across both retained crossfade players.
5. Share assembled/disassembled intent across both retained players.
6. Replace the hardcoded Shape Matrix `sidecar` layout with container-relative
   automatic stacked/sidecar composition.
7. Coordinate settings-tray, rail, picker, and disassembly motion.
8. Move physical prop selection out of the desktop header only after the dock
   covers the empty-detail state.
9. Run focused tests, full check/build gates, transition exercises, and the
   complete responsive screenshot sweep.
10. Commit with explicit pathspecs, integrate with `wt:finish`, and open the
    real `https://localhost:5173/notation/shape-matrix` route.

## Decisions already made

- On 2026-09-01 Austen approved implementation with “go.”
- Austen wants the fewest decisions possible and does not want a hidden mode
  where the app's behavior changes unexpectedly.
- Both hand and prop TnD must remain visible and all exact variants must remain
  reachable.
- A twelve-button permanent two-row control is viable but too redundant. The
  approved implementation direction is six canonical Hand choices plus a Prop
  result slot that becomes a two-choice selector only for a genuine branch.
- Sequence Viewer animation presentation capabilities belong in the Shape
  Matrix detail workspace; sequence-artifact actions do not.
- Disassembly is a stage mode and must survive category/source changes.
- Portrait containers stack the combined and solo canvases; landscape
  containers may use sidecar composition.
- Earlier loose threads remain on the design-spec checklist: cumulative level
  vocabulary with level-specific landing turns, quiet trails, solo mandalas,
  responsive H/P glyphs, carousel proximity, picker geometry, and header prop
  removal.

## Gotchas

- `ShapeMatrixDrill` intentionally retains two complete animation players for
  a readiness-gated soft crossfade. Do not replace that with keyed remounting.
- `AnimatorCanvas.externalToggleDisassemble` currently belongs to Fuse's
  external split-rendering contract; controlled internal disassembly needs a
  new backwards-compatible seam.
- Shape Matrix currently hardcodes `disassemblyLayout: "sidecar"`.
- `selectedPropMode` is currently gated by `relationshipDriver === "props"` in
  app state and URL parsing. Removing the presentation driver requires a
  compatibility migration, not merely deleting the segmented control.
- Quarter-turn arrows remain under separate visual calibration and must not be
  silently re-enabled here.
- Worktree `node_modules` is a junction to `E:/tka-platform/node_modules`. Never
  recursively delete it; allow `git worktree remove`/`wt:finish` to manage the
  task directory.
- Port 5173 belongs to Austen's primary checkout and must not be restarted or
  killed. Use an existing agent server or one free task port only after the
  resource-budget gate.
