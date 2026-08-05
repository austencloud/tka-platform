# Extend Drawer — Orientation Repeat + LOOP Color Coding

**Date:** 2026-08-05
**Status:** Approved, implementing

## Problem

Two things, one drawer.

**1. A missing extension option.** A sequence can return to its start *position*
while its props sit in a different *orientation* than they started. That sequence
is not closed — but repeating it verbatim 2, 4, or 8 times closes it, because
orientation cycles through `in → clock → out → counter`. The Extend drawer never
offers this, even though the engine already computes it.

**2. The drawer looks like output.** Every option button renders the same
`--theme-accent` gradient, so Swapped, Inverted, and Rewound are visually
indistinguishable — while sequence cards and browse filters have used a
per-primitive LOOP color scheme for months. The two surfaces disagree.

## What already exists (do not rebuild)

| Capability | Location |
|---|---|
| Orientation cycle count (1/2/4/8) | `closeOrientationCycle` — `@tka/sequence-engine/loop` |
| SequenceData adapter that applies it | `orientationCycleExtender.extendIfNeeded()` — `create/generate/circular/services/orientation-cycle-extender.ts` |
| LOOPType → primitive components | `parseLoopComponents()` — `shared/create/services/loop-type-utils.ts` |
| Per-primitive brand colors | `LOOP_ICON_COLORS` — `@tka/render-composition/loop-icons.ts` |
| Direct-LOOP eligibility | `LOOPValidator.isLOOPValidForPositionPair()` — `create/shared/services/loop-validator.ts` |

The work is wiring, not math.

## Part A — Orientation repeat as an extension option

### It is not a LOOPType

Nothing is rotated, mirrored, swapped, or inverted; the sequence repeats
verbatim. Adding an enum member would leak into `parseLoopComponents`,
`IMPLEMENTED_COMBOS`, `buildLoopSpec`, deck generation, and card rendering,
each of which would need a special case for a value that carries no
transformation. It travels as its own field instead.

### Changes

**`ExtensionAnalysis`** (`create/shared/services/sequence-extender.ts`) gains:

```ts
/**
 * Set when the sequence returns to its start POSITION but not its start
 * ORIENTATION. `count` is how many total repeats close the orientation
 * cycle. Null when orientation already closes (count 1) or the sequence
 * does not return to its start position at all.
 */
orientationRepeat: { count: 2 | 4 | 8 } | null;
```

`analyzeSequence()` computes it only when
`currentEndPosition === startPosition`, by asking
`orientationCycleExtender.getCycleCount(sequence)`. `canExtend` becomes
`available.length > 0 || orientationRepeat !== null`, so the option can
stand alone if the validator ever offers nothing.

**`OrientationCycleExtender`** gains `getCycleCount(sequence): 1 | 2 | 4 | 8`,
a non-mutating read sharing the same start-orientation resolution as
`extendIfNeeded`. Both call one private `resolveStartOrientations` helper
so the analysis and the application can never disagree.

**`ExtensionFlowCoordinator`** gains `applyOrientationRepeat(sequence)`,
returning the same `ExtensionApplyResult` shape as `applyLoop`. It routes to
`extendIfNeeded`, not `extendSequence`.

**`ExtensionFlowCoordinator.startFlow`** takes the direct path when
`availableLOOPOptions.length > 0 || analysis.orientationRepeat` — previously
LOOP options alone.

**`SequenceActionsPanel`** gains `handleOrientationRepeat()`, mirroring
`handleExtendApply` including the `EXTEND_SEQUENCE` undo snapshot.

### Presentation

Label states the outcome, since the count is known before the click:
**`Repeated ×2`** / **`×4`** / **`×8`**, with the sub-line
`Returns to <position> in-orientation`.

## Part B — Drawer UI

### Color

`parseLoopComponents(option.loopType)` decomposes any LOOPType into its
primitives; those index `LOOP_ICON_COLORS`:

| Primitive | Hex |
|---|---|
| Rotated | `#36c3ff` |
| Mirrored / Flipped | `#6F2DA8` |
| Swapped | `#2ecc71` |
| Inverted | `#eb7d00` |
| Rewound | `#00bcd4` |

- one primitive → flat tint
- multiple → 135° gradient in canonical strip order (Swapped / Inverted =
  green → orange)
- orientation repeat → `#f5c542`, defined locally in the picker

`LOOP_ICON_COLORS` is shared with MCP export rendering and locked by
`packages/render-composition/tests/loop-icons.test.ts`. A non-primitive does
not belong in it, so the orientation-repeat color lives in the picker's own
map, which imports the six and adds one.

The tint drives background wash, border, and hover glow — replacing the
uniform `--theme-accent` gradient at `LOOPPicker.svelte:200-233`. Bridge-letter
LOOP buttons get the same treatment so both halves read as one system.

### Status header

The bare `Start: / End:` row becomes a state read:

- position chips, monospace, both always rendered
- a one-line state: `Closed loop` / `Returns to beta4 after 2 repeats` /
  `Ends at beta4`

Sized with a ghost-sizer against the longest variant so switching sequences
cannot shove the grid (`no-layout-shift.md`).

### Layout

Buttons stay `rem`-sized on the existing `loop-picker` container queries.
Column counts are pinned per tier rather than left to content width, and the
orientation-repeat button spans its row when it would otherwise orphan.

## Out of scope

- Bridge-finder eligibility math
- The `LOOPType` enum
- `LOOP_ICON_COLORS` itself
- The third viewer surface (`/sequence/[id]`)

## Verification

- Unit: `getCycleCount` agrees with `extendIfNeeded`'s applied count across
  in/clock/out/counter start-orientation pairs.
- Unit: `analyzeSequence` sets `orientationRepeat` only for
  same-position/different-orientation sequences.
- Visual: screenshots of the drawer at the seven required viewports
  (`visual-verification-mandatory.md`), confirming no button stretches, no
  orphan row, and the status header does not shift between sequences.
