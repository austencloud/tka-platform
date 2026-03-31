# Finger Grip Animation System

**Date:** 2026-03-31
**Status:** Draft
**Scope:** Staff grip animation for 3D avatars — finger bone mapping, grip pose library, FingerAnimator service, debug tooling

---

## Problem

The 3D avatar system drives arm IK from TKA prop states, but hands are treated as single endpoints. The `LeftHand`/`RightHand` bones terminate the chain — the 30 finger bones present in every Mixamo GLTF model are explicitly skipped (`AvatarSkeletonBuilder.ts` lines 173-182). Props float at the wrist center with no visible grip.

This is the foundational layer for realistic prop manipulation. Every future prop type (fans, clubs, buugeng) builds on the grip system designed here. Staff is the canonical prop, the simplest to model (cylindrical, symmetric), and the one TKA was designed around.

---

## Goals

1. Map all 30 finger bones (15 per hand) from loaded GLTF models
2. Define a `GripPose` data type as an array of per-bone quaternion rotations
3. Author 5-6 grip pose presets for staff manipulation by hand
4. Build a `FingerAnimator` service (mirrors `LegAnimator` pattern) that lerps between grip poses
5. Extend `PropState3D` with a `gripType` field
6. Wire into `Avatar3D`'s frame loop alongside existing arm IK and leg animation
7. Provide a debug hand pose viewer with per-joint sliders for authoring new poses

---

## Non-Goals

- Grip animation for non-staff props (fans, clubs, buugeng, poi) — future work
- Mocap glove integration — future data source, but playback system comes first
- Finger IK (fingers reaching toward grip points dynamically) — poses are simpler, more predictable
- Per-beat grip mapping from TKA notation — Phase 2 domain work after poses look right
- Wrist rotation driven by grip state — existing IK handles wrist adequately

---

## Architecture

### Where This Fits

```
Avatar3D.svelte useTask loop (per frame):
  1. Transform prop states to world coords        [existing]
  2. AvatarAnimator.setHandTargetsFromProps()       [existing - arm IK]
  3. AvatarAnimator.update()                        [existing - pose blend + IK solve]
  4. LegAnimator.update()                           [existing - walk cycles]
  5. FingerAnimator.update()                        [NEW - grip pose blend]
```

FingerAnimator is a peer to LegAnimator. Both operate on disjoint bone sets after the main pose is resolved. No conflicts.

### Service Structure

```
src/lib/shared/3d/
  domain/models/
    GripPose.ts                    # GripPose type + GripType enum
  services/
    contracts/
      IFingerAnimator.ts           # Interface
    implementations/
      FingerAnimator.ts            # Implementation
  data/
    grip-poses/
      staff-grip-poses.ts          # Authored pose presets for staff
```

Registered in the existing 3D DI container. Instantiated per-avatar in `Avatar3D.svelte` alongside the other services (not singleton — each avatar has its own finger state).

---

## Data Model

### GripType Enum

Replaces the stub in `IAvatarAnimator.ts` line 20 (`"staff" | "open" | "fist" | "point"`).

```typescript
export enum GripType {
  /** Relaxed open hand, fingers slightly curled. Default/idle. */
  IDLE = "idle",

  /** Full palm wrap around staff shaft. Wrist-driven rotation.
   *  Used at positions where the staff is perpendicular to the forearm
   *  (e.g., west point left hand in clock orientation). */
  SQUARE = "square",

  /** Thumb + index + middle pinch, ring/pinky relaxed.
   *  Finger-driven rotation with wrist as fulcrum.
   *  Used when staff angle requires fine control. */
  PENCIL = "pencil",

  /** Light cradle in curved fingers, thumb alongside.
   *  Passive hold during float/static motions. */
  CRADLE = "cradle",

  /** Flat open palm, staff resting on top.
   *  Contact point for catches and plane transitions. */
  OPEN_PALM = "open_palm",

  /** All fingers released. Staff is airborne.
   *  Used during tosses and hand switches. */
  RELEASE = "release",
}
```

Six types is enough for staff. The previous conversation's analysis of grip vocabulary aligns with this: square grip for power, pencil for finesse, cradle for passive holds, open palm for catches, release for tosses.

### GripPose Type

