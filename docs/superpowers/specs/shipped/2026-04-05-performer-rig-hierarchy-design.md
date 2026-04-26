# PerformerRig: Unified 3D Transform Hierarchy

**Date:** 2026-04-05
**Status:** Design
**Scope:** Replace the sibling-based 3D scene graph with a parent-child hierarchy that makes avatar/grid/prop/effect attachment structurally guaranteed.

---

## Problem

The 3D scene renders avatars, grids, props, and effects as **siblings** in the scene graph. Each element independently computes its world position from shared parameters (`avatarPosition`, `facingAngle`, `gridOffset`). The same body-local-to-world transform is implemented in five separate places:

| # | System | Location |
|---|--------|----------|
| 1 | Grid3D | Two-level `T.Group` hierarchy with position + rotation.y |
| 2 | Prop3D | `computePropPosition()` in `prop3d-transforms.ts` — manual cos/sin |
| 3 | Avatar3D IK | `toWorldPosition()` at line 673 — manual cos/sin + `getWorldPosition()` |
| 4 | EffectOrchestrator3D | `TipPositionBridge3D.ts` lines 36-55 — copy-pasted from Staff3D |
| 5 | Viewer3DScene | STAGE_LIFT wrapper puts avatar in different parent than grid/props |

When any of these implementations disagree — different frame timing, different edge-case handling, slightly different math for dual-wheel — elements visually detach. This is a structural problem, not a bug-by-bug problem. Patching one desync reveals another because the architecture allows disagreement.

### The STAGE_LIFT Trick

The avatar is placed at `y=STAGE_LIFT` (~1.56m, shoulder height) so IK math works, then wrapped in `T.Group position.y={-STAGE_LIFT}` to push the visual model back down to floor level. Grid and props stay at STAGE_LIFT Y without the wrapper. This means the avatar's logical position and visual position differ, and every consumer must replicate the trick (Viewer3DScene, MuseumPerformerStation3D).

### The `skipFacingTransform` Flag

Dual-wheel mode uses `facingAngle=0` with `skipFacingTransform=true`. The flag is checked in 4 places: `computePropPosition`, `computePropRotation`, `Avatar3D.toWorldPosition`, and `TipPositionBridge3D`. Since facingAngle is already 0 in dual-wheel, the flag is a no-op for position math — but it also gates the facing quaternion in rotation, which matters for prop orientation. The new design eliminates this flag entirely by making HandAnchors own the per-hand coordinate space.

---

## Solution: PerformerRig Component

A single `PerformerRig.svelte` component that owns position, facing, and the vertical offset. All visual elements are children, inheriting transforms from the scene graph. No manual cos/sin. No STAGE_LIFT trick. No `skipFacingTransform`.

### Scene Graph

```
PerformerRig (T.Group) — position=[x, groundOffset, z], rotation.y=facingAngle
│
├── AvatarSlot (T.Group) — y=0, feet at ground level
│     └── Avatar3D (conditional via showAvatar)
│
├── ShoulderAnchor (T.Group) — position.y=shoulderHeight
│     │
│     ├── GridAnchor (T.Group) — position.z=gridOffset (from planeMode config)
│     │     ├── GridPlane WALL (conditional)
│     │     ├── GridPlane WHEEL (conditional)
│     │     └── GridPlane FLOOR (conditional)
│     │
│     ├── HandAnchor blue (T.Group) — position + rotation from PlaneModeConfig
│     │     └── PropAnchor blue → Staff3D / GltfProp3D (conditional via showProps)
│     │
│     ├── HandAnchor red (T.Group) — position + rotation from PlaneModeConfig
│     │     └── PropAnchor red → Staff3D / GltfProp3D (conditional via showProps)
│     │
│     └── EffectAnchor (conditional via showEffects)
│           └── EffectOrchestrator3D
│
└── ExtrasSlot (snippet) — platform meshes, labels, consumer-specific content
```

### Dual-Wheel: How It Actually Works

