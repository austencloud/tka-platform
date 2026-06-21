# Dodge: Analytic Vacate + Arm-Pin — Design

**Date:** 2026-06-20
**Status:** Design (awaiting review)
**Supersedes (runtime dodge path):** `2026-06-19-dodge-stance-trajectory-design.md`

## Problem

The avatar must dodge a sweeping prop while both hands stay gripped to the
staves, stepping out of the way (open quadrant, facing grid center, edge-on)
rather than forcing itself into the prop crossing. The current runtime path
fails on three counts:

1. **Aims wrong.** `dodge-orchestrator.ts` biases the solve toward the
   *inside-gamma* corner (`computeInsideGammaTarget`, `W_PLACE`/`W_FACE`), which
   pulls the body **into** the staff crossing — the opposite of vacating.
2. **Jitters.** The body placement comes from per-frame numeric re-optimization
   (`StanceOptimizer` → `TrajectoryOptimizer`). Different frames settle in
   different descent basins, so the body visibly spazzes ("grids moving around").
3. **Hands read detached.** `solveArm` (DodgeDriver) pins hand *position* but
   restores the natural clip wrist orientation, so the grip never aligns to the
   staff — it looks ungripped, most visibly at sweep start.

Root cause across all three: a **scoring model** (`StanceSimulator`) is being
used as an **authoring substrate**. A scorer answers "how bad is this pose"; it
was never meant to *produce* correct motion. Every patch (trajectory search,
keyframe editor, click-to-place) is a symptom of the wrong substrate.

## Decision

Replace the runtime dodge brain with a **deterministic analytic recipe** that
encodes the movement technique directly, plus the **existing two-bone arm IK**
to pin the hands. Keep the stance optimizer for offline candidate labeling only.

Approach chosen: **B — Analytic vacate + existing arm-pin.** (A = per-frame
full-body nullspace IK via a new Jacobian DLS solver: over-engineered for web +
multi-performer, heavy, harder to make deterministic. C = keep optimizer, invert
bias: cheapest but keeps the jitter and the scorer-as-runtime-brain smell.)

### Control model

Auto-solve with two scalar knobs, **no gizmo, no per-instance hand-tuning, no
puppet, no click-to-place**:

- `side: 'auto' | 'left' | 'right'` — which way to bail; `auto` derives it from
  the sweep direction; explicit L/R only resolves a symmetric sweep.
- `aggression: 0..1` — how far to step / how much clearance margin (energy/style).

Rationale: a staff dodge is **deterministic technique given the sweep**, not an
aesthetic per-move choice. The only genuine choices are *side* (when ambiguous)
and *aggression* (energy). Both are scalars, not spatial puppeteering. A gizmo
would re-introduce the manual puppet the user rejected.

## Architecture

Per frame, **no numeric optimization at runtime**:

```
progress
  → VacatePlanner(sweptTube, grips, bodyModel, knob) → BodyPlacement
  → apply root translate + rootYaw + edge-on torsoTwist + spinePitch
  → bounded reach-step (feet follow the harder-to-reach grip; hands win)
  → solveArm: pin BOTH hands to grips + align wrist to staff axis
  → inertialize BodyPlacement channels on dodge enter/exit
```

### Units (single responsibility each)

1. **SweptTube** (`swept-tube.ts`, new — thin) — wraps the existing
   `SweepSample[]` from `swept-volume-builder.ts`. API:
   - `minDistanceToSegments(point): { dist, nearestPoint, sampleIndex }` — min
     over the 24 per-instant staff segments (`tipA→tipB`). Closed-form
     point-to-segment; no new geometry, no BVH.
   - `centroid()` and `principalAxis()` — mean grip + dominant sweep direction,
     for choosing the open quadrant.
   - Degenerate sweep (static prop, all samples coincident) → axis is null;
     planner falls back to face-center neutral.

