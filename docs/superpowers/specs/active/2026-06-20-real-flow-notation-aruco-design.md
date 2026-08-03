---
status: active
value: 4
effort: S
remaining: 'LED pipeline genuinely built; doc retains the dead ArUco design inline as a hazard. Real-clip validation tracked elsewhere'
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-08-02
---
# Real Flow → TKA Sequence (LED Color-End Notation) — Design

> **DRIFT WARNING — 2026-08-02.** LED pipeline genuinely built; doc retains the **dead ArUco design inline** as a hazard. Real-clip validation tracked elsewhere
>
> Status lines below predate this check and are left intact deliberately.
> This banner is the current state. Source: `docs/superpowers/handoffs/2026-07-25-spec-triage-ledger.md`.


**Date:** 2026-06-20 (rev 2026-06-21)
**Status:** REVISED — ArUco capture front-end retired; LED color-end capture adopted. See "Revision 2026-06-21" below.
**Builds on:** `src/lib/features/train/prop-tracking-lab/` (2D color-tracking PoC), `src/lib/features/skel2tka/`
**Relates to:** parked project `TKA Sequence Capture` (the animation half — out of scope here)

---

## Revision 2026-06-21 — capture method pivot (ArUco → LED color ends)

**Why the ArUco approach was wrong.** A flat printed marker cannot stay readable on a
staff that spins and moves through interactions — it faces away from the camera for
half of every rotation, motion-blurs, and is occluded by the hand. ArUco suits a slow
rigid object, not flow. Austen called it correctly.

**The deeper correction (MCP-grounded 2026-06-21).** `get_term_definition("orientation")`:
orientation = *"the facing direction of a prop relative to the performer's center point"*
— in (toward center) / out (away) / clock / counter. For a **staff** (a rod, rotationally
symmetric about its long axis; the thumb/pinky references are its two **ends**, per the
project framing) that facing direction is **which way the long axis points in the plane**.
There is **no barber-pole roll DOF** for a staff — nothing TKA tracks twists about the long
axis. So the "roll crux only ArUco can capture" premise was false. Orientation is fully set
by **where the two ends point + which end is thumb**. Two tracked endpoints give it directly.

**Capture method (decided with Austen).** LED staves, **one solid color per staff** (blue
staff one color, red staff another). Per staff per frame: detect the color blob → its two
extreme points = the two ends. Thumb vs pinky is **not** color-coded (single color), so it
is recovered by **continuity**: a calibrated start pose fixes which end is thumb at frame 0,
then each frame the thumb-end is the endpoint nearest its previous position, propagated
forward. Continuity is load-bearing twice: it gives the in/out **sense** AND makes `axisDir`
a full 360° vector so **turns** (axisDir angular sweep) are countable. Failure mode: a spin
rotating >180° between frames aliases the correspondence — mitigated by frame rate + fast
shutter.

**Camera-count-agnostic architecture (Austen's endgame = 3 cameras, one per plane).** The
TKA brain consumes only `gripPos` + `axisDir`; it is independent of camera count.
- **1 camera (v1, wall plane):** LED blobs → 2D endpoints → 2D `axisDir`. In-plane flow only.
  Ships first; proves the chain on real footage immediately.
- **3 cameras (v2):** LED blobs per view → multi-view triangulation → 3D endpoints → 3D
  `axisDir` + plane detection. Works in any plane; eliminates the out-of-plane limitation.
  (FreeMoCap/Pose2Sim-style triangulation; needs one-time extrinsic calibration.)

**What is KEPT (already built + tested, ~30 tests, unchanged):** `tka-pose-classifier.ts`
(location, orientation, hand-motion, pro/anti/float, turns — `classifyOrientation(gripPos,
axisDir)` already computes radial/nonradial from axis-vs-radius, exactly the colored-end
vector), `notation-to-pictograph.ts` (render bridge), the beat-segmentation structure, and
`notation-pipeline.ts` (orchestrator).

**What is SWAPPED:**
- `ArucoStaffTracker` + vendored `js-aruco2` → **`ColorEndTracker`** (per-staff single-color
  blob → two endpoints + thumb/pinky continuity). Extends the existing `SimplePropTracker`
  color-histogram approach (one tip → both ends + correspondence).
- `GridFrameSolver` (6-DOF camera matrix) → **2D `ScreenToGrid` calibration** (mark grid
  center + a reference radius; map screen px → grid coords). v2 replaces this with the
  triangulation+plane solver.
- `StaffPose3D.rollRad` → **dropped.** `accumulateBetween` computes `propNetRotation` from
  the `axisDir` angular sweep (not roll).
- Printable ArUco marker sheet → not needed (LED staves).

The sections below are the original ArUco design, retained for provenance. Read them as
historical; the Revision above governs.

---

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
