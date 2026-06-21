# Body Freedom — Iterative Aim Spine Solver

## Goal

Replace the fixed-weight spine twist distribution with an iterative aim solver (ozz-animation pattern) that naturally produces anatomically correct body rotation toward hand targets. Add a "Body Freedom" slider with three presets (Square / Natural / Expressive) so performers can tune how much the avatar's torso engages when spinning.

## Architecture

Extend the existing `spine-twister.ts` module. Same interface to `AvatarAnimator` — the animator calls the function, gets back per-bone quaternions, applies them the same way. The internal algorithm changes from "compute yaw angle, distribute by fixed percentages" to "iteratively aim each spine bone at the target, cascading residual error."

The Spine bone (between Hips and Spine1, currently unused by the twist system) joins the rotation chain. Legs are children of Hips, not Spine — they stay planted.

### Pipeline Position (unchanged)

```
Root motion yaw → Body rotation (spine chain) → Clavicle raise → Pole vectors → IK solve → Anatomical constraints → Free-axis slide → Blend
```

## Core Algorithm: Iterative Aim with Residual Cascading

### Per-frame solve

```
Input: leftHandTarget, rightHandTarget, bodyCenter, bodyFreedom (0–1)
Output: quaternion per bone (Spine, Spine1, Spine2, Neck, Head, Hips)

1. Compute aim target (3D position, not just yaw angle)
   - Two hands: midpoint of both hand positions, then offset toward the more cross-body hand
     using the existing lateralBias + crossTension signal (same math as current spine-twister).
     The target is a 3D point — its Y coordinate naturally encodes tilt (forward lean),
     so tilt does not need a separate pass.
   - Single hand: that hand's position directly
   - No hands: identity (no rotation)

2. Interpolate per-bone parameters from bodyFreedom slider
   - aimWeights = lerp(SQUARE_WEIGHTS, EXPRESSIVE_WEIGHTS, bodyFreedom)
   - maxRotations are constant (anatomical limits, not tunable)

3. Iterate bottom-to-top through spine chain [Spine, Spine1, Spine2, Neck, Head]
   For each bone:
     a. Compute aim direction: normalize(target - bone.worldPosition)
     b. Compute current forward: bone's local Y-axis in world space
     c. Compute full aim rotation: quaternionFromTo(currentForward, aimDirection)
     d. Decompose into swing + twist (reuse swing-twist decomposition from shoulder constraints)
     e. Scale swing by bone's aimWeight: slerp(identity, swing, weight)
     f. Clamp swing to bone's maxRotation
     g. Scale twist by bone's aimWeight, clamp to bone's maxTwist
     h. Compose: bone.quaternion = restQuat × clampedSwing × clampedTwist
     i. Update world matrix (propagate to children before solving next bone)

4. Hip counter-rotation
   - Compute total yaw contributed by spine chain
   - Apply hipCounterFraction × totalYaw to Hips bone (same as current)
   - hipCounterFraction interpolated from presets (−0.20 at Square → −0.10 at Expressive)

5. Tilt (forward lean)
   - Same signal as current: height factor × cross-body factor
   - Folded into the aim target: the target is a 3D position, so its Y coordinate naturally
     encodes tilt. No separate tilt pass needed — the iterative aim handles both yaw and tilt
     in a single solve.
   - Max tilt stays at 25° (enforced by per-bone swing limits which cap vertical deflection)
```

### Why iterative aim beats fixed distribution

Fixed distribution: every bone gets a prescribed fraction of one precomputed angle. Produces uniform C-curve at all rotation magnitudes. Looks robotic at high angles.

Iterative aim: each bone sees only the remaining error after all bones below it contributed. Lower spine absorbs the bulk; upper spine refines. Natural S-curve emerges from the solve — the distribution is a consequence of the weights, not manually prescribed.

At low rotation amounts (Square preset, mild cross-body), behavior is nearly identical to current. The difference only matters at high rotations where fixed percentages produce obviously wrong body shapes.

## Per-Bone Parameters

