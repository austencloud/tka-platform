# Prop-Dodge Vertical Slice — Design

**Date:** 2026-06-17
**Status:** Approved for planning
**Author:** Austen + Claude

## Goal

One move. alpha1 start (left hand on WHEEL plane, right hand on WALL plane, both
orientations "in"). The left-hand wheel-plane staff spins through the sagittal
plane the torso occupies — it impales the body. The avatar must solve the
worst-case clearance up front, **pre-step and reorient to a single balanced,
collision-free stance before the staff arrives**, hold that stance, and keep both
hands gripping their staves via arm IK as the props keep moving.

Success: with the dodge toggle OFF the staff visibly passes through the torso;
with it ON the avatar has stepped/turned clear and the staff no longer intrudes,
while both hands stay on their staves and balance is maintained.

This is the deterministic, no-mocap foundation. Naturalness polish (diffusion /
mocap prior) is explicitly out of scope and deferred.

## Why this approach

Research (2026-06-16/17 SOTA sweep) confirmed that for a **known-ahead hand path
+ body-as-free-DOF + swept-volume avoidance + balance** problem, the state of the
art is offline constrained optimization over a pose prior, baked and replayed —
not live physics RL (no browser path) and not mocap-everything (the combinatorics
live in the TKA notation, not in a capture set). The codebase already owns the
deterministic solver this needs: the Collision Lab `StanceSimulator` +
`StanceOptimizer`. This slice wires that existing solver to the turn-in-place
locomotion executor already built, adding exactly one new capability
(translational stepping) plus a thin swept-volume aggregation.

## Coordinate frames (load-bearing — reconcile before wiring)

- **Prop interpolator** (`prop-state-interpolator.ts` → `plane-transforms.ts`):
  world frame, Y-up, +X = performer right, +Z = toward audience. Grid centered on
  the performer's upper body. WALL normal = +Z (coronal). WHEEL normal = +X
  (sagittal). `planeAngleToWorldPosition(WHEEL, π/2, r) = (0, −r, 0)` — south on
  the wheel plane sits on the centerline below the shoulder line.
- **StanceSimulator** (`stance-simulator.ts`): shoulder-centered local frame,
  **Y = 0 at the shoulder line** (hips at −0.28·height), +X right, +Z forward.
  Its doc comment states prop world positions are authored to match this frame
  "without Y shifting."
- **Implementation checkpoint:** confirm the interpolator's grid-centered world
  output already lands in the simulator's shoulder-centered frame (the Collision
  Lab's existing `pose-target-mapper.ts` is the canonical reference for how prop
  world positions become `SimPropTarget`s). If a Y offset or rotation is needed,
  do it once in the swept-volume builder, not scattered. Do not assume — verify
  against `pose-target-mapper.ts` and the live `CollisionDetector` the simulator
  mirrors.

## Architecture — 5 units

### Unit 1: Move definition (test-page data)

A single `MotionConfig3D` per hand. Default worst-case:

- **Left (blue, WHEEL):** `startLocation = endLocation = south`, `plane = WHEEL`,
  `turns = 2`, `startOrientation = in`. The hand holds at south `(0, −r, 0)` while
  the staff spins; the shaft sweeps a disc in the sagittal (YZ, X≈0) plane,
  carving through the torso/hip region. This is the impalement.
- **Right (red, WALL):** `startLocation = endLocation = north`, `plane = WALL`,
  `turns = 2`, `startOrientation = in`. Coronal plane in front of the body; does
  not impale. Present so the slice handles the real two-prop case (both hands
  must stay reachable and the WALL staff must not be collided into by the dodge).

Authored as plain data on the test page so the exact move is swappable later. No
alphabet/domain claims are asserted — the path is purely geometric via the
existing interpolator.

### Unit 2: Swept-volume builder (new, small)

`buildSweptVolume(config, sampleCount): SweepSample[]`

- For `progress` in `[0, 1]` at `sampleCount` steps (default 24), call the
  existing `calculatePropState(config, progress)` → `PropState3D`
  (`worldPosition`, `worldRotation`).
