# Shape Matrix Animation Workspace Handoff (2026-09-01)

## Mission

Finish and integrate the coordinated relationship selector and animation
workspace described in
[the design spec](./2026-09-01-shape-matrix-animation-workspace-design.md),
then implement the mobile continuity phase only after Austen approves that
composition.

## Work location

- Worktree: `E:/tka-platform-shape-matrix-animation-workspace`
- Branch: `codex/shape-matrix-animation-workspace`
- Durable design checkpoint commits: `b4b31ae756`, `8a47d1c018`
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

## Verified

- Focused Vitest suite: 4 files, 35 tests passed.
- Command:
  `pnpm exec vitest run --config tests/config/vitest.config.ts tests/unit/shape-matrix/shape-matrix-app-state.test.ts tests/unit/shape-matrix/shape-matrix-url.test.ts tests/unit/shape-matrix/shape-matrix-animation-state.test.ts src/lib/shared/shape-matrix/services/__tests__/solve-prop-relationship-phase.test.ts`
- The graph sweep still proves six exact Hand × Prop edges outside quarter
  bands and eight at quarter bands.
- `git diff --check` was clean before the latest test/doc checkpoint.
- A task-server runtime at 1920×1080 showed the new six-choice relationship
  presentation, contextual two-result branch, hero, H-to-P footer, control dock,
  and removed header prop control with no console errors.
- `vite build` compiled the changed Svelte client and server bundles. Project
  postbuild then stopped on the existing missing `#lineage` prerender id for
  `/notation`; the ordinary build command also requires the absent local
  `PUBLIC_GOOGLE_MAPS_API_KEY`.
- The one allowed project `check:fast` capture contained 965 unrelated baseline
  errors. Do not rerun the full check in this turn.

## Approval still needed

### Relationship help copy

The existing About text still describes choosing Hands versus Props. Proposed
replacement:

> Choose a hand timing and direction. The prop result follows automatically.
> When the selected flowers support two exact prop phases, both choices appear
> so you can pick the result you want.

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

## Remaining work in order

1. Receive explicit approval for the help copy and mobile continuity phase.
2. Implement the approved compact turn tray and shared-mandala transition.
3. Add focused state/motion tests for turn edits that remain in detail and for
   unique shared-element ownership.
4. With browser-test permission, complete the screenshot sweep at 375×667,
   960×412, 820×1180, 1440×900, 1920×1080, 2560×1440, 3840×2160, and 200%
   zoom. Exercise assembled/disassembled category changes and settings trays.
5. Fix task-owned regressions found by that sweep. Treat the documented
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
