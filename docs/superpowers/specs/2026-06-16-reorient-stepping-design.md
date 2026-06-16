# Reorient-by-Stepping via Motion Matching — Design

**Date:** 2026-06-16
**Status:** Approved (design), pending implementation plan
**Slice:** 1 of an eventual motion-matching locomotion system

## Goal

A 3D performer turns their torso to a target facing by taking natural step(s),
and can step back to the origin facing/position. The planted foot does not slide
(foot-lock). Clip transitions are seamless (inertialization).

This is the narrow, demoable vertical slice of the larger ambition (general
motion-matching locomotion, then environment-aware avoidance à la the SIGGRAPH
Asia 2025 *Environment-aware Motion Matching* demo). It proves the three pieces
the codebase is missing — MM nearest-neighbour search, inertialization, and
foot-lock wiring — on **clips that already ship**, at zero data cost.

## Non-Goals (explicit YAGNI for this slice)

- Environment/obstacle collision penalty in the search cost (later slice).
- Multi-agent avoidance / crowds.
- New mocap capture. Slice 1 runs on existing clips; richer pivot-angle vocab
  (FreeMoCap / Move.ai capture) is a later data-only fill, no code change.
- Replacing the existing speed-blend `LocomotionController` everywhere. The MM
  controller is additive and scoped to the reorient behaviour for now.
- Arm/upper-body IK (handled by `@austencloud/scene-3d`; untouched here).

## What Already Exists (reuse — no hand-roll)

Verified by grep/read on 2026-06-16:

| Capability | File / source | Used for |
|---|---|---|
| Rigged performer (SkinnedMesh, Mixamo bone names) | `@austencloud/scene-3d` → `PerformerRig`; `static/models/` | The body we animate. Mixamo naming = drop-in for future Mixamo/Rokoko/Move.ai/FreeMoCap data. |
| Two-bone analytic leg IK (hinge knee, ground-normal foot) | `src/lib/shared/3d/services/hinge-constrained-leg-ik-solver.ts` → `solveLegIK(input: LegIKInput)` | Foot-lock execution. |
| Knee hinge axis calibration | `src/lib/shared/3d/services/knee-hinge-axis-calibrator.ts` | Supplies `kneeHingeAxis` to `solveLegIK`. |
| Per-frame foot-contact curves (0–1 per foot, phase-sampled, velocity fallback by design) | `src/lib/shared/3d/services/contact-curve-cache.ts` → `getContactAt`, `registerCurve` | Foot-contact detection (when to lock). |
| AnimationMixer + clip blending + root motion + yaw delta | `src/lib/features/stage/locomotion/locomotion-controller.ts`, `clip-registry.ts` | Clip sampling + the controller pattern to mirror. |
| Per-frame loop | Threlte `useTask(delta)` (e.g. `src/lib/features/museum/components/game/Museum3DScene.svelte:437`) | Drive the MM controller each frame. |
| Scene mount + feature registry | `src/lib/shared/3d/components/Viewer3DScene.svelte`, `Viewer3DCanvas.svelte`, `scene-features/domain/scene-feature-registry.ts` | Where the test harness mounts one performer. |
| Existing clips | `static/animations/locomotion-pack/`: `turn-left.glb`, `turn-right.glb`, `walk-forward.glb`, `walk-backward.glb`, `idle.glb`, strafes | The slice-1 motion database. |
| Single-select control primitive | `SegmentedControl` (`src/lib/shared/3d/components/controls/SegmentedControl.svelte`) | Test-page facing selector (per chip-primitives rule). |

## Approach Decision

Three options were weighed:

- **A — MM-lite tailored to this rig (CHOSEN).** Build six small, owned,
  testable units; reuse the leg IK solver + contact cache. Right-sized, no
  license entanglement, fully understood. The EAMM reference repo is Unity/C# +
  CC-BY-SA, so its code can't be lifted regardless; the algorithm is
  reimplemented from public writeups (Holden / *MM for VR Avatars*).
- **B — Port a full MM framework** (e.g. adapt `Digital-Humans-23/motion-matching`).
  More features (gait phase, learned-MM compression) but heavier, foreign-engine
  origin, port cost, mostly YAGNI for one behaviour.
- **C — Physics inverted-pendulum stepper** (Kenwright). No data, but the
  "functional, not artistic" look that fails the fidelity bar. Rejected as the
  primary; retained only as a possible future balance/recovery fallback.

## Architecture — Six Units

All new code under `src/lib/features/stage/locomotion/motion-matching/`. Each
unit has one job, a typed interface, and is testable in isolation. Pure modules
follow the project's pure-function-module convention (no `Service` suffix).

### 1. `feature-extractor.ts` (pure, load-time)

Sample each registered clip at a fixed rate (30 fps) and emit a per-frame
**feature vector**:

- **Pose features:** left/right foot position + velocity in root-local space,
  hip (root) linear velocity.
- **Trajectory features:** future root position (root-local) and facing at
  +0.33 s, +0.66 s, +1.0 s.

Output: a flat `Float32Array` database + a parallel index array of
`{ clipId, time }` per frame, + the feature layout (offsets/dims) and a default
weight vector. Deterministic. Unit-testable: feed a known clip → assert vector
dimensions and that a stationary frame yields ~zero velocities.

### 2. `search.ts` (pure)

