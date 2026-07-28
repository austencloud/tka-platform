# Start Position: Terminology, Empty State, and Drag-to-Aim

**Date:** 2026-07-27
**Status:** Approved, implementing

## Problem

Empty Construct opened with two stacked offers — a "Make your first sequence"
card (title, sub, two buttons) directly above the start-position picker's own
heading and method toggle. Two headings, two button pairs, one screen, and no
clear first move.

The copy also used "pose", which is not TKA terminology. The domain, the state
module, the manager, and the data field all say **start position**. "Pose"
was grafted on top of a codebase that already disagreed with it.

Separately, building a custom start position was click-to-place only: click to
put the blue prop down, click to put the red prop down, then hunt for the
orientation cyclers below the grid to aim them. Placement and orientation were
two disjoint interactions for what is one physical act.

## Decisions

### 1. "Pose" becomes "position" everywhere

| Surface | Before | After |
|---|---|---|
| Picker heading | Choose or build your start pose | Choose your start position |
| Method toggle | Presets / Build a pose | Presets / Build |
| Apply button | Use this pose | Use this position |
| Grid prompt | Place the blue prop | Press a point and drag to aim the blue prop |
| Completion | Pose ready | Position ready |
| Tutorial | Choose a start pose | Choose a start position |

Symbols follow the copy: `BuildStartPose.svelte` → `BuildStartPosition.svelte`,
`StartPosePath` → `StartPositionPath`, `update-sequence-start-pose.ts` →
`update-sequence-start-position.ts`, tutorial stage `start-pose` →
`start-position`, `recordStartPose` → `recordStartPosition`.

**Deliberate exception:** the PostHog wire names
(`construct_start_pose_path_selected`, `_completed`, `_cancelled`) keep their
old spelling. Renaming them severs continuity with funnel data already
collected. The code symbols rename; the event strings carry a comment saying
why they did not.

### 2. The picker is the page

`StandardWorkspaceLayout` renders the first-session starter *below*
`CreationToolPanelSlot` instead of above it, using a new compact variant of
`GenerateEmptyState` — one secondary action, no title, no sub, no dismiss.

The dismiss button ("Build from scratch") is deleted rather than moved. The
picker underneath it *is* building from scratch, so the button offered a choice
the page already presented. The offer unmounts on its own once the workspace
fills.

Result: one heading, one method toggle, the α/β/γ grid, and a quiet
"Generate one for me" at the bottom.

### 3. Press and drag to aim

**The prop's render angle is the drag angle.** Press a grid point, drag away
from it, and the prop points where you dragged. Release commits.

Grounding: `prop-rot-angle-manager.ts` is the canonical source for prop
rotation. COUNTER at EAST renders at 270°, and the file's own stated SVG
convention is `0=east, 90=south, 180=west, 270=north`. So dragging from the
east point toward north yields counter — which is the behavior requested,
confirmed at the base layer rather than inferred.

New pure module `src/lib/shared/pictograph/grid/domain/orientation-from-drag.ts`:

```
orientationFromDrag({ location, gridMode, dx, dy }) → Orientation | null
```

It derives its snap targets by calling `PropRotAngleManager.calculateRotation`
for each of `IN`, `OUT`, `CLOCK`, `COUNTER` at that location, then picks the
nearest by angular distance. It does **not** hardcode a second angle table.
Consequences: the snap can never drift from what the renderer draws, and box
mode plus intercardinal locations work with no additional code.

Returns `null` inside the dead zone (60 SVG viewBox units) and at
`GridLocation.CENTER`, where radial orientation is meaningless.

#### Gesture

- **pointerdown** on a point places the prop there immediately — identical to
  today's tap — and captures the pointer.
- **pointermove** measures the vector from the *grid point's own coordinates*,
  not from where the finger landed, so a sloppy initial press does not skew the
  angle. Inside the dead zone the orientation holds at its current value. Past
  it, it snaps 4-way and the prop rotates live under the finger.
- **pointerup** commits through `onOrientationChange(color, orientation)` and
  advances to the other hand.

A tap with no drag is unchanged from today: the dead zone means orientation is
never touched. Nothing regresses for tap users.

Because a real pointer interaction fires both `pointerdown` and `click`, the
click handler is suppressed for any placement already handled by the pointer
path. Keyboard Enter/Space continues to route through `handlePointSelect`
directly.

During a drag, four faint ticks radiate from the point with the snapped one
lit, so the gesture is discoverable rather than hidden. `touch-action: none`
on the hit targets stops the page scrolling under the drag on mobile.

Once both props are down, pressing an occupied point grabs that prop directly
for re-aiming, with no "Move blue" round trip first.

#### Live preview

`PropPlacementGrid` holds a `pendingOrientation` during the gesture that
overrides the incoming prop for the dragged color. It is cleared by an effect
once the parent's committed value matches, which avoids a one-frame snap-back
between release and the parent's state propagating down.

#### Blast radius

`PropPlacementGrid` is shared with Learn. The gesture activates only when an
`onOrientationChange` callback is supplied, and Learn's placement lessons do
not supply one, so Learn is untouched by construction rather than by a flag.

The orientation cyclers stay below the grid as the live readout and the
keyboard path, updating as the drag proceeds.

## Tests

Unit tests on the pure snap module: east+north→counter, east+west→in,
east+east→out, east+south→clock, a box-mode intercardinal, the dead zone, and
`CENTER` returning null. Existing component tests asserting "Build a pose" and
"Pose ready" are updated to the new copy.

## Verification

Screenshots at 1920, 2560, 3840, 1440, 820×1180, 960×412, and 375×667 per
`visual-verification-mandatory.md`, since this changes layout and element count
on a public surface.