2. **VacatePlanner** (`dodge-vacate-planner.ts`, new — the movement brain).
   Input: `SweptTube`, both grips, `RestPoseGeometry` body model, `{side,
   aggression}`. Output: `BodyPlacement = { footOffsetX, footOffsetZ, rootYawRad,
   torsoTwistRad, spinePitchRad }`. Pure, deterministic, no `StanceSimulator`
   evaluation. Recipe:
   - **Open quadrant.** Pick the vacate direction in XZ as the horizontal
     component of "away from the swept-tube centroid," snapped toward the clearer
     of the two floor quadrants flanking the sweep. `side` overrides when the two
     candidates are within a symmetry epsilon.
   - **Face center.** `rootYawRad = atan2(-footX, -footZ)` — forward points at the
     grid center (the work), per the dodge floor convention
     (forward at yaw θ = (sinθ, cosθ)).
   - **Edge-on twist.** Set `torsoTwistRad` so the torso slab's **thin (depth)**
     axis presents to the nearest staff approach — the negative-space body turn.
     Sign chosen to rotate the belly away from the tube. Magnitude clamped to
     `STANCE_BOUNDS.torsoTwistDeg`.
   - **Back-off.** Solve a 1-D offset `t` along the vacate direction such that the
     torso capsule (oriented slab, half-depth + margin) clears the tube:
     smallest `t` with `minDistanceToSegments(torsoCenter(t)) ≥ halfDepth +
     CLEAR_MARGIN`. Scale the *target* `t` by `aggression` (0 = just-clears, 1 =
     full comfortable step). **Bounded by arm reach:** if a candidate `t` pushes
     either grip beyond `upperLength + lowerLength`, stop at the reach-limited `t`
     — **hands are the hard constraint**; accept residual torso graze and report
     it as `worstBodyDepth`.
   - `spinePitchRad` from a small lean toward the lower grip if needed for reach
     (reuse the existing reach-assist intent, now analytic).

