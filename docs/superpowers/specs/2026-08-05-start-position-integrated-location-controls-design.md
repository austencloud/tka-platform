# Integrated Start Position Controls

**Date:** 2026-08-05
**Status:** Approved for implementation

## Problem

The Start Position editor exposes orientation controls inside the Blue and Red
cards, while sequence-wide location changes live in a separate repositioning
row. The two properties belong to the same prop, but the interface presents
them as unrelated actions.

## Decision

Each prop card contains two matching control rows:

1. **Location** changes that prop's location through the full sequence.
2. **Orientation** keeps the existing orientation cycle and choice grid.

Both rows use the same left arrow, current value, and right arrow pattern. The
standalone **Reposition sequence** row is removed. A single message above the
cards states: **Changes here update every step.**

## Location Interaction

- The left arrow rotates the selected prop one 45-degree step
  counterclockwise through the sequence.
- The right arrow rotates it one 45-degree step clockwise.
- The value follows the perimeter cycle
  `N → NE → E → SE → S → SW → W → NW`.
- Selecting the current location value arms that prop on the large placement
  grid. Choosing a destination there applies the shortest signed rotation.
- Each arrow press and each direct destination choice creates one undo action.
- While a transform is running, both cards are temporarily disabled to prevent
  overlapping edits.
- Location controls are unavailable when either prop is at center because a
  rotation cannot move a prop into or out of center.

## Reuse and Scope

- Extract the existing three-part orientation stepper into a shared
  `PropCycleControl` presentation component.
- Keep `PropOrientationControl`'s current public behavior and choice grid, but
  render its normal state through the shared control.
- Add a small `PropLocationControl` adapter for location labels, accessible
  names, armed state, and clockwise/counterclockwise callbacks.
- Update `StartPositionEditMode` to place Location and Orientation inside each
  `PropControlPair` card.
- Extend `StepEditorPanel` only at the existing sequence-transform boundary.
  Do not add a second transform service.
- The interactive placement board renders the same start-position data as the
  workspace tile. It preserves the Start label, notation glyphs, and the grid
  mode derived from both props instead of constructing a reduced substitute.
- Keep the placement board mounted across sequence transforms so prop position
  changes use the renderer's existing movement transition. Explicit resets use
  a reset signal and must not depend on replacing the component.

## Accessibility and Layout

- Every arrow and value remains a native button with a specific accessible
  name.
- The armed location value uses `aria-pressed` and a visible ring that does not
  alter layout.
- Interactive targets remain at least 44px.
- Field labels and helper text use the 14px essential-text tier.
- Compact and stacked layouts preserve the same control order and do not hide
  functionality.
- Reduced-motion preferences remove scale and fade animation.

## Verification

- Unit tests cover the clockwise/counterclockwise location cycle, wraparound,
  and center behavior.
- Existing multi-step sequence transform tests continue to prove one transform
  call for direct placement.
- TypeScript and Svelte checks cover the extracted component API and all
  callers.
- Visual inspection covers desktop, short-wide, tablet, and narrow-phone
  layouts once browser interaction is authorized.
- Visual inspection compares the workspace and editor previews for matching
  Start labels, notation glyphs, and mixed-grid geometry, then confirms a
  location step produces intermediate prop positions before reaching its target.
