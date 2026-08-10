# Start-Position Location Motion — Design (2026-08-10)

Implemented same-session; recorded here for the record per the conversation-first
spec workflow. Follow-up to the same-day step-editor fixes (grid-mode gating of
the rotate arrows, `cf61a48650`).

## What it does

When a rotate arrow changes a start-position location in the step editor, the
placement grid plays the move instead of snapping:

- The moving prop travels a **pro-with-zero-turns arc** around the grid center
  (s→w along the pathway, staff angle locked to the direction of travel), in
  the direction of the arrow that was tapped.
- The partner prop **glides out of (or into) its beta offset** when the move
  departs from or lands on a shared location.

Triggers: **rotate arrows only.** Drag placement already has physical motion
from the finger, and preset taps are a wholesale swap — both still snap.

## How it works

The sequence data commits exactly as before (undo, persistence, workspace
tiles untouched); the animation is pure presentation inside `PropPlacementGrid`.

1. `StepEditorPanel.rotateStartPositionLocation` gains an `animateFromLocation`
   arg (passed only by the arrow path). On a successful rotation it publishes an
   epoch-counted `PlacementMotionMove` prop to the grid — same pattern as the
   existing `resetEpoch`.
2. `createPropPlacementMotionState`
   (`src/lib/shared/pictograph/grid/state/prop-placement-motion.svelte.ts`)
   watches the epoch, builds the transition via `buildPlacementTransition`
   (`prop-placement-view-model.ts`), and drives an eased
   (`cubicInOut`, `DURATION.dramatic`) rAF loop.
3. During the animation the grid feeds `PictographContainer`:
   - `pictographData` = a synthetic step: moving prop `PRO, turns 0,
     from→to, rotationDirection = tapped arrow, pathShape: "arc"` (forced so
     the global path-shape setting can't flatten it); partner static.
   - `motionStartData` = the old static pictograph; `motionProgress` = eased t;
     `arrowOpacity` = 0 (no pro arrow flash).
   This rides the container's existing `calculatePictographMotionPositions`
   seam: it lerps the correction between the engine's raw arc and the prepared
   (beta-inclusive) endpoint poses, so the beta-offset glide falls out of
   existing math — no new beta code.
4. Progress 1 is defined to be pixel-identical to the prepared end pose, and
   the transition step's own prepared positions ARE the end poses, so dropping
   back to the static render cannot jump.

Details: `prefers-reduced-motion` snaps instantly; a tap mid-flight snaps the
current move to its end and plays the next (chaining); the board ignores
pointer input while animating (`.grid-wrapper.animating`) because drag aiming
reads live DOM transforms.

## Alternatives rejected

- Driving `PropSvg`'s incidental CSS transform transition — interpolates the
  transform linearly, so the prop cuts the chord instead of arcing.
- A ghost-prop overlay SVG — duplicates prop rendering the real pipeline owns.

## Verification (2026-08-10)

Chrome DevTools rAF sampling of live `PropSvg` transforms at 390×844 and
1440×900:

- n→e clockwise: blue passed (550,367)→(592,401) — on the circle through NE,
  ~45px off the chord; staff 0°→90° in lockstep; landed exactly (618.1, 475).
- Beta exit and entry both directions: partner glided (475,310.8)↔(475,331.9)
  smoothly while the mover arced.
- ~320ms eased motion at 60fps; final frames pixel-identical to static render;
  console clean; `svelte-check` 0 errors; unit tests
  `tests/unit/prop-placement-transition.test.ts` pass.

Known constraint: background tabs get throttled rAF, so the animation
effectively skips there — irrelevant for real use (the user is looking at the
tab they're tapping).