- Derive the staff segment: `tipA / tipB = worldPosition ± (halfStaffLength ·
  staffAxis)`, where `staffAxis = worldRotation · localStaffAxis`. Use the same
  staff-length + axis convention as `tip-position-bridge-3d.ts` (read it; do not
  re-derive a second axis convention).
- `grip = worldPosition` (hand grips at the grid point).
- Output `SweepSample[] = { tipA, tipB, grip, radius }[]`, one per sampled
  instant, in the simulator's frame (per Unit-1 frame reconciliation).

The "swept volume" is this set of time-sampled staff segments. No neural SDF, no
continuous CCD — the path is analytic and 24 samples cover a 2-turn sweep with
margin. If a fast sweep ever undersamples, raise `sampleCount`; log it, never
silently cap.

### Unit 3: Swept-stance solver (extend existing, do not fork)

`StanceSimulator` today evaluates one instantaneous staff. Add a sweep-aware
evaluation that reuses every existing primitive:

`evaluateSweep(stance, blueSweep: SweepSample[], redSweep: SweepSample[]): SweepSimResult`

- For each paired time-sample, run the existing collision + reach primitives
  (the same `detectCollisions` / `solveArmIK` math) against that instant's
  staff + grip, at the **fixed** stance.
- **Collision** = worst (max depth) over all samples — the stance must clear the
  whole sweep.
- **Reach feasibility** = worst (max shortfall) over all samples — the hands must
  be able to grip the staff at every instant from this one stance.
- **Balance** = computed once at the fixed stance (constant across the sweep).
- `feasible` = sweep-worst collision/reach within the existing thresholds AND
  `balanceMargin > −0.005` (reuse the simulator's existing feasibility rule and
  `REACH_FEASIBILITY_TOLERANCE`).

Then point `StanceOptimizer` at `evaluateSweep` so its search
`(footOffsetX, footOffsetZ, rootYaw, spinePitch)` minimizes sweep-worst loss.
Read `stance-optimizer.ts` + `get-stance-optimizer.ts` before wiring to match its
candidate-generation + loss-aggregation contract; extend, never duplicate.

Output: `TargetStance = { footOffsetX, footOffsetZ, rootYawRad, spinePitchRad }`
(this is the existing `StancePose` shape).

### Unit 4: Locomotion executor (extend the mm controller)

Reuse `mm-locomotion-controller.ts` (foot-lock + root-bank machinery already
built and verified).

- `TargetStance.rootYawRad → setTargetFacing(...)` (exists).
- **NEW capability — translational step to a target XZ:** drive the root toward
  `(footOffsetX, footOffsetZ)` using a step clip + the existing foot-lock to plant
  the foot at the new spot and settle. This is the one genuine piece of new
  locomotion work and the main implementation risk; it builds on, and must not
  regress, the verified turn-in-place + foot-lock behavior.
- **Torso reorientation:** apply `spinePitchRad` and aim the upper body via the
  existing `spine-twister.ts` (which already aims head/torso at hand targets).

### Unit 5: Arm IK / hands-on-props (reuse the simulator's solver)

Each frame, place each hand on its current grip target (`calculatePropState`
at the live progress) via the analytic two-bone arm IK already implemented in
`stance-simulator.solveArmIK`. Extract it to a shared, Three.js-free solver
callable by both the simulator and the live executor, OR call the simulator's
solver and copy results onto the live arm bones — decide at implementation by
reading how the live rig currently drives arm bones (do not introduce a second
arm-IK math path; one source of truth).

## Data flow

```
move def (Unit 1)
  → buildSweptVolume (Unit 2)  → blueSweep[], redSweep[]
  → StanceOptimizer.evaluateSweep (Unit 3)  → TargetStance
  → executor: setTargetFacing + step-to-XZ + spinePitch (Unit 4)  → steps & settles
  → per-frame arm IK to live grip (Unit 5)  → hands stay on staves
  → render
toggle OFF → skip Unit 3, hold default alpha1 stance (staff impales)
```

## Unit 6: Test page `/test/mm-dodge` (new)

Follows the `/test/mm-locomotion` page + `MmDriver.svelte` pattern.

- Renders the avatar and **both staves actually swinging** (RH wall, LH wheel)
  via the existing 3D prop rendering.