The current `PLANE_MODE_CONFIGS[PlaneMode.DUAL_WHEEL]` has `facingAngle: 0` (avatar faces forward, same as wall mode). The `skipFacingTransform` flag prevents applying facing rotation to props, but since facingAngle is 0, the position math is equivalent with or without the flag. The flag matters for **rotation** — it prevents the facing quaternion from being composed into the prop's orientation.

In the new hierarchy, the PerformerRig root has `rotation.y=0` for dual-wheel (same as wall mode — driven by `avatarState.facingAngle`). Since there's no rotation on the root, there's nothing to skip. HandAnchors just provide the lateral offset:

| PlaneMode | Blue HandAnchor | Red HandAnchor |
|-----------|----------------|----------------|
| WALL | `{ x: 0, y: 0, z: gridOffset }` | `{ x: 0, y: 0, z: gridOffset }` |
| DUAL_WHEEL | `{ x: 0.4, y: 0, z: 0 }` | `{ x: -0.4, y: 0, z: 0 }` |
| CUSTOM | Per-hand, using hand's plane to determine z offset | Same |

For CUSTOM mode (one hand WALL, one hand WHEEL), each HandAnchor's z-offset is determined by the hand's plane: `z = handPlane === Plane.WALL ? gridOffset : 0`. The lateral offset is always 0 for CUSTOM (both hands share the body center).

### Interpolator Change: Drop lateralOffset Addition

Currently, `PropStateInterpolator.calculatePropState()` adds `config.lateralOffset` to `worldPosition.x` (line 181). In the new system, the HandAnchor group handles lateral offset. The interpolator must **stop adding lateralOffset** to worldPosition — otherwise the offset is double-counted (once in the interpolator output, once in the HandAnchor position).

The change in PropStateInterpolator is small:
- Delete lines 180-182 (`if (config.lateralOffset) { result.worldPosition.x += config.lateralOffset; }`)
- Delete lines 172-175 (`if (config.skipFacingTransform) { result.skipFacingTransform = true; }`)
- The `lateralOffset` and `skipFacingTransform` fields on `MotionConfig3D` become unused and can be removed

The interpolator's output becomes purely plane-local: a position on the grid circle relative to its center, with no lateral or facing adjustments. This is the correct abstraction — "where is the hand on its grid" is separate from "where is that grid in the world."

### PropAnchor Coordinate Space

PropAnchor positions are **relative to the HandAnchor** (their parent group). The interpolator outputs plane-local coordinates (position on the grid circle relative to center). Since the HandAnchor IS the grid center for that hand, the interpolator output maps directly to PropAnchor local position:

```svelte
<T.Group
  bind:ref={bluePropAnchorRef}
  position.x={bluePropState.worldPosition.x}
  position.y={bluePropState.worldPosition.y}
  position.z={bluePropState.worldPosition.z}
>
  {#if showProps}
    <Prop3D propType={bluePropType} propState={bluePropState} color="blue" />
  {/if}
</T.Group>
```

This works because:
- In wall mode: HandAnchor is at `z=gridOffset` from shoulder. PropAnchor is at `(x, y, z)` relative to HandAnchor = relative to grid center. Correct.
- In dual-wheel: HandAnchor is at `x=±0.4` from shoulder. PropAnchor is at `(x, y, z)` relative to HandAnchor. Since lateralOffset is no longer baked into the interpolator output, there's no double-counting. Correct.

### STAGE_LIFT Elimination

| Element | Current | New |
|---------|---------|-----|
| PerformerRig root | N/A | y=groundOffset (0 normally, 0.3 for museum platform) |
| Avatar | y=STAGE_LIFT, wrapped in -STAGE_LIFT group | y=0 (feet at local origin) |
| ShoulderAnchor | N/A | y=shoulderHeight (~1.56m from userProportions) |
| Grid | y=STAGE_LIFT (matches avatar logical pos) | Under ShoulderAnchor, y=0 relative to shoulder |
| Props | y=STAGE_LIFT (manual addition) | Under ShoulderAnchor, y=0 relative to shoulder |
| IK targets | Computed from STAGE_LIFT + manual rotation | Read from PropAnchor.getWorldPosition() |

