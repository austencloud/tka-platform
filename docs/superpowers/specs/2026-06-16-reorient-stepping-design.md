# Free-Running Motion-Matching Locomotion Controller — Design

**Date:** 2026-06-16
**Status:** Approved (design), pending implementation plan
**Decision:** Option 2 — free-running MM controller (not an `ITurnAnimator` impl)

## Goal

A single performer continuously reorients their torso and steps toward a **live
target** (position + facing), with natural lift→place→reorient and step-back
motion. The planted foot does not slide (foot-lock). Clip transitions are
seamless (inertialization). Arbitrary facing angles, not 45° notation snaps.

This is the EAMM-demo behavior: trajectory-driven continuous control, drivable by
a target that anything can set (a test page now; stage formations later).

## How This Relates To What Already Exists (reconciliation)

Two adjacent systems were found and reconciled before scoping:

1. **Turn-in-place (`@austencloud/scene-3d`, 2026-04-11).** Ships
   `ITurnAnimator` + `ClipBasedTurnAnimator` (phase-clocked, 45°-snapped, for
   notation beats), plus the foundation: `ILegIKSolver`, `RootMotionExtractor`
   (with yaw), `FootPlanter`, `ContactCurveCache`. That design **deliberately**
   scoped MM out for the discrete-beat regime and named
   `MotionMatchingTurnAnimator` a *future* swap. We are **not** building that —
   we are building the **free-running** controller, which the notation/phase
   interface can't express. The shipped foundation is reused, not duplicated.

2. **Stage locomotion (2026-05-25).** A choreography module whose locomotion
   layer is a speed-blend `LocomotionController`
   (`src/lib/features/stage/locomotion/locomotion-controller.ts`: idle/walk/run
   by speed). Its polish backlog item #1 is **"Inertialization blending"** and
   Phase 4 is **"Turn-in-place."** This MM controller is the **drop-in
   high-fidelity replacement** for that speed-blend controller — same driving
   contract (`update(dt, targetPosition, targetFacing)`), better internals. It is
   the convergence of both backlog items, not a competing system.

## Non-Goals (explicit YAGNI for this slice)

- The 2D formation editor, multi-performer formations, beat-sync, persistence —
  all stage-locomotion's job; untouched here.
- Environment/obstacle collision penalty (the EAMM "environment-aware" layer).
- `ITurnAnimator` / notation-phase model.
- New IK solver, new contact detection, new root-motion extractor — **reused**.
- New mocap capture. Slice runs on existing clips; richer pivot/step-back vocab
  (FreeMoCap, $0, multi-webcam) is a later data-only fill, no code change.

## What Already Exists (reuse — verified 2026-06-16)

| Capability | Source | Used for |
|---|---|---|
| Rigged performer (SkinnedMesh, Mixamo bones) | `@austencloud/scene-3d` `PerformerRig`; `static/models/` | Body to animate. |
| Two-bone hinge-knee leg IK | `src/lib/shared/3d/services/hinge-constrained-leg-ik-solver.ts` → `solveLegIK(input: LegIKInput)` | Foot-lock execution. |
| Knee hinge axis calibration | `.../knee-hinge-axis-calibrator.ts` → `computeKneeHingeAxis(upLegRestDir, legRestDir)` | Supplies `kneeHingeAxis`. |
| Per-foot contact curves (0–1, phase-sampled, velocity fallback) | `.../contact-curve-cache.ts` → `getContactAt`, `registerCurve` | Contact detection (when to lock). |
| Root motion + yaw delta | `@austencloud/scene-3d` `RootMotionExtractor` | Applying clip-driven translation + turn to the rig. |
| AnimationMixer clip sampling, controller pattern | `src/lib/features/stage/locomotion/locomotion-controller.ts`, `clip-registry.ts` | Clip sampling + the `update()` contract to mirror. |
| Per-frame loop | Threlte `useTask(delta)` (e.g. `Museum3DScene.svelte:437`) | Driving the controller each frame. |
| Scene mount | `Viewer3DScene.svelte`, `Viewer3DCanvas.svelte` | Where the test harness mounts one performer. |
| Existing clips | `static/animations/locomotion-pack/`: `idle`, `walk-forward`, `walk-backward`, `turn-left`, `turn-right` (90°), strafes | The slice-1 motion database. |
| Single-select control | `SegmentedControl` (`.../controls/SegmentedControl.svelte`) | Test-page target controls. |

**Foot-lock reuse decision:** the slice wires the **local** `solveLegIK` +
`contact-curve-cache` directly in a thin foot-lock pass inside the controller
(both are local, accessible, testable). The package `FootPlanter` is the eventual
production integration target, but the vertical slice stays self-contained on the
local solver to remain verifiable without reaching into package internals.

## Architecture — Five New Units + One Reused Pass

New code under `src/lib/features/stage/locomotion/motion-matching/`. Each unit
one job, typed interface, testable in isolation. Pure modules follow the
project's pure-function-module convention (no `Service` suffix).

### 1. `feature-extractor.ts` (pure, load-time)

Sample each registered clip at 30 fps → per-frame **feature vector**:
- **Pose:** left/right foot position + velocity (root-local), hip linear velocity.
- **Trajectory:** future root position (root-local) + facing at +0.33/0.66/1.0 s.

Output: flat `Float32Array` DB + parallel `{ clipId, time }` index + a layout
descriptor (offsets/dims) + a default weight vector. Deterministic.
Test: known clip → assert vector dims; stationary frame → ~zero velocities.