### Aim Weights (interpolated by Body Freedom slider)

| Bone | Square (0%) | Natural (50%) | Expressive (100%) |
|------|-------------|---------------|-------------------|
| Spine | 0.00 | 0.40 | 0.60 |
| Spine1 | 0.30 | 0.30 | 0.30 |
| Spine2 | 0.35 | 0.35 | 0.35 |
| Neck | 0.15 | 0.25 | 0.30 |
| Head | 0.80 | 0.90 | 1.00 |

Only the Spine bone's weight changes dramatically across the range. Other bones' weights are adjusted mildly. Head approaches 1.0 at Expressive (terminal bone absorbs all residual gaze error).

### Max Rotation Limits (anatomical, constant)

| Bone | Max Swing | Max Twist | Anatomical Basis |
|------|-----------|-----------|------------------|
| Spine (lumbar) | 35° | 25° | L1–L5 axial rotation + lateral flexion |
| Spine1 (lower thoracic) | 25° | 15° | T7–T12 (rib cage limits rotation) |
| Spine2 (upper thoracic) | 20° | 12° | T1–T6 (most constrained thoracic region) |
| Neck (cervical) | 45° | 35° | C1–C7 (high mobility) |
| Head | 70° | 50° | Atlanto-occipital + atlanto-axial joints |

These limits enforce anatomical correctness regardless of slider position. The aim weight controls how much the bone wants to rotate; the limit caps how much it can.

### Hip Counter-Rotation (interpolated)

| Parameter | Square | Natural | Expressive |
|-----------|--------|---------|------------|
| hipCounterFraction | −0.20 | −0.15 | −0.10 |

Less counter-rotation at higher freedom levels — the performer's body faces the target more fully.

### Visible Rotation Budgets

| Preset | Max torso yaw (Spine+Spine1+Spine2) | Max total with neck/head |
|--------|--------------------------------------|--------------------------|
| Square | ~36° (same as current) | ~60° |
| Natural | ~68° | ~100° |
| Expressive | ~90° | ~130° |

## Body Freedom Presets

Three named positions on a continuous 0–100% slider:

- **Square** (0%): Current behavior. Chest stays forward. Arms do all the reaching. Spine bone weight = 0.
- **Natural** (50%): Moderate body engagement. Lumbar spine rotates to meet targets. Comfortable for casual spinning.
- **Expressive** (100%): Full body engagement. Hips lead, torso follows, head tracks. Props can flow toward behind-body positions.

The slider value is a single float (0.0–1.0) stored in state. All per-bone parameters are derived by linear interpolation between the Square and Expressive endpoint tables. Named presets are just UI shortcuts to 0%, 50%, 100%.

## State Management

### Where body freedom lives

Add to `UserProportionsState` (same reactive state that manages height and staff length):

```typescript
bodyFreedom: number  // 0.0–1.0, default 0.5 (Natural)
```

Persisted to localStorage alongside existing proportions. Reactive — slider changes immediately affect the solve.

### Interface to spine twister

`computeSpineTwist()` gains one new parameter:

```typescript
export function computeSpineTwist(
  leftHandTarget: Vector3 | null,
  rightHandTarget: Vector3 | null,
  bodyCenter: Vector3,
  bodyFreedom: number,           // NEW: 0.0–1.0
  availableBones?: Set<string>,
): SpineTwistResult
```

`SpineTwistResult` gains the `spine` key:

```typescript
export interface SpineTwistResult {
  spine: Quaternion;   // NEW
  spine1: Quaternion;
  spine2: Quaternion;
  neck: Quaternion;
  head: Quaternion;
  hips: Quaternion;
}
```

### AvatarAnimator integration

- Cache rest quaternion for "Spine" bone alongside existing Spine1/Spine2/Neck/Head/Hips
- Add "Spine" to `availableSpineBones` set
- Apply `twistResult.spine` to the Spine bone using the same compose-with-rest-quat pattern
- Pass `bodyFreedom` from state into `computeSpineTwist()`