`shoulderHeight` is derived from user proportions: `heightCm * 0.82 * 0.01` (approximately 1.56m for default 6'3"). This is the same value as the current `-groundY` / `STAGE_LIFT`, but expressed as a positive upward offset from ground rather than a negative downward offset from shoulder.

### Component Interface

```typescript
interface PerformerRigProps {
  /** World position (x/z). y=0 is ground level. */
  position: { x: number; z: number };
  /** Avatar body facing direction (radians, 0 = +Z toward audience) */
  facingAngle: number;
  /** Height from ground to shoulder (meters). Drives ShoulderAnchor y. */
  shoulderHeight: number;
  /** Determines grid offset, lateral hand positions */
  planeMode: PlaneMode;
  /** Avatar instance that provides prop states, step configs, etc. */
  avatarState: AvatarInstanceState;

  // Visibility toggles (all default true)
  showAvatar?: boolean;
  showGrid?: boolean;
  showProps?: boolean;
  showEffects?: boolean;

  // Grid config
  visiblePlanes?: Set<Plane>;
  gridMode?: GridMode;

  // Prop types
  bluePropType?: PropType;
  redPropType?: PropType;

  // Prop state overrides (for mirror mode — Viewer3DScene swaps before passing)
  bluePropState?: PropState3D | null;
  redPropState?: PropState3D | null;

  // Effects
  tipEffectMap?: TipEffectMap;
  isPlaying?: boolean;

  // Vertical offset (museum platforms, stages)
  groundOffset?: number;

  // Extension point for consumer-specific content
  extras?: Snippet;
}
```

### IK Target Acquisition

Avatar3D currently computes IK targets via `toWorldPosition()` — 40 lines of manual cos/sin + rootWorld offset. This is replaced by reading the PropAnchor group's world position.

Avatar3D receives `bluePropAnchorRef` and `redPropAnchorRef` as props:

```typescript
// In Avatar3D's useTask (IK section):
if (bluePropAnchorRef) {
  bluePropAnchorRef.updateWorldMatrix(true, false);
  bluePropAnchorRef.getWorldPosition(blueIKTarget);
}
if (redPropAnchorRef) {
  redPropAnchorRef.updateWorldMatrix(true, false);
  redPropAnchorRef.getWorldPosition(redIKTarget);
}
animationService.setPropsAndBlend(
  bluePropState ? { ...bluePropState, worldPosition: blueIKTarget } : null,
  redPropState ? { ...redPropState, worldPosition: redIKTarget } : null
);
```

`updateWorldMatrix(true, false)` forces the matrix chain to be current before reading, preventing stale-data issues if the useTask runs before Threlte's internal scene update.

### Effect Tip Positions

`TipPositionBridge3D` currently replicates the entire prop position pipeline to compute tip positions. In the new system, it reads world positions from the PropAnchor refs (same as IK) and computes tip offsets from the prop's rotation quaternion:

```typescript
// Tip = center +/- halfLength along the staff's local axis
const center = new Vector3();
propAnchorRef.updateWorldMatrix(true, false);
propAnchorRef.getWorldPosition(center);

const axis = new Vector3(1, 0, 0).applyQuaternion(propWorldRotation);
const thumbTip = center.clone().add(axis.multiplyScalar(halfLength));
const pinkyTip = center.clone().sub(axis.multiplyScalar(halfLength));
```

The `SceneTransforms` interface (`avatarPosition`, `facingAngle`, `gridOffset`) is deleted. EffectOrchestrator3D receives PropAnchor refs instead.

---

## Affected Files

### New
| File | Purpose |
|------|---------|
| `src/lib/shared/3d/components/PerformerRig.svelte` | The unified hierarchy component |

### Modified (Significant)
| File | Change |
|------|--------|
| `prop3d-transforms.ts` | Delete `computePropPosition()`. Simplify `computePropRotation()` and `computeFlatPropRotation()` to drop facingQuat. Delete `skipFacingTransform` branches from both rotation functions. |
| `Avatar3D.svelte` | Replace `toWorldPosition()` and manual cos/sin IK target computation with `getWorldPosition()` from PropAnchor refs. Delete WALL_OFFSET/gridOffset calculation. Delete rootWorld hack. Accept `bluePropAnchorRef`/`redPropAnchorRef` as new props. |
| `TipPositionBridge3D.ts` | Delete "replicate Staff3D" block (lines 36-55). Read from PropAnchor refs. Delete `SceneTransforms` interface. |
| `contracts/ITipPositionBridge3D.ts` | Delete `SceneTransforms` interface. Update method signatures to accept Object3D refs. |
| `EffectOrchestrator3D.svelte` | Drop `avatarPosition`, `facingAngle`, `gridOffset` props. Accept PropAnchor refs instead. |
| `Grid3D.svelte` | Drop `centerPosition`, `facingAngle`, `gridOffset` props. Render plane geometry only — positioning handled by parent GridAnchor group in PerformerRig. |
| `Viewer3DScene.svelte` | Replace sibling wiring (avatar group + grid + props + effects) with single `<PerformerRig>`. Keep mirror mode logic (swap prop states before passing). Remove STAGE_LIFT computation. Remove Environment3D STAGE_LIFT wrapper (see Environment3D section). |
| `MuseumPerformerStation3D.svelte` | Replace sibling wiring with `<PerformerRig>` + platform mesh in extras. ~227 lines to ~40 lines. |
| `PropStateInterpolator.ts` | Delete lateralOffset addition (line 180-182). Delete skipFacingTransform passthrough (line 172-175). |

### Modified (Minor)
| File | Change |
|------|--------|
| `plane-mode-configs.ts` | Remove `skipFacingTransform` field from PlaneModeConfig. Existing offset fields unchanged — they now drive HandAnchor positions. |
| `Staff3D.svelte` | Remove position computation (parent handles it). Keep rotation + geometry. |
| `GltfProp3D.svelte` | Same as Staff3D — remove position, keep rotation + geometry. |
| `Fan3D.svelte` | Remove position computation. Update to use simplified `computeFlatPropRotation()` without facingQuat. |
| `Hoop3D.svelte` | Same as Fan3D. |
| `Prop3D.svelte` | Remove `avatarPosition`, `facingAngle`, `gridOffset` props. Keep as dispatcher that selects Staff3D/GltfProp3D/Fan3D/Hoop3D. |
| `ThreeDControlsLab.svelte` | Replace direct Avatar3D + Prop3D usage with `<PerformerRig>`. Constructs a minimal AvatarInstanceState or uses the rig in props-only mode. |
| `performer-positions.ts` | `WALL_OFFSET` may become unused after migration. Remove if no remaining consumers. |

### Scene3D.svelte: Out of Scope for Initial Migration

`Scene3D.svelte` is the multi-avatar stage scene. It renders grids per-avatar and passes children (Avatar3D, Prop3D) as a snippet. Currently only used by `ThreeDControlsLab.svelte`.

Scene3D itself doesn't need to change — it's a container with camera, lighting, and environment. The snippet pattern means consumers decide what to render inside. After migration, consumers wrap their content in `<PerformerRig>` instead of manually wiring Avatar3D + Prop3D + Grid3D.

Since ThreeDControlsLab is the only consumer and it's a dev tool (not user-facing), it migrates in Phase 3 alongside MuseumPerformerStation3D. Scene3D's own grid rendering (`{#each gridPositions}`) can be removed once all consumers use PerformerRig for their grids.

### Environment3D Positioning

Viewer3DScene currently wraps Environment3D in `<T.Group position.y={STAGE_LIFT}>` to match the avatar's lifted coordinate system. After STAGE_LIFT elimination, the environment sits at y=0 (ground level) without a wrapper. Environment3D already renders its ground plane at y=0 and sky above — no special offset needed.

### First-Person Camera

Scene3D.svelte computes first-person eye position from `primaryAvatar.position.y + eyeHeight`. Currently `position.y` includes STAGE_LIFT (~1.56m). After migration, `position.y` is 0 (ground level). The eye height calculation becomes:

```
eyeY = primaryAvatar.position.y + groundOffset + SCALE.EYE_HEIGHT
```

Where `groundOffset` is passed through or read from the PerformerRig. Alternatively, the first-person camera reads the avatar's actual world-space head bone position from the scene graph (more robust, same pattern as IK).

This is addressed in Phase 5 (edge case verification) but is low risk since first-person mode is only used in the realm/village system, not the sequence viewer.

### Deleted Symbols
| Symbol | Reason |
|--------|--------|
| `SceneTransforms` interface | Transforms come from scene graph, not manual params |
| `skipFacingTransform` on PropState3D | HandAnchor groups handle per-hand coordinate space |
| `skipFacingTransform` on PlaneModeConfig | Same reason |
| `skipFacingTransform` on MotionConfig3D | Same reason |
| `computePropPosition()` function | Scene graph handles positioning |
| `lateralOffset` on MotionConfig3D | HandAnchor handles lateral offset |

---

## Verification Strategy

### Regression Prevention: Position Snapshot Tests

Before touching any code, capture the exact world positions that the current system produces for known inputs. Then assert the new system matches.

**Phase 1: Capture (before refactor)**

Create a test utility that feeds known PropState3D values through the existing `computePropPosition()` and rotation functions, recording the world-space output:

```typescript
interface PositionSnapshot {
  beat: number;
  progress: number;
  blue: {
    propCenter: [number, number, number];
    propRotation: [number, number, number, number]; // quaternion xyzw
    thumbTip: [number, number, number];
    pinkyTip: [number, number, number];
  };
  red: { /* same */ };
  grid: {
    center: [number, number, number];
    facingAngle: number;
  };
}
```

Capture snapshots for:
- **Wall mode sequence** (the common case)
- **Dual-wheel sequence** (the complex case)
- **Museum performer** (different groundOffset)
- **Multiple progress values per beat** (0.0, 0.25, 0.5, 0.75, 1.0)

Save these as JSON fixtures in `tests/unit/3d-hierarchy/`.

**Phase 2: Assert (after refactor)**

The new system's positions come from Three.js scene graph (`getWorldPosition()`), which requires actual Object3D instances with updated matrices. The assertion tests construct a **minimal Three.js scene programmatically** — no rendering needed, just the group hierarchy:

```typescript
// Construct the PerformerRig hierarchy as plain Three.js objects
const rig = new THREE.Group();
rig.position.set(pos.x, groundOffset, pos.z);
rig.rotation.y = facingAngle;

const shoulder = new THREE.Group();
shoulder.position.y = shoulderHeight;
rig.add(shoulder);

const handAnchor = new THREE.Group();
handAnchor.position.set(lateralOffset, 0, gridOffset);
shoulder.add(handAnchor);

const propAnchor = new THREE.Group();
propAnchor.position.set(propState.worldPosition.x, propState.worldPosition.y, propState.worldPosition.z);
handAnchor.add(propAnchor);

// Force matrix update and read world position
rig.updateWorldMatrix(false, true);
const worldPos = new THREE.Vector3();
propAnchor.getWorldPosition(worldPos);

// Assert matches snapshot within tolerance
expect(worldPos.x).toBeCloseTo(snapshot.blue.propCenter[0], 3);
```

This tests the math equivalence without requiring Svelte, Threlte, or a browser. Same inputs, same world-space outputs.

**Phase 3: Visual verification**

After snapshot tests pass, use Chrome DevTools MCP to:
1. Navigate to the viewer with a known sequence
2. `browser_evaluate` to query actual Object3D world positions in the running scene
3. Compare against snapshots

### Test Cases

| Test Case | What It Catches |
|-----------|----------------|
| Wall mode positions at 5 progress values | Basic hierarchy correctness |
| Dual-wheel positions | Lateral offset + no-rotation working |
| Museum with groundOffset=0.3 | Vertical offset propagation |
| Prop rotation quaternions | Rotation composition order correct (no facingQuat) |
| Tip positions (center +/- halfLength along axis) | Effect system reads correct world positions |
| IK target positions (same as prop center world pos) | Arms reach to props correctly |
| CUSTOM mode with mixed planes | Per-hand gridOffset works |

### What Tests Cannot Cover

- Visual appearance (prop clipping through avatar mesh, grid transparency)
- Animation smoothness (frame-to-frame jitter)
- Performance (scene graph depth vs flat siblings)

These require manual visual verification after snapshot tests pass.

---

## Migration Strategy

### Transition Approach: Parallel Props Interface

During migration, Prop3D keeps its old props (`avatarPosition`, `facingAngle`, `gridOffset`) as **deprecated optionals** with defaults. This lets MuseumPerformerStation3D and ThreeDControlsLab continue working while Viewer3DScene migrates first. The old props are deleted in Phase 4 after all consumers are migrated.

### Phase 1: Snapshot Capture + PerformerRig Shell
1. Write snapshot capture utility using current `computePropPosition()` pipeline
2. Capture fixtures for wall, dual-wheel, museum, and CUSTOM cases
3. Create `PerformerRig.svelte` with the hierarchy structure
4. Write snapshot assertion tests (Three.js-only, no rendering) that exercise the new hierarchy
5. Run tests — fix hierarchy until positions match snapshots

### Phase 2: Wire PerformerRig into Viewer3DScene
1. Replace sibling wiring in Viewer3DScene with PerformerRig
2. Update PropStateInterpolator (remove lateralOffset addition, remove skipFacingTransform passthrough)
3. Simplify prop3d-transforms.ts (delete `computePropPosition`, simplify rotation functions)
4. Update Avatar3D IK to read from PropAnchor refs
5. Remove STAGE_LIFT computation and Environment3D wrapper
6. Run snapshot tests — fix until they pass
7. Visual verification via Chrome DevTools

### Phase 3: Migrate Remaining Consumers
1. Replace sibling wiring in MuseumPerformerStation3D with PerformerRig + groundOffset
2. Replace direct Avatar3D/Prop3D usage in ThreeDControlsLab with PerformerRig
3. Run snapshot tests for museum and lab cases
4. Visual verification

### Phase 4: Clean Up Dead Code
1. Remove deprecated optional props from Prop3D (avatarPosition, facingAngle, gridOffset)
2. Delete `SceneTransforms` interface and `ITipPositionBridge3D` old signatures
3. Delete `skipFacingTransform` from PropState3D, MotionConfig3D, PlaneModeConfig
4. Delete `lateralOffset` from MotionConfig3D
5. Simplify TipPositionBridge3D and EffectOrchestrator3D
6. Remove dead code from Grid3D (old position/rotation props)
7. Remove `WALL_OFFSET` from performer-positions.ts if no remaining consumers
8. Remove Scene3D's internal grid rendering if all consumers use PerformerRig grids

### Phase 5: Verify Edge Cases
1. Dual-wheel mode end-to-end (both viewer and direct)
2. Mirror mode (swap happens before rig, verify visual correctness)
3. Prop type switching (staff, fan, club, hoop — all use simplified rotation)
4. Background/environment interaction (no STAGE_LIFT wrapper, ground at y=0)
5. First-person camera mode (eye height calculation updated)
6. Props-only mode (showAvatar=false, showGrid=false — props float in space)

---

## Risks

| Risk | Mitigation |
|------|------------|
| `getWorldPosition()` returns stale data on first frame | `updateWorldMatrix(true, false)` before every read in useTask |
| Scene graph depth hurts performance | Negligible — 3-4 group nodes added to a scene with hundreds of mesh nodes |
| Avatar3D prop anchor refs not available on first render | Null-check refs in useTask; IK gracefully degrades to T-pose (existing behavior) |
| Museum performers break silently (no automated visual test) | Phase 3 is a separate step with dedicated visual verification |
| Dual-wheel subtle position error from interpolator change | Snapshot tests capture exact positions before/after; +-0.001m tolerance catches any drift |
| Old consumers break during transition | Prop3D keeps deprecated optional props until Phase 4 cleanup |
| Prop rotation changes composition order | Snapshot quaternion comparison catches this; facingQuat removal is straightforward since parent group handles it |