### 2. `search.ts` (pure)

Query vector (current pose features + desired trajectory) + DB → nearest frame
`{ clipId, time }` by weighted squared L2. Flat linear scan (DB is small,
real-time trivial). Weights configurable.
Test: synthetic DB where the nearest answer is known.

### 3. `trajectory.ts` (pure)

Convert live intent into the future query points `search` expects:
- **Move/reorient:** desired facing + position interpolated from current → target
  over a ~1 s horizon.
- **Step-back:** target set back to the recorded origin.
Test: target facing +90° → query facing samples ramp toward +90°.

### 4. `inertialization.ts`

On a frame switch to a new `{ clipId, time }`, capture per-joint quaternion +
root offset at the switch instant and decay it to zero over ~0.25 s
(Bollo inertialization). The smoothness lever — directly satisfies
stage-locomotion polish item #1.
Test: single joint — offset magnitude decays monotonically to ~0 by blend end.

### 5. `mm-locomotion-controller.ts` (stateful; drop-in for stage `LocomotionController`)

Per-frame orchestration from `useTask`. **Public surface mirrors the stage
controller** so it's a drop-in:

- `update(dt, targetPosition: Vector3, targetFacing: number): void`
- `stepBackToOrigin(): void`
- `get state(): LocomotionState` (`{ position, facing, speed, isMoving }`)

Each frame:
1. `trajectory` builds the query from current target.
2. Every N frames (~10 Hz) `search` returns best `{ clipId, time }`.
3. `inertialization` blends the sampled pose toward the new selection.
4. AnimationMixer samples the chosen clip at `time`; `RootMotionExtractor`
   applies translation + yaw to the rig transform.
5. Foot-lock pass (below) plants the contacting foot.

### Reused foot-lock pass (inside the controller, not a new unit)

Per foot: sample contact via `contact-curve-cache.getContactAt(clip, phase)`
(velocity fallback when a clip has no curve). While contact ≈ 1, freeze the
foot's world position on landing and call `solveLegIK` each frame with that frozen
`footTarget` + calibrated `kneeHingeAxis` so it stays planted as the root moves.
Release (`weight`→0) as contact falls.
Test: contact=1 + moving root → locked world target fixed, `solveLegIK` invoked
with it; contact=0 → weight 0, no lock.

## Data Flow

```
live target (position + facing) / stepBackToOrigin
        │
        ▼
   trajectory.ts ──► query vector ─┐
                                   ├─► search.ts ─► {clipId, time}
   current pose features ──────────┘                    │
                                                         ▼
                                            inertialization.ts (blend toward it)
                                                         │
                                                         ▼
                         AnimationMixer sample + RootMotionExtractor (pos + yaw)
                                                         │
                                                         ▼
                       foot-lock pass: contact-curve-cache → solveLegIK (plant)
                                                         │
                                                         ▼
                                                      render
```

## Verification Surface

Test page `src/routes/test/mm-locomotion/+page.svelte` mounting the real
`Viewer3DScene` with one performer, plus:
- A `SegmentedControl` of target facings (−90°, −45°, 0°, +45°, +90°).
- A "Step back to origin" button.
- (Optional) click-to-set target position on a ground plane.

Real components + HMR (per visualization-routing: test page, not mockup).
Objective foot-slide check via Chrome DevTools `evaluate_script`: record the
locked foot's world position across a turn; **variance ≈ 0 while contact = 1** is
the pass condition. Mid-turn screenshot for the visual check.

## Phasing (each phase verified before the next)

1. **Search + inertialization** on existing clips → target facing drives smooth
   clip selection (no foot-lock yet). Verify: smooth, no pop, on the test page.
2. **Foot-lock pass**: contact + `solveLegIK` wiring → planted foot variance ≈ 0.
   Verify: DevTools foot-pos-variance eval.
3. **Step-back + target position**: origin-return trajectory + move-to-target.
   Verify: performer steps to a clicked target and back on button press.
4. *(later, out of scope)* package `FootPlanter` integration · stage formations
   drive the target · environment penalty · captured pivot/step-back vocab
   (FreeMoCap) to fill angle coverage.

## Testing Strategy

- **Unit (Vitest):** feature dims + stationary-velocity (extractor); nearest on
  synthetic DB (search); facing ramp (trajectory); offset decays to ~0
  (inertialization); locked target fixed under root motion (foot-lock pass).
- **Runtime/visual:** test-page screenshot + locked-foot world-position-variance
  DevTools eval. No "done" claim without this evidence.

## Known Gap (honest)

Existing clips cover limited turn angles (idle/walk + ±90° turns). At in-between
angles, `search` returns the nearest available frame → residual slide until richer
pivot vocabulary exists. Slice proves the **mechanism**; angle coverage is a
**data-only** fill in phase 4 (capture exact lift→place→reorient→step-back with
FreeMoCap, $0, multi-webcam → better foot-depth than single-cam), no controller
code change.

## Related

- Reconciles: turn-in-place (`@austencloud/scene-3d`, clip path = sibling),
  stage-locomotion (`2026-05-25`, this upgrades its locomotion layer + delivers
  its polish item #1 inertialization + Phase 4 turn-in-place).
- Memory: `project_root_motion_migration`, `project_stage_locomotion`,
  `project_tka_sequence_capture` (phase-4 capture path).
- Rules: `never-hand-roll`, `chip-primitives`, `visualization-routing`,
  `verification-protocol`, `research-before-building`.
