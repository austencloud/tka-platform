# Start Position Sequence Repositioning

**Date:** 2026-08-05
**Status:** Superseded by
[`2026-08-05-start-position-integrated-location-controls-design.md`](./2026-08-05-start-position-integrated-location-controls-design.md)

The sequence-transform and direct-placement contracts below remain valid. The
separate reposition row was replaced by Location controls inside each prop card.

## Problem

Selecting the start position opens the Step Editor, but that surface only lets
someone aim each prop. Changing a prop's grid location requires leaving the
editor, opening Sequence Actions, selecting one hand, and applying Rotate one
or more times.

Clearing the sequence and choosing another start position discards useful work.
Editing a middle step's location is also the wrong model because the location is
shared by the transitions on either side of that step.

## Decision

The start-position Step Editor gains a contextual **Reposition Sequence**
control. Sequence Actions keeps its existing Rotate controls as the global
transform surface. Both entry points call the same sequence transform.

The existing drag gesture keeps one meaning: aim the selected prop. Moving a
prop uses an explicit **Move left** or **Move right** button followed by a click
or tap on the destination point. This preserves the approved drag-to-aim
interaction and gives the move action a non-drag pointer path.

Helper copy:

> Move either prop to update its path through every step.

The operation updates the chosen prop's locations across the full sequence,
re-derives affected letters, and remains one undo action. It does not open a
confirmation dialog because no work is discarded.

## Reuse

- Extend `StepEditorPanel.svelte` and `StartPositionEditMode.svelte`.
- Reuse `PropPlacementGrid.svelte`, including its existing `moveProp` method and
  placement callbacks.
- Reuse the Create module's `rotateSequence` state operation and
  `sequenceTransformer.rotateSequence` implementation.
- Extend `rotation-helpers.ts` with a pure location-to-rotation calculation.
- Do not create a second transform service or a new placement component.

## Interaction

1. Select the start-position card.
2. Choose **Move left** or **Move right** under **Reposition Sequence**.
3. The selected prop's valid destination points become available in the grid.
4. Click or tap a destination.
5. The full signed rotation is applied once to the selected prop across the
   sequence.
6. The transformed start position remains selected and the Step Editor stays
   open.
7. Undo restores the entire sequence in one action.

Pressing and dragging an occupied point still aims that prop. Clicking its
current point produces no transform. When either prop is at the center, sequence
repositioning is unavailable because rotation cannot move a prop into or out of
the center. The controls are disabled with explanatory accessible labels.

## State and Transformation Contract

`rotateSequence` accepts a positive step count in addition to direction and
target hand. Existing callers continue to default to one 45-degree increment.
The contextual editor calculates the shortest signed rotation between the old
and new perimeter locations, then invokes the state operation once.

Applying one full delta matters for single-hand transforms. The existing state
path updates geometry immediately and derives letters asynchronously. Repeating
one-increment commands would create competing derivation work and more than one
undo boundary.

The placement grid is recreated from incoming start-position locations after a
successful transform. If the transform does not reach the selected destination,
the editor resets the local placement and exposes the sequence state's existing
error feedback.

## Tests

- Pure tests for shortest signed rotation: same point, clockwise,
  counterclockwise, opposite point, wraparound, and center rejection.
- State transform test proving a multi-increment single-hand rotation is sent to
  the transformer once.
- Existing transform tests continue to prove derived start/end positions and
  per-step grid-mode letter lookup.
- Component behavior is verified through the existing placement-grid contract,
  keyboard/tap operation, one undo snapshot, and visible loading/disabled state.

## Verification

- Focused Vitest files under the CI `jsdom` configuration.
- TypeScript check with errors limited to changed files.
- Visual inspection at 1920, 2560, 3840, 1440, 820x1180, 960x412, and 375x667.
- Confirm the start editor remains usable at short heights, the move buttons
  meet touch-target requirements, and no console error occurs during a move.