```typescript
/** Finger bone names in canonical order. 15 per hand. */
export const FINGER_BONES = [
  "Thumb1", "Thumb2", "Thumb3",
  "Index1", "Index2", "Index3",
  "Middle1", "Middle2", "Middle3",
  "Ring1", "Ring2", "Ring3",
  "Pinky1", "Pinky2", "Pinky3",
] as const;

export type FingerBoneName = (typeof FINGER_BONES)[number];

/** A grip pose is 15 quaternions, one per finger bone.
 *  Indexed by FINGER_BONES order. Same structure for left and right hand
 *  (mirrored at application time by negating Y and Z components). */
export interface GripPose {
  readonly name: string;
  readonly type: GripType;
  /** 15 quaternions [x, y, z, w] in FINGER_BONES order */
  readonly rotations: readonly [number, number, number, number][];
}
```

Why quaternion tuples instead of `Quaternion` objects: serializable as plain JSON, no Three.js dependency in the data layer, trivially diffable in git.

### Mirror Convention

Poses are authored for the **left hand**. Right hand application mirrors by negating Y and Z quaternion components (reflection across the YZ plane). This halves the authoring work and guarantees symmetry.

```typescript
function mirrorQuaternion(q: [number, number, number, number]): [number, number, number, number] {
  return [q[0], -q[1], -q[2], q[3]];
}
```

---

## Finger Bone Mapping

### FingerChains Type

Defined in `GripPose.ts` alongside the other finger types:

```typescript
import type { Bone } from "three";

/** Mapped finger bones for both hands. Non-null means all 15 bones per hand were found. */
export interface FingerChains {
  left: Map<FingerBoneName, Bone>;
  right: Map<FingerBoneName, Bone>;
}
```

`IFingerAnimator.initialize()` takes `FingerChains` (the non-null variant). The nullable version (`FingerChains | null`) lives on `SkeletonState`.

### Changes to AvatarSkeletonBuilder

**Two files must be modified:**

1. **`IAvatarSkeletonBuilder.ts`** (the contract) — Add `fingerChains` to `SkeletonState`:
   ```typescript
   export interface SkeletonState {
     // ... existing fields ...
     /** Mapped finger bone chains. Null if model lacks finger bones. */
     fingerChains: FingerChains | null;
   }
   ```

2. **`AvatarSkeletonBuilder.ts`** (the implementation) — Remove finger skip logic from BOTH `mapBoneToMap()` (lines 173-182) AND `mapBone()` (lines 208-217). Note: `mapBone()` appears to be dead code (never called by `processGLTF`), but update it for consistency or remove it entirely. Add finger bone mapping logic to `processGLTF()`.

Finger bones are mapped into the new `fingerChains` field on `SkeletonState`:

```typescript
fingerChains: FingerChains | null;
```

**Bone name resolution.** Mixamo models use these naming patterns:

| Canonical | Mixamo (prefixed) | characters3d.com |
|-----------|-------------------|------------------|
| LeftHandThumb1 | mixamorigLeftHandThumb1 | L_Thumb1 |
| LeftHandIndex2 | mixamorigLeftHandIndex2 | L_Index2 |
| RightHandPinky3 | mixamorigRightHandPinky3 | R_Pinky3 |

Add these to `BONE_NAME_ALIASES` (or a parallel `FINGER_BONE_ALIASES` map to keep concerns separated). The mapping logic is identical to how arm bones are resolved today — exact match first, then contains-based fallback.

**Validation.** After mapping, check that all 15 bones per hand are found. If any are missing, `fingerChains` stays `null` and FingerAnimator gracefully no-ops. Some GLTF models may lack finger bones (low-poly avatars). The system must degrade, not crash.

### Why Not IK for Fingers

Finger IK (reaching toward grip contact points on the staff surface) sounds appealing but introduces:
- 10 additional IK chains per avatar (5 fingers x 2 hands)
- Contact point calculation requiring staff radius + hand-relative position
- Per-frame pole hint computation to prevent finger hyperextension
- Significant performance cost (10x the IK work of the current 2-chain system)

Pose-based blending is how game studios handle this. Define a few hand shapes, lerp between them. If a future phase needs finger IK for edge cases (e.g., catching a tossed staff), it can be layered on top of the pose system without replacing it.

---

## FingerAnimator Service

### Interface

