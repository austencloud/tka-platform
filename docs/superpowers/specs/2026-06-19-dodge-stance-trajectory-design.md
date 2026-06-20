# Dodge Stance Trajectory + Torso-Twist DOF — Design

**Date:** 2026-06-19
**Status:** Active
**Author:** Austen + Claude

## Problem

The auto-dodge solves a **single fixed stance** held for the entire staff sweep,
over a 4-DOF body model (`footOffsetX/Z`, `rootYaw`, `spinePitch`). Two
consequences:

1. **No torso twist.** The model can only yaw the whole body or pitch the spine
   forward. It cannot turn the torso edge-on — the actual TKA dodge technique
   ("body turns to pass the prop into the plane behind you", using negative
   space above/below the shoulder). The torso is also a fat face-on sphere stack
   (`torsoRadius = 0.12`), so a staff that a real edge-on torso would clear reads
   as passing through the chest. → the inside-gamma corner scores infeasible and
   the orchestrator falls back to a wide outside stance the performer doesn't
   want.
2. **One frozen stance for the whole sweep** forces near-max arm extension. Grid
   search: 2/6600 feasible stances, both at reachStretch ≈ 1.0. A human does not
   hold one stance — they move through the dodge as the staff passes.

Result: arms curl tight to the chest at max stretch, body parks outside gamma.

## Goal

Let the optimizer find the comfortable quadrant-3 inside-gamma dodge **on its
own** — no human puppeteering — by (a) giving the body the missing twist DOF +
honest oriented-slab torso, and (b) letting the stance vary across the sweep as a
smooth trajectory. The puppet tool demotes to a validation/fallback path.

## Approach

Control-keyframe spline trajectory, warm-started from the existing fixed solve.
Chosen over per-sample joint descent (high-dimensional, jerky) and
decouple-then-smooth (smoothing re-breaks clearance): control keyframes keep the
search low-dimensional, smoothness is implicit in the spline, and warm-starting
from the fixed stance makes the trajectory result strictly ≥ today's.

## Components

### 1. `StancePose` += `torsoTwistRad` (5th DOF)
Optional field (`torsoTwistRad?: number`, `?? 0` everywhere) so on-disk Collision
Lab labels stay valid. New bound in `STANCE_BOUNDS.torsoTwistDeg` (± ~60°) and
`OPTIMIZER_BOUNDS.torsoTwistRad`.

`StanceSimulator.applyStance`: twist is an extra Y-rotation about the body
centerline applied to **upper-body joints only** (spine2, neck, head, both
shoulders), composed with `rootYaw` (effective angle `yaw + twist`). Hips and
spine1 keep `rootYaw` alone. Feet/balance use `rootYaw` (feet don't twist).
Because the shoulders now rotate with twist, the torso facing used by collision
is derived from shoulder positions automatically — no separate facing param.

### 2. Oriented-slab torso collision
Replace the per-spine-point isotropic sphere with an **oriented ellipsoid** in
the torso basis (right = `rightShoulder − leftShoulder`, forward = `right × up`):
half-axes `torsoHalfWidth` (shoulder axis, wide ≈ 0.14), `torsoHalfDepth`
(front-back, thin ≈ 0.095), `torsoHalfHeight` (vertical tiling ≈ 0.12). For each
spine point P, closest point Q on the prop segment, separation `s = Q − P`,
direction cosines in the basis, ellipsoid radius `e = 1/√((ca/W)²+(cu/Hv)²+(cf/D)²)`
with `W/D/Hv` inflated by the prop radius; depth `= max(0, e − |s|)`. Reduces
exactly to the old sphere when the three half-axes are equal. New
`RestPoseGeometry` fields default from `torsoRadius` when absent.

### 3. `stance-trajectory.ts` (pure)
`TrajectoryKeyframe { t: number; pose: StancePose }`, `StanceTrajectory
{ keyframes }`. `sampleTrajectory(traj, progress): StancePose` — uniform
Catmull-Rom per scalar channel (endpoint duplication for the 3-keyframe case),
angle channels (`rootYawRad`, `torsoTwistRad`) unwrapped before interpolation. No
three.js.

### 4. `trajectory-optimizer.ts`
`optimizeTrajectory(sweep, seedStance, bounds, opts)`:
- K = 3 control keyframes at t = 0, 0.5, 1, all initialized to `seedStance` (warm
  start = today's fixed answer).
- Coordinate descent over K×5 = 15 params, adaptive step halving (same schedule
  shape as `StanceOptimizer`).
- Loss = mean over N dense samples (N = sweep length, sample i → staff instant i)
  of the shared per-instant stance loss + light smoothness (squared 2nd
  difference of keyframe channels) + the existing comfort/stretch term.
- Per-instant loss extracted into an exported `computeStanceLoss(sim, reachTol)`
  reused by both `StanceOptimizer.lossFrom` and this optimizer (no duplicate
  weights).
- Returns `{ trajectory, feasible (every dense sample feasible), worstBodyDepth,
  meanStretch, loss }`.

### 5. `dodge-orchestrator`
Keep the fixed `biased`/`plain` solve — it is the warm-start seed **and** the
fallback. Then `optimizeTrajectory(sweep, fixedStance, boundsWithTwist)`. Return
the trajectory when it is feasible or beats the fixed loss; else a flat
trajectory of the fixed stance. `DodgeSolution` gains `trajectory: StanceTrajectory`;
`stance` stays (sampled at t = 0.5) for single-stance consumers.

### 6. `DodgeDriver` (live runtime)
Each frame: `stance = sampleTrajectory(trajectory, progress)`, applied
imperatively in `useTask` (foot offset → root X/Z, rootYaw → root Y rotation,
torsoTwist + spinePitch → spine bones), then the existing per-frame arm IK glues
hands to the staves. No new `$state`/`$derived`/`$effect` in the per-frame path —
same discipline as today.

## Verification (before live eyes)

Headless node script runs the new solve on the WHEEL S→W / WALL N→E PRO-arc
preset and prints, across the sweep: every-sample feasibility, worst body depth,
mean arm stretch, and the body's XZ vs quadrant-3 inside-gamma. Success =
inside-gamma feasible at mean stretch well under 1.0. Live `DodgeDriver` change
then verified for clean console + `__dodgeLive` sane; final pose is Austen's to
eyeball.

## Out of scope

Retuning Collision Lab labels to the 5-DOF model (twist defaults to 0, existing
labels unaffected). Puppet keyframe-capture/export (the fallback path) is parked,
not deleted.