- **Dodge ON/OFF toggle.** OFF = default stance, staff impales. ON = solved
  pre-step clear.
- Debug gizmos: swept-volume staff samples (faint segments), the chosen
  foot-target marker, and a live **body↔sweep clearance readout** (min distance
  from torso/head capsules to the nearest swept staff sample; negative = intrude).
- Exposes `window.__dodgeController` / `window.__dodgeRig` for DevTools runtime
  verification (mirror the mm-locomotion hooks).
- Per `feedback_diagnostic_clipboard_workflow`: a **Copy Diagnostic** button
  dumping the move config, swept samples, chosen `TargetStance`, sweep-worst
  collision depth, reach shortfalls, and balance margin.

## Error handling

- **Solver reports infeasible:** do NOT hard-fail. Per
  `feedback_two_props_always_reachable` + `feedback_soft_over_hard_feasibility`,
  two props are always reachable in reality — an infeasible result means the
  solver/inputs are suspect. Return the least-collision best-effort stance, render
  it, and surface the diagnostic so the cause is visible. Never gate the demo on a
  hard feasibility failure.
- **Move never intrudes:** clearance readout stays positive at the default
  stance; dodge is a no-op; the page shows "no intrusion — nothing to dodge."
  Valid outcome, not an error.
- **Undersampled sweep:** if raising fidelity changes the chosen stance
  materially, the sample count was too low — `log()`/surface it; never silently
  cap coverage.

## Testing

**Unit (vitest):**
- `buildSweptVolume`: a known wheel-plane 2-turn config yields staff segments
  whose union intersects the torso region at the default stance (asserts the
  impalement exists to be solved).
- `evaluateSweep`: at the default stance, sweep-worst collision depth > threshold
  (intrusion detected). At a hand-authored cleared stance, sweep-worst depth ≤
  threshold and `feasible === true`.
- `StanceOptimizer` over the sweep returns a `TargetStance` that is
  collision-free across all samples, balanced, and keeps reach shortfall within
  tolerance.

**Runtime/visual (Chrome DevTools MCP, per verification-protocol):**
- Dodge ON: query `window.__dodgeController` for min body↔sweep clearance across
  the full move ≥ margin; foot replants to the target XZ; CoM stays in support.
- Dodge OFF: same query shows negative clearance (intrusion) — proves the toggle
  and the readout are real.
- Screenshot / Austen's eyes for naturalness of the step (correctness-first;
  stiffness acceptable this slice).

## Scope / YAGNI

In: one move, one anticipatory worst-case solve, deterministic, two rendered
staves, ON/OFF toggle, debug gizmos + diagnostic.

Out (deferred): continuous per-frame re-solve (tracking); diffusion/mocap
naturalness prior; multi-step / full-sequence sequencing; L8/L9 mid-step plane
flip; generalized swept-volume engine across all moves. These come after the loop
is proven on real code.

## Files

- Create: `src/lib/features/stage/locomotion/dodge/swept-volume-builder.ts` (Unit 2)
- Create: `src/lib/features/stage/locomotion/dodge/dodge-types.ts` (`SweepSample`, `SweepSimResult`)
- Modify: `src/lib/features/lab/tabs/collision-lab/services/stance-simulator.ts` (add `evaluateSweep`)
- Modify: `src/lib/features/lab/tabs/collision-lab/services/stance-optimizer.ts` (sweep-aware optimize path)
- Modify: `src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts` (step-to-XZ)
- Create: `src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts` (wires Units 2→5)
- Create: `src/routes/test/mm-dodge/+page.svelte` + `DodgeDriver.svelte` (Unit 6)
- Test: `src/lib/features/stage/locomotion/dodge/*.test.ts`

## Open implementation checkpoints (verify, don't assume)

1. Frame reconciliation between interpolator world output and simulator
   shoulder-centered frame — confirm via `pose-target-mapper.ts`.
2. Staff length + local axis convention — take from `tip-position-bridge-3d.ts`.
3. `StanceOptimizer` candidate-gen + loss contract — read before extending.
4. Live arm-bone drive path — pick the single arm-IK source of truth.
5. Step-to-XZ must not regress verified turn-in-place + foot-lock behavior.
