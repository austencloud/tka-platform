# QfT One Surface implementation plan

**Date:** 2026-08-09
**Design:** `docs/superpowers/specs/backlog/2026-07-31-qft-one-surface-design.md`
**Target:** `/notation/qft`

## Outcome

Replace the route's Guide, Knobs, and Combine modes with one app whose only
mode switch is hand count. One hand and two hands use the same motion model,
stage, notation table, transport, layer controls, and session owner.

The route should become a small entry point. A future task about playback,
one-hand controls, two-hand timing, archival material, or responsive chrome
should load one named owner instead of the current 2,999-line page.

## Canonical owners

- `qft-trajectory.ts` owns variable-rate hand motion. It already integrates an
  eight-rate profile, draws continuous poses and traces, identifies reversals,
  and produces notation rows. Extend it with hand phase and scalar-knob
  conversion instead of adding another `QftHand` implementation.
- `qft-model.ts` remains the published scalar model and source-table contract.
  Its bespoke pendulum helpers retire after every consumer moves to the
  trajectory owner.
- `qft-session.ts` owns validation and the v2 to v3 session migration.
- The route state factory owns reactive app, hand, playback, layer, dock, and
  panel state. Context distributes it to route descendants.
- Route components own their markup and scoped CSS. No shared layout utility
  sheet will replace component ownership.

## Spec correction found during implementation audit

The active design says seven canonical moves are reachable through the flower
picker. The current bridge maps flower turns to `2 * turns + 1`, while the
Triquetra preset uses a rate magnitude of 2. Triquetra therefore remains a
canonical preset even though it is not a flower-picker value. Presets are
first-class inputs, not labels inferred from the current flower.

## Delivery sequence

1. Extend `QftTrajectory` with optional hand phase, add conversion helpers for
   scalar knobs and the pendulum rate profile, and prove both against the
   existing published-table tests.
2. Move guide entries onto trajectories. Preserve their source frames,
   attribution, order, and factual labels.
3. Add a v3 session shape with one-hand/two-hand mode, both hand motions,
   selected flowers or presets, timing, cursor, playback, layers, and entry
   state. Migrate valid v2 payloads without trusting stored fields.
4. Add the QfT state factory and context. Compose motion, persistence,
   responsive layout, background loading, and panel state as named
   sub-factories where each has its own lifecycle.
5. Build route-specific shell, one-hand surface, two-hand surface, controls,
   landing, archive panel, information panel, and transport chrome. Reuse the
   existing shared primitives listed above.
6. Delete the unreferenced guide pane after a repository-wide reference check.
   Keep the scalar pendulum adapter while the QfT test route still consumes it;
   the production app now uses the trajectory owner.
7. Mark generated Level 1 proof text and generated mandala catalogs as audited
   scanner artifacts, then rerun the monolith scanner against the new route
   boundary.

## Verification contract

- Unit tests cover scalar-to-trajectory parity, pendulum and extendulum
  notation, hand-phase behavior, reversal validity, and v2 session migration.
- Existing QfT model, trajectory, bridge, and diagram-contract tests remain
  green under the repository Vitest config.
- Final TypeScript/Svelte checks and lint pass with captured output.
- Runtime checks cover entry focus, both hand-count modes, preset and flower
  changes, per-hand radius, timing, transport, layers, dock trays, archive and
  information panels, reload persistence, and reduced motion.
- Visual checks cover 1920x1080, 2560x1440, 3840x2160, 1440x900, 820x1180,
  960x412, and 375x667 using the task-owned Chrome tab.

## Merge contract

Commit only the paths listed by this plan on `codex/qft-one-surface`. Merge the
verified commit into the primary checkout's `main` without staging, reverting,
or overwriting any unrelated dirty paths. Remove the worktree and branch only
after the merge commit contains every task-owned path.

## Completion evidence

- The route entry point is 13 physical lines, down from 2,999 physical lines.
  The largest extracted route component is the 302-physical-line app-shell
  composition root, which the scanner records as audited.
- Six focused Vitest files pass: 68 tests covering the published model,
  trajectory parity, all 864 flower/mode realizations, v2 migration, selection
  validity, and diagram contracts.
- Full `svelte-check` reports 0 errors and 0 warnings. Scoped ESLint and
  Stylelint report no code or style errors. `git diff --check` is clean.
- Chrome runtime verification covers One hand, Two hands, Triquetra selection,
  Quarter/Opp timing, the mobile notation tray, archive and About dialogs, and
  v3 persistence after reload. The console has no application errors.
- Screenshots were inspected at 1920×1080, 2560×1440, 3840×2160, 1440×900,
  820×1180, 960×412, and 375×667. The phone sweep found and corrected an empty
  inherited grid row; the corrected stage fills the available height.
