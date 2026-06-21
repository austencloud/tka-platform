# Real Flow → TKA Sequence (ArUco Notation) — Design

**Date:** 2026-06-20
**Status:** Design (awaiting review)
**Builds on:** `src/lib/features/train/prop-tracking-lab/` (2D color-tracking PoC), `src/lib/features/skel2tka/`
**Relates to:** parked project `TKA Sequence Capture` (the animation half — out of scope here)

## Problem

Capture real double-staff flow on video and transcribe it into a TKA sequence —
positions, motion types, turns, AND **orientation** (radial / nonradial, in /
out). The existing `prop-tracking-lab` is a 2D single-video color-histogram PoC:
it gets a prop's screen position + 2D angle and maps to grid positions/turns
(`DerivedPictograph`). It cannot capture **roll** — orientation about the staff's
own axis — which is the thumb/pinky reference and the quantity TKA is built on
(radial vs nonradial). 2D color tracking gives a screen angle; markerless body
mocap gives a wrist point with no twist. Roll is the unsolved crux, and without
it the notation is not real TKA.

## Decision

**Single-camera ArUco 6-DOF pose** cracks roll cheaply. A printed ArUco marker
on each staff, read by `js-aruco2` (pure-JS, 100% in-browser, POSIT pose
estimation → rotation + translation from one camera), yields full 6-DOF staff
pose **including roll** per frame — no second camera, no triangulation, no
metric calibration. A reference marker at grid center defines the TKA world
frame; every staff pose is read relative to it, so position + orientation come
out directly.

Approaches considered:
- **A) Single-cam ArUco 6-DOF** ← chosen. Cheap, browser-native, solves roll.
  Cost: markers on the staves (acceptable — the performer controls the props for
  a capture session).
- **B) Two-phone markerless triangulation.** More rig + calibration, and
  triangulating staff tips gives the staff *line* but not roll — does not solve
  the crux. Rejected.
- **C) Extend the 2D color tracker, defer orientation.** Cheapest, but stays at
  the existing PoC's level (positions/turns only). Does not advance the hard
  part. Rejected as a first slice.

## Scope — first vertical slice

One phone, ArUco markers, one short real clip (a few beats), two staves → a short
TKA sequence **with orientation**, rendered via the existing pictograph renderer
to verify it matches what was performed.

**In scope:** ArUco 6-DOF staff tracking in-browser; a grid-frame transform via a
center reference marker; per-beat classification into grid position + orientation
+ motion type + turns; reuse of the lab's beat/keyframe scaffolding; emit
`DerivedPictograph[]`; render to verify.

**Out of scope (deferred):** markerless capture, body mocap, two-phone 3D,
robust automatic full-letter recognition, the animate/replay direction, export to
the app's canonical sequence format (the `DerivedPictograph` → canonical bridge).

## Architecture

All processing runs **in-browser** in the existing `prop-tracking-lab` (it
already loads video + walks frames as `ImageData`). The pipeline per frame:

```
video frame (ImageData)
  → js-aruco2 detect → markers {centerRef, staffBlue, staffRed} each 6-DOF
  → transform staff poses into the centerRef (grid) frame
  → per-frame StaffPose3D { gripPos, axisDir, rollRad }  (×2 staves)
  → [accumulate over frames]
  → beat segmentation (held positions = keyframes; reuse existing detector)
  → per-beat classify → DerivedPictograph (position, orientation, motion, turns)
  → render via PictographRenderer to verify
```

### Units (single responsibility each)

1. **ArucoStaffTracker** (`services/aruco-staff-tracker.ts`, new — swaps
   `SimplePropTracker`). Wraps `js-aruco2`: given a frame `ImageData` + the known
   marker dictionary + marker size, returns detected markers with 6-DOF pose
   (rotation matrix/quaternion + translation) keyed by marker id. Pure per-frame;
   no TKA knowledge. Output: `DetectedMarker[] { id, posCam: Vec3, rotCam: Quat,
   corners }`.