```typescript
export interface IFingerAnimator {
  /** Bind to a skeleton's finger bone chains. Call after model loads. */
  initialize(fingerChains: FingerChains): void;

  /** Set the target grip for each hand. Animator lerps toward it. */
  setGrip(hand: "left" | "right", type: GripType): void;

  /** Set both hands at once (convenience for prop state updates). */
  setGrips(leftGrip: GripType, rightGrip: GripType): void;

  /** Advance animation by deltaTime seconds. Apply bone rotations. */
  update(deltaTime: number): void;

  /** Set blend speed in units per second. 1.0 = full transition in 1s, 6.0 = ~170ms. Default 6.0. */
  setBlendSpeed(speed: number): void;

  /** Whether initialize() has been called with valid finger chains. */
  isReady(): boolean;

  /** Current grip type for each hand. */
  getCurrentGrip(hand: "left" | "right"): GripType;

  /** Clean up. */
  dispose(): void;
}
```

### Implementation Pattern (mirrors LegAnimator)

```
LegAnimator                          FingerAnimator
─────────────                        ──────────────
initialize(root, mixer)              initialize(fingerChains)
setLocomotion(input)                 setGrip(hand, type)
update(delta)                        update(delta)
  → blend walk actions                 → lerp bone quaternions
  → apply to leg bones                 → apply to finger bones
dispose()                            dispose()
```

Key difference: LegAnimator uses Three.js AnimationMixer with clip blending. FingerAnimator does direct quaternion slerp on bones. No clips needed because grip poses are static targets, not keyframed animations. The blend is:

```typescript
// Per bone, per frame:
currentRotation.slerp(targetRotation, blendSpeed * deltaTime);
bone.quaternion.copy(currentRotation);
```

This is simpler than LegAnimator (no mixer, no tracks, no retargeting) and cheaper (15 slerps per hand vs. full clip evaluation).

### Blend Behavior

- **Instant snap** when `blendSpeed` is 0 or when `initialize()` is first called
- **Smooth slerp** during normal operation (~170ms for a full grip change at default speed)
- **Per-hand independent** — left and right can transition at different times
- **No overshoot** — slerp naturally converges, no spring/damping needed

### Integration in Avatar3D.svelte

```typescript
// In onMount, after existing service creation:
const fingers = new FingerAnimator();
fingerAnimator = fingers;

// After skeleton loads and finger chains are mapped:
const skeletonState = skeletonService.getState();
if (skeletonState.fingerChains) {
  fingerAnimator.initialize(skeletonState.fingerChains);
}

// IMPORTANT: After avatar hot-swap (loadAvatar), re-initialize finger chains
// from the new skeleton, same as LegAnimator re-initialization.

// In useTask loop, after legAnimator.update():
if (fingerAnimator?.isReady()) {
  // Phase 1: grip derived from prop existence, NOT from propState.gripType.
  // The gripType field on PropState3D is scaffolding for Phase 3.
  const leftGrip = bluePropState ? GripType.SQUARE : GripType.IDLE;
  const rightGrip = redPropState ? GripType.SQUARE : GripType.IDLE;
  fingerAnimator.setGrips(leftGrip, rightGrip);
  fingerAnimator.update(delta);
}
```

Phase 1 uses a single grip type (SQUARE) whenever a prop is held. The `gripType` field on `PropState3D` is **not consumed in Phase 1** — it exists as scaffolding for Phase 3's position-aware grip mapping. This immediately makes hands visually grip the staff instead of being flat/open.

---

## Grip Pose Library

### staff-grip-poses.ts

Each pose is a hand-tuned array of 15 quaternions. Initial values come from the debug pose editor (see below), then refined by visual inspection.

```typescript
import { GripType, type GripPose, FINGER_BONES } from "../../domain/models/GripPose";

export const STAFF_GRIP_POSES: Record<GripType, GripPose> = {
  [GripType.IDLE]: {
    name: "Relaxed Idle",
    type: GripType.IDLE,
    rotations: [
      // Thumb: slight abduction
      [0, 0, 0.087, 0.996],   // Thumb1: ~10deg Z
      [0, 0, 0.044, 0.999],   // Thumb2: ~5deg Z
      [0, 0, 0, 1],           // Thumb3: neutral
      // Index: slight natural curl
      [0.087, 0, 0, 0.996],   // Index1: ~10deg X
      [0.131, 0, 0, 0.991],   // Index2: ~15deg X
      [0.087, 0, 0, 0.996],   // Index3: ~10deg X
      // ... Middle, Ring, Pinky with progressively more curl
    ],
  },

  [GripType.SQUARE]: {
    name: "Square Staff Grip",
    type: GripType.SQUARE,
    rotations: [
      // Thumb: wrapped around staff, opposing fingers
      // Index-Pinky: fully curled around staff shaft (~90deg each joint)
      // ... values authored in debug editor
    ],
  },

  // ... PENCIL, CRADLE, OPEN_PALM, RELEASE
};
```

