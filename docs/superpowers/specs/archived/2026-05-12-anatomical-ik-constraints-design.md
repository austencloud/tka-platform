---
status: archived
value: 1
effort: M
remaining: "Body status: Draft"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-08-01
---
# Anatomical IK Constraints

> **Archived 2026-08-01 (GHOST_PATHS):** the deliverables this spec names no longer exist on disk (AvatarAnimator, IKSolver, avatar-debug-hooks, and plane-mode-configs were deleted; only swing-twist-constraint.ts survives). The avatar 3D substrate it targeted was removed; if this capability returns it needs a fresh spec against the current scene architecture.

**Date:** 2026-05-12  
**Status:** Draft  
**Scope:** Fix 3D avatar arm IK to produce only physically possible anatomy; adjust dual wheel plane offset

## Problem

The current analytic two-bone IK solver (`IKSolver.solveTwoBone()`) computes shoulder and elbow rotations purely from geometry and pole hints. No anatomical constraints are enforced on the primary solve path. The `applyConstraints()` method exists but runs only in the unused CCD fallback. Even that approach is wrong — Euler-angle clamping creates box-shaped joint limits when real joints have cone-shaped ranges.

Result: arms go through the torso on cross-body reaches, shoulders hyperextend on behind-the-back positions, elbows flip direction near singularities, and overhead positions produce impossible shoulder angles.

Additionally, dual wheel mode positions the movement grid at z=0 (body center), giving shoulders no forward room and producing awkward poses when hands are near the body on the wheel plane.

## Approach: Swing-Twist Post-Constraint

Standard game-engine approach (Unity CharacterJoint, Unreal cone+twist model). Keep the fast analytic solver, add a constraint enforcement pass after the solve.

**Key references:**
- Allen Chou: "Swing-Twist Interpolation" (production-proven quaternion decomposition)
- Daniel Holden: "Joint Limits" (game-engine constraint patterns)
- VRArmIK (dabeschte/VRArmIK): VR arm model with elbow swivel estimation
- Unity CharacterJoint: Swing1Limit + Swing2Limit + TwistLimit model

### Why not replace the solver?

The analytic solver is O(1), exact, and mechanically correct. The problem is purely missing guardrails. Adding constraints post-solve is cheaper than adopting a new iterative solver (upf-gti/IK-threejs) that would need architecture adaptation and runs slower.

## Design

### 1. Swing-Twist Decomposition

New file: `src/lib/shared/3d/services/swing-twist-constraint.ts`

Decompose a quaternion Q into swing and twist components relative to a chosen axis:

```
Q = Q_swing × Q_twist
```

Where:
- **Twist** = rotation around the bone's longitudinal axis (e.g., internal/external rotation of the upper arm)
- **Swing** = rotation perpendicular to that axis (where the arm points in space)

Algorithm (from Marc B. Reynolds / Allen Chou):
1. Project Q's vector part onto the twist axis
2. Normalize to get Q_twist
3. Q_swing = Q × inverse(Q_twist)

This avoids gimbal lock entirely. Euler angles cannot represent cone constraints correctly because independent axis clamping produces a box, not a cone.

### 2. Shoulder Constraint — Elliptical Cone

Model the glenohumeral joint's range of motion as an elliptical swing cone:

| Direction | Limit | Anatomical basis |
|---|---|---|
| Forward (flexion) | 160° | Arm reaching forward/up |
| Backward (extension) | 60° | Arm reaching behind |
| Abduction (out to side) | 170° | Arm raised sideways |
| Adduction (across chest) | 45° | Arm crossing midline |

These values come from standard biomechanics references for glenohumeral ROM. The elliptical shape means the cone is wider in the abduction/adduction plane than the flexion/extension plane — matching real anatomy.

**Twist limits** (separate from swing):
- Internal rotation: -90°
- External rotation: +90°

**Clamping behavior:** When the analytic solver produces a shoulder rotation outside the cone, project the swing component onto the nearest point on the ellipse boundary. The hand target may not be reached exactly — this is correct, a real human cannot reach there either.

### 3. Elbow Constraint — True Hinge

Model the elbow as a 1-DOF hinge joint:

1. Project elbow rotation onto the flexion plane (perpendicular to the pole vector / bend axis)
2. Clamp flexion angle to 0°–145°
3. Remove all off-axis rotation (current ±5° Y/Z tolerance in `getHumanoidConstraints()` is eliminated — elbows do not rotate in those axes)

The pole vector from `elbow-pole-computer.ts` determines which direction the elbow bends. The hinge constraint ensures it can ONLY bend in that plane.

### 4. Integration Point

In `AvatarAnimator.applyIKToSkeleton()`, after `ikSolver.solveAndApply(chain, target)` and before the animation blend:

```
solveTwoBone → constrainShoulder(chain.root) → constrainElbow(chain.middle) → re-derive forearm → blend
```

When shoulder clamping moves the upper arm direction, the forearm direction must be re-derived (elbow-to-clamped-target) so the arm chain stays consistent.

Per-arm, ~6 lines of integration code.

### 5. Dual Wheel Forward Offset

Change in `plane-mode-configs.ts`:

```typescript
GRID_OFFSETS[DUAL_WHEEL]: 0 → 0.10    // 10cm forward
GRID_OFFSETS[CONJOINED_WHEEL]: 0 → 0.10
```

10cm forward nudge gives shoulders room to rotate naturally. Hands still clearly at the performer's sides — not pushed far enough forward to look like wall mode. The `LATERAL_OFFSET` (0.40m) stays unchanged.

### 6. Debug Toggle

Add `window.__toggleConstraints()` debug hook (consistent with existing `__togglePoleVectors()` and `__toggleClavicleRaise()`). Allows A/B comparison of constrained vs unconstrained to verify the constraints are helping, not hindering.

## Files Changed

| File | Change |
|---|---|
| **NEW** `src/lib/shared/3d/services/swing-twist-constraint.ts` | Swing-twist decomposition, elliptical cone clamp, hinge clamp |
| `src/lib/shared/3d/services/implementations/IKSolver.ts` | No structural change; constraints applied externally after solve |
| `src/lib/shared/3d/services/implementations/AvatarAnimator.ts` | Call constraint pass between solve and blend (~6 lines per arm) |
| `src/lib/shared/3d/domain/constants/plane-mode-configs.ts` | Dual wheel + conjoined wheel grid offsets 0 → 0.10 |
| `src/lib/shared/3d/debug/avatar-debug-hooks.ts` | Add `__toggleConstraints()` hook |

## Files NOT Changed

| File | Why |
|---|---|
| `elbow-pole-computer.ts` | Pole vectors still guide bend direction; constraints enforce limits |
| `clavicle-raiser.ts` | Scapulohumeral rhythm already implemented correctly |
| `spine-twister.ts` | Torso rotation unaffected |

## Verification Plan

1. Load 3D viewer with sequences that hit each failure mode:
   - Cross-body reaches (arm through torso)
   - Overhead positions (impossible shoulder angles)
   - Near-body positions (near-reach singularity)
   - Full extension (far-reach singularity, elbow flip)
   - Dual wheel mode (shoulder cramping)
2. Toggle constraints on/off via debug hook to A/B compare
3. Build + typecheck green
4. No new dependencies