## UI: Gear Popover Scene Tab

Add below the existing prop size slider:

```
Body Freedom
[Square] [Natural] [Expressive]
|--------●----------------------| 50%
```

Three preset buttons (styled as pill toggles, not checkboxes). Clicking a preset snaps the slider. Dragging the slider deselects the active preset if the value doesn't match.

Implementation follows the same pattern as the prop size slider already in the gear popover.

## Swing-Twist Reuse

The `swing-twist-constraint.ts` module (just shipped for shoulder/elbow constraints) provides `decomposeSwingTwist()`. The iterative aim solver uses the same decomposition per spine bone to:

1. Separate the aim rotation into swing (direction change) and twist (axial roll)
2. Scale each independently by the aim weight
3. Clamp each to the bone's anatomical limits

No new math module needed. Direct reuse of existing infrastructure.

## Smoothing

The existing `smoothingFactor` slerp in AvatarAnimator applies to the final per-bone quaternion. This prevents popping when:
- Switching between sequences (targets jump)
- Hand targets cross the midline (lateralBias sign flips)
- Body freedom slider changes (parameter interpolation + smooth application)

No changes to the smoothing system needed.

## Debug Hook

Add `__toggleBodyFreedom()` to `avatar-debug-hooks.ts` following the existing pattern for `__toggleSpineTwist` and `__toggleConstraints`. Cycles through Square → Natural → Expressive → Square.

## Testing

### Unit tests for iterative aim

1. Identity when no targets — all bones return rest quaternions
2. Single target directly ahead — minimal rotation (near-identity swing)
3. Target 45° left — Spine absorbs bulk, Spine1/Spine2 refine, Head locks on
4. Target 90° left (Expressive) — rotation distributes across full chain, each bone under its max limit
5. Target behind body (135°) — bones saturate at anatomical limits, residual remains
6. Body freedom 0.0 — Spine bone contributes nothing, behavior matches current system
7. Body freedom 1.0 — Spine bone contributes maximally
8. Smooth transition — changing bodyFreedom from 0 to 1 produces no jumps in output quaternions
9. Single-hand mode — only one target, reduced weights, no hip counter-rotation

### Regression tests

10. At bodyFreedom=0.0, Spine bone contributes nothing and the remaining bones (Spine1, Spine2, Neck, Head)
    produce qualitatively similar rotation to the old fixed-distribution system. Not numerically identical —
    iterative aim inherently distributes differently — but the visual result at low rotation amounts is
    indistinguishable. Existing test assertions may need updated expected values.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/shared/3d/services/spine-twister.ts` | Replace fixed distribution with iterative aim algorithm |
| `src/lib/shared/3d/services/implementations/AvatarAnimator.ts` | Cache Spine bone rest quat, apply twistResult.spine, pass bodyFreedom |
| `src/lib/shared/3d/state/user-proportions-state.svelte.ts` | Add bodyFreedom field (0–1, default 0.5, persisted) |
| `src/lib/shared/3d/components/Viewer3DGearPopover.svelte` | Add Body Freedom presets + slider to Scene tab |
| `src/lib/shared/3d/debug/avatar-debug-hooks.ts` | Add __toggleBodyFreedom debug hook |
| `tests/unit/3d-animation/spine-twist.test.ts` | New: iterative aim unit tests |
| `tests/unit/3d-animation/user-proportions.test.ts` | Update: bodyFreedom in state tests |

## Scope Boundaries

### In scope
- Iterative aim solver replacing fixed-weight distribution in spine-twister.ts
- Spine bone joining the rotation chain
- Body Freedom slider + presets in gear popover
- Per-bone anatomical rotation limits
- Swing-twist decomposition reuse for spine bones
- Debug hook for cycling presets

### Out of scope (future iterations)
- Leg IK / stance changes when body rotates
- Full performer-relative planes (body-relative grid)
- Behind-body plane transitions (requires stance changes)
- Motion-matching or data-driven body poses
- Multi-effector simultaneous solve (FBIK)