2. **GridFrameSolver** (`services/grid-frame-solver.ts`, new). Given the center
   reference marker's pose, builds the camera→grid transform. Maps each staff
   marker's camera-frame pose into the **grid frame** → `StaffPose3D { gripPos:
   Vec3 (grid frame), axisDir: Vec3 (unit, along the shaft), rollRad: number
   (twist about axisDir relative to a reference up) }`. The reference marker fixes
   the grid's origin + axes so no metric/world calibration is needed.

3. **TkaPoseClassifier** (`services/tka-pose-classifier.ts`, new — the TKA
   brain). Given a `StaffPose3D` at a beat, classify into TKA primitives:
   - **Grid position**: project `gripPos` to the grid plane → nearest of the 8
     locations (n/ne/e/se/s/sw/w/nw).
   - **Orientation**: `axisDir` vs the radius at that location → **radial** (along
     the radius) / **nonradial** (perpendicular); `rollRad` / which staff end
     leads → **in / out**.
   - **Motion type**: start→end grid-position relationship → static / shift /
     dash (the existing 2D logic, now on 3D positions).
   - **Turns**: accumulated `rollRad` between beats → turn count (1 turn = 180°
     additional rotation, per TKA).
   **All category boundaries (what counts as radial vs nonradial, in vs out, the
   motion-type families) MUST be grounded against canonical TKA definitions via
   the Flow Arts Knowledge MCP at implementation time — not hand-rolled from
   assumption.** (`get_domain_topic` orientation/base-rotation, `get_position_info`,
   `get_term_definition`.)

4. **Beat segmenter** — reuse the lab's existing keyframe detection
   (`DetectedKeyframe`, `TrackingConfig.keyframeMotionThreshold`); feed it the
   3D grip position stream instead of the 2D tip. Held/low-motion spans = beats.

5. **Emit + render** — assemble `DerivedPictograph[]` (existing type) from
   consecutive beat classifications; render each with the existing
   `PictographRenderer` for verification. (The `DerivedPictograph` → canonical
   app-sequence bridge is deferred.)

### Dependency

Add **`js-aruco2`** (pure-JS, in-browser ArUco + POSIT pose). Verify its license
(expected permissive) before adding; vendor or npm per repo convention. No
OpenCV/WASM needed for the first slice.

## Capture protocol

- One printed **ArUco marker per staff** (known physical size; same dictionary),
  fixed near the grip or along the shaft so it stays camera-visible through the
  flow. Distinct ids per staff.
- One **center reference marker** flat at grid center (defines the TKA world
  frame). Performer stands at the grid center facing the camera's framed grid.
- One phone, **static framing**, whole performer + both staves in view, good
  light, **fast shutter** (minimize motion blur on spins). Short clip — a few
  beats.

## Error handling / risks (validate in the slice)

- **Motion blur on fast spins** drops ArUco detections. Mitigate: larger markers,
  fast shutter, good light; the beat segmenter interpolates short gaps; flag
  sustained dropout as low-confidence rather than emitting a wrong beat.
- **Marker occlusion** (hand/body covers the marker): same — gap + interpolate;
  report confidence per beat (reuse `TrackedFrame.confidence`).
- **Classification correctness**: ground every TKA boundary in MCP/canonical
  defs; verify the slice against clips whose notation is already known.
- **Reference-marker visibility**: if the center marker leaves frame, the grid
  transform is lost for those frames → flag, don't guess.

## Testing

- **Unit (deterministic, no video):** `GridFrameSolver` — a synthetic staff pose
  in a known camera frame transforms to the expected grid-frame position +
  roll. `TkaPoseClassifier` — hand-constructed `StaffPose3D` at a known grid
  location + orientation classifies to the expected position / radial-nonradial /
  in-out / turns (cases grounded against MCP output).
- **Integration (real clip):** a short captured clip with a *known* performed
  sequence → the emitted `DerivedPictograph[]` matches it (positions +
  orientation). Side-by-side: source video vs rendered pictograph sequence.

## Non-goals

- No markerless capture (roll markerless is a much harder research problem).
- No body capture / avatar replay (that is the separate parked Sequence Capture
  project).
- No two-phone 3D, no canonical-sequence export, no fully-automatic robust
  letter recognition — the slice proves the chain on a short clip, not a
  production transcriber.