3. **Arm pin** (`solveArm` in DodgeDriver — keep, two upgrades):
   - **Wrist-to-staff orientation.** After the position pin, rotate the hand so
     its grip axis aligns to the staff axis (fixes the detached-looking grip).
     Replaces the "restore natural clip orientation" stopgap.
   - **Coincident-grip coupling.** When `|blueGrip − redGrip| < ε` (beta / one
     rigid staff), independent two-bone solves can fight (one arm pulls the
     shoulder line, breaking the other's reach). **v1 ships independent solves**
     from the analytically-correct body placement (the fight is marginal once the
     shoulders are centered on the shared point). If it visibly fights, add a
     coupled solve via `closed-chain-ik-js` (gkjohnson, v0.0.6 Feb 2026; same
     author as the already-installed `three-mesh-bvh`) — **scoped to the
     coincident-grip case only**, not the whole body. Do not pull the dependency
     until proven needed.

4. **Knob plumbing.** `DodgeSide` + `aggression` added to the dodge config; piped
   from DodgeTab UI → `solveDodge` → `VacatePlanner`. UI controls follow the
   chip/segmented primitives (`SegmentedControl` for side, existing slider
   primitive for aggression) — no hand-rolled controls, no checkboxes.

5. **Orchestrator** (`dodge-orchestrator.ts` — rewrite). `solveDodge` stops
   constructing `StanceOptimizer`/`TrajectoryOptimizer`. It builds the swept
   volumes (unchanged), constructs the `SweptTube`, and returns a `DodgePlan`:
   `{ placement(progress) => BodyPlacement, knob, worstBodyDepth }`. The planner
   is cheap enough to call per-frame in the driver; the orchestrator returns the
   configured planner + diagnostics, not a baked trajectory.

6. **Driver** (`DodgeDriver.svelte` — simplify + rewire). Per-frame `useTask`
   stays imperative (no `$state`/`$effect`/`$derived` — preserves the
   `effect_update_depth_exceeded` discipline). Each frame: sample `progress` →
   `placement(progress)` → apply to root/spine → bounded reach-step → `solveArm`
   both hands + wrist align. Inertialize the placement channels on dodge
   enter/exit using the existing `inertialization.ts`.

### Smoothness

Frame-to-frame continuity comes from (a) the planner being **analytic and
deterministic** (no basin hopping → no jitter by construction) and (b)
**inertialization** on dodge enter/exit. **No Catmull-Rom keyframes, no
trajectory param search.**

## What changes

**New:**
- `src/lib/features/stage/locomotion/dodge/swept-tube.ts`
- `src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.ts`
- Tests: `swept-tube.test.ts`, `dodge-vacate-planner.test.ts`

**Rewritten:**
- `dodge-orchestrator.ts` — returns a `DodgePlan` from the planner, not an
  optimized trajectory.
- `dodge-types.ts` — `BodyPlacement`, `DodgePlan`, `DodgeSide`, `aggression`;
  drop `trajectory`/`meanStretch`.
- `DodgeDriver.svelte` — vacate-driven body + arm pin + wrist align; remove
  puppet mode, foot handles, place-mode, dodge `TransformControls`.
- `DodgeTab.svelte` — side (SegmentedControl) + aggression (slider); remove
  place-mode button/hint, puppet toggle, manual sliders.

**Removed (dead after rewrite — confirmed consumed only by the dodge path):**
- `collision-lab/services/trajectory-optimizer.ts` + `stance-trajectory.ts`
- `collision-lab/services/stance-trajectory-twist.test.ts` (trajectory + sampler
  portions; keep/relocate the oriented-slab-torso assertions if still asserting
  `StanceSimulator` collision, which stays)
- `dodge/inside-gamma-target.ts` + `inside-gamma-target.test.ts`
- trajectory/inside-gamma references in `dodge-orchestrator.test.ts`

**Untouched:**
- `StanceSimulator`, `StanceOptimizer` (collision-lab offline labeling only)
- `swept-volume-builder.ts`, `inertialization.ts`, `solveLegIK`
- `torsoTwistRad` DOF + oriented-slab torso added 2026-06-19 (the planner reuses
  the slab half-axes for the back-off clearance test)

## Error handling

- **Never throws** (soft-feasibility rule). Infeasible clearance → reach-limited
  back-off + `worstBodyDepth` diagnostic.
- **Degenerate sweep** (static prop, no principal axis) → face-center neutral
  placement; planner does not divide by a zero-length axis.
- **Missing arm bones** → planner still returns a placement; arm pin no-ops (same
  as today's guarded `solveArm`).

## Testing

**Unit (`dodge-vacate-planner.test.ts`) — deterministic, no rig:**
- Sweep on the character's right → body steps to a left/forward open quadrant.
- Resulting `rootYaw` faces grid center (within tolerance of `atan2(-x,-z)`).
- `torsoTwist` sign turns the thin axis toward the nearest staff approach.
- Back-off makes the torso capsule clear the tube (min-dist ≥ halfDepth+margin)
  **unless** reach-bounded, in which case both grips stay within arm reach.
- Same input twice → identical output (determinism / anti-jitter).
- `side='left'` vs `'right'` flips the chosen quadrant on a symmetric sweep.
- `aggression` monotonically increases step distance up to the reach bound.

**Unit (`swept-tube.test.ts`):** point-to-segment min-distance correct vs a hand
calc; centroid/principal-axis on a known sweep; degenerate sweep → null axis.

**Visual (DodgeTab test page, DevTools/screenshot):** across the full sweep the
body vacates to the open quadrant, faces center, goes edge-on, both hands stay
visibly gripped to the staves, and there is no frame-to-frame jitter.

## Deferred (YAGNI)

- **Bake-at-export** (solved dodge → GLB/`AnimationClip`). No consumer needs a
  baked dodge clip yet (`solveDodge` is lab-only). Add when a card-render or
  shared-animation path actually consumes it.
- **closed-chain-ik-js coupling.** Only if independent arm solves visibly fight
  on the coincident-grip case.

## Non-goals

- No keyframe editor, no gizmo, no manual placement — the solver produces the
  motion; knobs art-direct it.
- No learned motion (MDM/CAMDM/in-betweening) — wrong tool for a single-correct
  constraint problem, no browser runtime, no staff-dodge dataset.
