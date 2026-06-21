# Pending-Turns Bar above the Option Picker

**Date:** 2026-06-16
**Status:** Approved (design)
**Scope:** Desktop construct tab only (mobile deferred)

## Problem

When building a sequence in the construct tab, the right-side option picker shows
every valid next pictograph but always at 0 turns. To build a sequence at a turn
level, the user has to add each step at 0 turns, then open the step editor and dial
turns per step afterward. There is no way to pre-set the turns for the steps you are
about to add.

## Goal

A persistent turns bar above the option picker. Two turns controls (blue + red),
turns-only (no rotation direction). It appears the moment a start position is placed
and stays for the whole build. Dialing a turn re-renders every option pictograph with
that turn applied and its end orientation recomputed. Picking an option appends it
with the turns already baked in. Turn values persist (sticky) across picks until the
user changes them.

## Non-Goals

- Mobile / swipe layout (deferred to a follow-up once desktop UX is proven).
- Rotation-direction control in this bar (each option carries its own prop-rotation
  direction in its motion data; the bar only sets turn magnitude).
- Re-filtering which options appear. Turns change how each option renders and the end
  orientation baked into a pick — not the option set (options are gated by start
  position, which turns do not affect).
- Path-shape overrides in this bar.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Sticky vs reset after a pick | **Sticky** — bar present from start-position placement, persists the whole build |
| Platform | **Desktop only** for v1 |
| Option set behavior on turn change | **Same set, re-rendered** with turns applied + end orientation updated |

## Architecture

State and the turn transform live **inside the option-picker feature** (no
cross-module wiring). The bar is a thin composition of existing primitives.

### Reuse (no fork)

- **`PropTurnsControl.svelte`**
  (`src/lib/features/create/shared/components/sequence-actions/PropTurnsControl.svelte`)
  rendered with `showRotation={false}` and no path-shape callbacks → a bare turns
  stepper (−/value/+). Requires `rotationDirection` + `onRotationChange` props by its
  interface; pass `RotationDirection.NO_ROTATION` + a noop. Wrap each in
  `PropControlPair` so the blue/red `--prop-color-rgb` theming applies (same as the
  step editor).
- **Turn→orientation transform** in
  `src/lib/shared/create/services/turn-pattern-manager.ts` (`applyTurnToMotion` /
  `createUpdatedMotion`, lines ~363–536): the canonical "apply turns → auto rotation
  direction from context → recompute end orientation, with float edge handling" logic.
  Currently private to that file.

### Create