**Authoring workflow:**
1. Load avatar in debug viewer
2. Use per-joint sliders to pose hand
3. Copy quaternion array from debug panel
4. Paste into `staff-grip-poses.ts`
5. Verify visually with staff model present

The initial implementation ships with IDLE and SQUARE fully authored. Other poses get placeholder values (copies of IDLE) and are refined iteratively. Two working poses is enough to prove the pipeline end-to-end.

---

## Debug Hand Pose Viewer

A development-only Svelte component for authoring grip poses. Not part of the production build.

### Requirements

- Renders a single hand (left) with the loaded GLTF skeleton
- 15 sliders (one per finger bone), each controlling X rotation (the primary flex axis)
- Optional Y/Z rotation sliders (collapsed by default, for thumb abduction and finger spread)
- Staff cylinder rendered at a fixed position for visual reference
- "Copy as JSON" button that dumps the current 15 quaternions in the `GripPose.rotations` format
- "Load preset" dropdown to load existing poses for refinement
- Reset button to return to identity quaternions

### Where It Lives

```
src/lib/features/lab/tabs/hand-pose-editor/
  HandPoseEditor.svelte          # Main editor component
  FingerSliderGroup.svelte       # Slider group for one finger (3 bones)
```

Lab module already serves as the development sandbox. This is a new tab, registered in lab tab definitions. It's excluded from production builds by the existing lab feature flag.

### Technical Notes

- Uses the same `AvatarSkeletonBuilder` and model loading as Avatar3D
- Operates on the raw bone references — no FingerAnimator needed (direct quaternion sets)
- Camera positioned at hand-level, close-up, with orbit controls
- Staff is a simple `CylinderGeometry` at a known position relative to the hand

---

## PropState3D Extension

### Change to PropState3D Interface

```typescript
interface PropState3D extends PropState2D {
  plane: Plane;
  worldPosition: Vector3;
  worldRotation: Quaternion;
  /** Grip type for the hand holding this prop. Defaults to SQUARE for staff. */
  gripType?: GripType;
}
```

Optional field. When absent, FingerAnimator defaults to `GripType.SQUARE` (the safest assumption for a held staff).

### Phase 1: Static Grip

PropStateInterpolator does NOT compute gripType in Phase 1. It's always undefined, which means always SQUARE when a prop exists, IDLE when no prop. This is correct for a first pass — the staff is always gripped the same way.

### Phase 2: Position-Aware Grip (Future)

A `GripMapper` service maps (position, orientation, motionType, plane) → GripType. This is domain knowledge:

- At west/east points with staff perpendicular to forearm → SQUARE
- During finger-driven rotation → PENCIL
- Float motions → CRADLE
- Tosses → RELEASE at release point, OPEN_PALM at catch point

This is explicitly deferred. The domain mapping is Austen's expertise and should be authored by hand, not guessed.

---

## Performance Budget

Per avatar, per frame:
- **Bone lookup:** 0 (cached references from initialize)
- **Slerp operations:** 30 (15 bones x 2 hands)
- **Quaternion copies:** 30

For context, the existing arm IK solver does ~50 vector operations per frame per avatar. The finger animator adds ~60 quaternion operations. This is negligible. Even with 4 avatars on screen (collaboration room), total finger work is ~240 slerps — well under 0.1ms on any modern GPU/CPU.

No LOD system needed. If a future phase has 20+ avatars, finger animation can be distance-culled (skip slerp for avatars beyond N meters), but that's optimization for a problem that doesn't exist yet.

---

## Implementation Phases

### Phase 1: Bones + Pipeline (This Spec)