Given a **query vector** (current pose features + desired trajectory) and the
database, return the nearest frame `{ clipId, time }` by weighted squared L2 over
the feature columns. Flat linear scan — the DB is a few thousand frames × ~30
floats, trivially real-time. Feature weights configurable. Unit-testable on a
synthetic DB where the nearest answer is known.

### 3. `trajectory.ts` (pure)

Convert high-level intent into the future query points `search` expects:

- **Reorient:** desired facing interpolated from current → target over a ~1 s
  horizon; position held roughly stationary (pivot in place).
- **Step-back:** target facing/position set back to the recorded origin; produces
  trajectory points returning to it.

Unit-testable: target facing +90° → query facing samples ramp toward +90°.

### 4. `inertialization.ts`

When `search` selects a new `{ clipId, time }` that differs from what's currently
playing, blend from the current pose to the new clip's pose using
**inertialization** (Bollo): capture the per-joint quaternion + root offset at the
switch instant, then decay that offset to zero over a blend time (~0.25 s). This
removes the pop that naive clip-switching causes — the core smoothness lever.
Unit-testable on a single joint: offset magnitude decays monotonically to ~0 by
blend-time end.

### 5. `foot-lock.ts`

Per foot, sample contact via `contact-curve-cache.getContactAt(clip, phase)`
(falling back to the velocity-based detection the cache already documents when a
clip has no curve). While a foot is planted (contact ≈ 1): freeze its world
position the moment it lands, and each frame call `solveLegIK` with that frozen
`footTarget` and the calibrated `kneeHingeAxis` so the foot stays put as the root
moves/turns. Release (ramp `weight`→0) as contact falls during swing.
Unit-testable: given contact=1 and a moving root, the locked world target stays
fixed and `solveLegIK` is invoked with it; contact=0 → `weight` 0, no lock.

### 6. `mm-locomotion-controller.ts` (stateful, mirrors `LocomotionController`)

Per-frame orchestration, called from `useTask`:

1. `trajectory` builds the query from the current target (facing / step-back).
2. Every N frames (~10 Hz), `search` returns the best `{ clipId, time }`.
3. `inertialization` blends the sampled pose toward the new selection.
4. AnimationMixer samples the chosen clip at `time`.
5. `foot-lock` overrides planted-foot pose via leg IK.

Public surface: `setTargetFacing(rad)`, `stepBackToOrigin()`, `update(dt)`,
`.state` (current facing, isStepping, lockedFeet). Construction takes the rig +
the loaded clip DB, mirroring how `LocomotionController` takes the scene + mixer.

## Data Flow

```
target facing / step-back
        │
        ▼
   trajectory.ts ──► query vector ─┐
                                   ├─► search.ts ─► {clipId, time}
   current pose features ──────────┘                    │
                                                         ▼
                                            inertialization.ts (blend toward it)
                                                         │
                                                         ▼
                                          AnimationMixer samples pose
                                                         │
                                                         ▼
                              foot-lock.ts (freeze planted foot, solveLegIK)
                                                         │
                                                         ▼
                                                      render
```

## Verification Surface

Test page `src/routes/test/reorient-stepping/+page.svelte` mounting the real
`Viewer3DScene` with one performer, plus:

- A `SegmentedControl` of target facings (e.g. −90°, −45°, 0°, +45°, +90°).
- A "Step back to origin" button.

Real components + HMR (per visualization-routing: test page, not mockup).
Objective foot-slide check via Chrome DevTools `evaluate_script`: record the
locked foot's world position across a turn; **variance ≈ 0 while contact = 1**
is the pass condition. Screenshot the mid-turn pose for the visual check.

## Phasing (each phase verified before the next)

1. **Search + inertialization** on existing clips → facing target drives smooth
   clip selection (no foot-lock yet). Verify: smooth, no pop, on the test page.
2. **Foot-lock**: contact detection + leg IK wiring → planted foot variance ≈ 0.
   Verify: DevTools foot-pos variance eval.
3. **Step-back**: origin-return trajectory → performer steps back to start.
   Verify: returns to start facing/position on button press.
4. *(later slices, out of scope here)* general MM engine across all clips ·
   environment collision penalty · captured pivot-angle vocab (FreeMoCap/Move.ai)
   to fill coverage.

## Testing Strategy

- **Unit (Vitest):** feature dims + stationary-velocity (extractor); nearest on
  synthetic DB (search); facing ramp (trajectory); offset decays to ~0
  (inertialization); locked target fixed under root motion (foot-lock).
- **Runtime/visual:** test-page screenshot + locked-foot world-position-variance
  DevTools eval. No "done" claim without this evidence.

## Known Gap (honest)

Existing clips are limited turn angles (likely ±90°). At in-between target
angles, `search` returns the nearest available frame → residual foot slide until
richer pivot vocabulary exists. Slice 1 proves the **mechanism**; angle coverage
is a **data-only** fill in phase 4 (capture exact lift→place→reorient→step-back
vocab with FreeMoCap, $0, multi-webcam → better foot-depth than single-cam), with
no controller code change.

## Related

- Memory: `project_root_motion_migration`, `project_stage_locomotion`,
  `project_tka_sequence_capture` (phone mocap → the phase-4 capture path).
- Rules: `never-hand-roll`, `chip-primitives` (SegmentedControl),
  `visualization-routing` (test page), `verification-protocol` (foot-variance
  proof), `research-before-building` (reuse leg IK / contact cache, don't rebuild).