1. **`apply-turns-to-motion.ts`** (shared, alongside `turn-pattern-manager.ts`)
   Extract the private `applyTurnToMotion` / `createUpdatedMotion` / `findRotationContext`
   logic from `turn-pattern-manager.ts` into a pure, exported helper. Refactor
   `turn-pattern-manager.ts` to import it (removes the would-be duplicate — honors
   never-hand-roll). Add a convenience:
   ```ts
   applyPendingTurnsToOption(
     option: PictographData,
     blueTurns: number | "fl",
     redTurns: number | "fl",
   ): PictographData
   ```
   Applies the per-motion transform to `option.motions.blue` with `blueTurns` and
   `option.motions.red` with `redTurns`, returning a new `PictographData`. No
   context-step lookup is needed here (each option's `startOrientation` is already the
   previous step's end orientation); rotation context falls back to the option's own
   motion rotation direction.

2. **`PendingTurnsBar.svelte`**
   (`src/lib/features/create/construct/option-picker/components/`)
   Composition: two `PropControlPair` + `PropTurnsControl` (blue, red).
   Props:
   ```ts
   blueTurns: number | "fl";
   redTurns: number | "fl";
   onBlueChange: (delta: number) => void;
   onRedChange: (delta: number) => void;
   onReset: () => void;
   ```
   A small reset affordance sets both back to 0. Fixed-height bar.

### Edit

3. **`OptionPicker.svelte`**
   (`src/lib/features/create/construct/option-picker/components/OptionPicker.svelte`)
   - Add sticky `blueTurns` / `redTurns` `$state`, default `0`.
   - Factor `prepareWithTurns(filtered)`: map each option through
     `applyPendingTurnsToOption(opt, blueTurns, redTurns)` → `preparer.prepareBatch`.
   - Call `prepareWithTurns` in **both** the reactive prepare `$effect` (lines ~118–156)
     and the `handleSelect` fast-path prepare (lines ~182–201).
   - Add `blueTurns` / `redTurns` as dependencies of the prepare effect so a turn change
     re-renders.
   - Selection appends the already-turned option (the transform runs before
     `prepareBatch`, so the prepared option's source `PictographData` carries the turned
     motions).
   - Pass `blueTurns` / `redTurns` + change callbacks down to `OptionPickerContent`.

4. **`OptionPickerContent.svelte`**
   (`src/lib/features/create/construct/option-picker/components/OptionPickerContent.svelte`)
   - Mount `PendingTurnsBar` in the `.filter-header` region (lines ~322–344), above the
     option grids.
   - Guard to desktop: render only when `!shouldUseSwipeLayout()`.
   - Accept the new props and wire them through.

## Data Flow

```
dial blue +0.5
  → OptionPicker.blueTurns updates
  → prepare $effect re-runs (blueTurns is a dep)
  → each filtered option: applyPendingTurnsToOption(opt, blueTurns, redTurns)
        - option.motions.blue.turns = blueTurns, endOrientation recomputed
        - option.motions.red.turns  = redTurns,  endOrientation recomputed
  → preparer.prepareBatch(turnedOptions)
  → grid re-renders with turned pictographs (prop final orientation reflects turns)
pick an option
  → handleSelect → onOptionSelected(turnedOption) appends it with turns baked in
  → fast-path loads next options, prepareWithTurns applies the same sticky turns
turns persist across picks (sticky) until user changes or resets them
```

## Edge Cases / Cross-Cutting Rules

- **Float (`fl`) / static-dash at 0 turns:** the reused helper already converts `fl`→0
  where illegal (STATIC/DASH) with a warning and resolves rotation direction. No new
  logic in the bar.
- **No layout shift** (`.claude/rules/no-layout-shift.md`): `.turns-value` keeps a fixed
  `min-width` and `font-variant-numeric: tabular-nums` so `0` → `0.5` → `fl` never
  reflows neighbors. The bar is fixed-height.
- **Performance:** re-preparing all options on each turn tick costs one `prepareBatch`,
  the same as an option load. Assignment is last-write-wins, so no debounce is needed.
- **Sequence reset / start-position change:** turns stay (sticky). The user dials them
  back via the reset affordance.

## Testing

- **Unit — extraction parity:** the moved helper produces identical output to the prior
  private functions for the cases covered by `turn-pattern-manager` /
  `turns-handler.test.ts`.
- **Unit — `applyPendingTurnsToOption`:** for a known shift motion, blue=1 flips the end
  orientation radial↔nonradial as expected; red unchanged when redTurns=0.
- **Runtime:** set blue=1, assert a prepared option's end orientation changes vs 0;
  select it and assert the appended step carries `turns: 1` + the recomputed end
  orientation.

## Implementation-Verify Item

`PreparedPictographData` must retain the turned source motions so `onOptionSelected`
appends correctly. The transform runs pre-`prepareBatch`, so the prepared option should
wrap the turned `PictographData` — confirm during implementation; if `prepareBatch`
discards source motions, append the turned `PictographData` directly instead of the
prepared wrapper.

## Files

| Action | Path |
|---|---|
| Create | `src/lib/shared/create/services/apply-turns-to-motion.ts` |
| Create | `src/lib/features/create/construct/option-picker/components/PendingTurnsBar.svelte` |
| Edit | `src/lib/shared/create/services/turn-pattern-manager.ts` (import extracted helper) |
| Edit | `src/lib/features/create/construct/option-picker/components/OptionPicker.svelte` |
| Edit | `src/lib/features/create/construct/option-picker/components/OptionPickerContent.svelte` |
| Test | `src/lib/shared/create/services/apply-turns-to-motion.test.ts` |