1. Extend `AvatarSkeletonBuilder` to map finger bones
2. Create `GripPose` and `GripType` types
3. Create `IFingerAnimator` interface and `FingerAnimator` implementation
4. Author IDLE and SQUARE grip poses (using debug editor)
5. Build the Hand Pose Editor lab tab
6. Wire FingerAnimator into Avatar3D frame loop
7. Add `gripType` field to PropState3D (optional, unused in Phase 1)
8. Register in DI container

**Exit criteria:** Avatar holding a staff visually grips it with curled fingers. Releasing the staff returns hand to idle pose with smooth blend. Works with all Mixamo models (X-Bot, Y-Bot, Remy).

### Phase 2: Full Pose Library

- Author remaining 4 poses (PENCIL, CRADLE, OPEN_PALM, RELEASE) using the debug editor
- Test transitions between all pose pairs
- Tune blend speed per transition type (SQUARE → RELEASE should be faster than SQUARE → PENCIL)

### Phase 3: Position-Aware Grip Mapping

- Build `GripMapper` service with Austen's domain knowledge
- Wire into PropStateInterpolator or a post-processing step
- Map TKA positions and motion types to grip changes

### Phase 4: Multi-Prop Support (Future)

- Prop-specific pose libraries (fan grip vs staff grip vs club grip)
- PropType field on PropState3D determining which pose set to use
- Pose library registry keyed by prop type

### Phase 5: Data Capture (Future)

- Mocap glove integration (Manus, StretchSense)
- Recording pipeline: glove → finger joint angles → GripPose format
- Capture synchronized with TKA beat positions
- Replaces manually authored poses with captured data

---

## File Manifest

New files to create:

| File | Purpose |
|------|---------|
| `src/lib/shared/3d/domain/models/GripPose.ts` | GripType enum, GripPose interface, FINGER_BONES constant, mirror utility |
| `src/lib/shared/3d/services/contracts/IFingerAnimator.ts` | Service interface |
| `src/lib/shared/3d/services/implementations/FingerAnimator.ts` | Quaternion slerp animation, per-hand state |
| `src/lib/shared/3d/data/grip-poses/staff-grip-poses.ts` | Authored pose presets for staff |
| `src/lib/features/lab/tabs/hand-pose-editor/HandPoseEditor.svelte` | Debug pose authoring tool |
| `src/lib/features/lab/tabs/hand-pose-editor/FingerSliderGroup.svelte` | Per-finger slider UI |

Files to modify:

| File | Change |
|------|--------|
| `AvatarSkeletonBuilder.ts` | Remove finger skip logic, add finger chain mapping, add `FINGER_BONE_ALIASES` |
| `PropState3D.ts` | Add optional `gripType` field |
| `Avatar3D.svelte` | Instantiate FingerAnimator, wire into frame loop |
| `IAvatarAnimator.ts` | Update `gripType` stub comment to reference GripType enum |
| `IAvatarSkeletonBuilder.ts` | Add `fingerChains: FingerChains \| null` to `SkeletonState` interface |
| Lab tab registration | Register HandPoseEditor as a new lab tab (note: this introduces a nested subdirectory pattern under `tabs/` since the editor has two components) |

---

## Resolved Decisions

1. **Per-avatar instantiation, not DI singleton.** `Avatar3D.svelte` instantiates all animation services with `new` (lines 219-224). FingerAnimator follows this pattern. Each avatar gets its own instance with its own blend state. No DI container registration needed.

## Open Questions

1. **Staff contact point.** Currently Staff3D is positioned independently and the hand reaches its center via IK. With finger grip, should the staff position be adjusted so it sits between the curled fingers rather than at the wrist center? Likely yes — a small offset (~2cm along the grip axis) would make the visual connection convincing. This is a tuning parameter, not an architectural decision.

2. **Thumb opposition axis.** Thumb movement is primarily abduction/adduction (Y-axis) plus flexion (Z-axis), unlike the other fingers which are primarily X-axis flexion. The slider UI needs to account for this — thumb sliders should default to Y/Z visible, not X.

---

## References

- `LegAnimator.ts` — The pattern to follow for body-part animators
- `AvatarSkeletonBuilder.ts` — Bone mapping infrastructure to extend
- `Avatar3D.svelte` lines 208-237 — Per-avatar service instantiation pattern
- `IAvatarAnimator.ts` line 20 — Existing gripType stub
- `PropState3D.ts` — Interface to extend
- Mixamo skeleton docs — Standard finger bone naming (`LeftHandThumb1` through `RightHandPinky3`)
