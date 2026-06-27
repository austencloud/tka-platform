# Orientation Picker → Anchored Popover

Date: 2026-06-26
Status: active

## Problem

On the "Choose your start position" page, clicking the center of an orientation
cycler opens a full-width bottom-sheet `Drawer` with four oversized buttons. On
desktop this is grossly wide for a 1-of-4 choice and reads as a heavyweight modal
for a trivial selection.

## Decision

Replace the bottom sheet with an inline **bits-ui `Popover`** anchored above the
cycler's center button, on **all** screen sizes. The orientation cyclers already
sit at the bottom of the viewport, so a `side="top"` popover lands within thumb
reach on mobile while being compact on desktop.

bits-ui `Popover` is the codebase's canonical anchored-popover primitive (already
wrapped by `ViewerPopover`). No new primitive.

## Changes

### 1. `OrientationCycler.svelte`
- Wrap the existing `.cycle-center` button as a `Popover.Trigger` inside a
  `Popover.Root`; render the option grid in a portalled `Popover.Content`.
- Content: 2×2 grid of the four orientations (In / Clock / Out / Counter) with
  icon + label + hint, lifted from the deleted drawer.
- Positioning: `side="top"`, `sideOffset≈8`, `align="center"`,
  `avoidCollisions`, `collisionPadding≈12` (flips below when a short viewport
  can't fit above).
- Select an option → call `onOrientationChange(value)` and close the popover.
- Prev/next arrow buttons unchanged.
- Active option carries `aria-pressed`; 44px touch-target floor retained.

### 2. Delete
- `OrientationPickerDrawer.svelte`
- `state/orientation-picker-state.svelte.ts`

### 3. `CreateModule.svelte`
- Remove the `orientationPickerState` import and the `LazyMount` block that
  mounted `OrientationPickerDrawer`.

## Constraints honored

- **Portal theming:** portalled content loses ancestor CSS context, so blue/red
  theming rides on a `color-blue`/`color-red` class on the panel using the global
  `--prop-blue` / `--prop-red` tokens (self-contained — same approach
  `ViewerPopover` uses with `--chip-tint`).
- **A11y:** bits-ui owns focus management, Escape, outside-click dismiss, and
  ARIA wiring. Trigger keeps its descriptive `aria-label`.
- **Motion:** scale + fade enter/exit; `prefers-reduced-motion` disables it.
- **No layout shift:** popover is an overlay; siblings never move.

## Side effect (intended)

`OrientationCycler` is also consumed by `LoopBentoBoard` (deck releaser) and a
test page. Both currently route through the global drawer, which is only mounted
inside `CreateModule` — so the bento board's center button is presently dead.
Moving the popover inline makes the center button work in every consumer.

## Verification

- `npm run check` + build green.
- DevTools screenshot of the desktop start-position page with the popover open
  above a cycler; console clean.
