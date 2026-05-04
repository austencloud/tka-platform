---
status: shipped
value: 4
effort: M
remaining: ""
depends_on: ""
plan_path: plans/backlog/2026-04-05-atomic-plane-system.md
tags: []
last_triaged: 2026-05-04
---
# Atomic Plane System (L8) — Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Scope:** L8 implementation with L9-ready data model

---

## Problem

TKA currently renders all sequences on the wall plane (XY). The 3D viewer has plane transform infrastructure (`planeAngleToWorldPosition`, `Plane` enum, `PropState3D.plane`) but everything funnels through `SequenceConverter` which hardcodes `Plane.WALL`. There is no way to assign different planes to different hands or beats.

## Solution

Per-hand per-beat plane assignment. Each hand on each beat can operate on Wall, Wheel, or Floor independently. The data model supports all 9 planes (3 primaries + 6 fusions) from day one, but the L8 UI only exposes the 3 primaries. L9 unlocks fusions.

---

## The Nine-Plane System

### 3 Primary Planes (L8)

| Plane | Normal | Vantage | Grid Remapping |
|-------|--------|---------|----------------|
| **Wall** | (0, 0, 1) | From behind performer | N=up, S=down, E=stage right, W=stage left |
| **Wheel** | (1, 0, 0) | From stage right | N=up, S=down, E=audience, W=upstage |
| **Floor** | (0, 1, 0) | From above | N=audience, S=upstage, E=stage right, W=stage left |

### Diamond Mode Gate Table (L8)

Every cardinal position sits on exactly 2 primary plane circles. Plane switching at L8 is diamond-mode only.

| 3D Position | Coordinates | Plane A (label) | Plane B (label) |
|-------------|-------------|-----------------|-----------------|
| Up | (0, r, 0) | Wall (N) | Wheel (N) |
| Down | (0, -r, 0) | Wall (S) | Wheel (S) |
| Stage Right | (r, 0, 0) | Wall (E) | Floor (E) |
| Stage Left | (-r, 0, 0) | Wall (W) | Floor (W) |
| Downstage | (0, 0, r) | Wheel (E) | Floor (N) |
| Upstage | (0, 0, -r) | Wheel (W) | Floor (S) |

### Box Mode at L8

Box mode intercardinal positions (NE, SE, SW, NW) sit on only 1 primary plane circle. No plane switching is possible in box mode at L8. Box mode plane switching requires fusion planes, which are L9 content.

### 6 Fusion Planes (L9 — data model only, no UI)

| Fusion | Nickname | Normal | Rotation Axis | Passes Through |
|--------|----------|--------|---------------|----------------|
| Wall+Wheel (R) | Right Shield | (1/√2, 0, 1/√2) | Y | Up, Down |
| Wall+Wheel (L) | Left Shield | (-1/√2, 0, 1/√2) | Y | Up, Down |
| Wall+Floor (Fwd) | Forward Ramp | (0, 1/√2, -1/√2) | X | Stage R, Stage L |
| Wall+Floor (Bwd) | Backward Ramp | (0, 1/√2, 1/√2) | X | Stage R, Stage L |
| Wheel+Floor (R) | Right Wing | (1/√2, 1/√2, 0) | Z | Downstage, Upstage |
| Wheel+Floor (L) | Left Wing | (-1/√2, 1/√2, 0) | Z | Downstage, Upstage |

### Box Mode Gate Table (L9)

| Position | Primary | Fusion |
|----------|---------|--------|
| Wall NE / SW | Wall | Left Wing |
| Wall SE / NW | Wall | Right Wing |
| Wheel NE / SW | Wheel | Forward Ramp |
| Wheel SE / NW | Wheel | Backward Ramp |
| Floor NE / SW | Floor | Left Shield |
| Floor SE / NW | Floor | Right Shield |

### Triagonal Positions (L9)

8 body-diagonal positions at (±1/√3, ±1/√3, ±1/√3) × r. Each sits on 3 fusion planes (triple gate). These form 4 antipodal pairs. Together with diamond (6) and box (12) positions: 26 total unique positions across 9 planes. Geometry matches the 26 neighbors of a center cell in a 3×3×3 Rubik's cube.

Reference visualization: `docs/reference/plane-geometry/nine-plane-atlas-3d.html`

---

## Level Gating

| Level | Planes Available | Grid Mode Constraint |
|-------|-----------------|---------------------|
| L1-L7 | Wall only (field hidden) | N/A |
| L8 (Atomics) | Wall + Wheel + Floor | Diamond mode sequences only get plane switching |
| L9 (Rubik's Cube) | All 9 planes | Box mode gets fusion gates, triagonal positions |

## Premium Gating

Multi-plane features are premium-only. Free users see all sequences rendered on wall plane regardless of stored plane data.

---

## Data Model Changes

### MotionData — add `plane` field

```typescript
// src/lib/shared/pictograph/shared/domain/models/MotionData.ts
interface MotionData {
  // ... existing fields ...
  readonly plane?: Plane; // defaults to Plane.WALL if absent
}
```

### Plane Enum — extend with all 9

```typescript
// src/lib/shared/3d/domain/enums/Plane.ts
export enum Plane {
  // Primaries (L8)
  WALL = "wall",
  WHEEL = "wheel",
  FLOOR = "floor",
  // Fusions (L9 — data model only)
  RIGHT_SHIELD = "right-shield",
  LEFT_SHIELD = "left-shield",
  FORWARD_RAMP = "forward-ramp",
  BACKWARD_RAMP = "backward-ramp",
  RIGHT_WING = "right-wing",
  LEFT_WING = "left-wing",
}
```

### plane-transforms.ts — add normals for all 9

Each plane needs a normal vector, up vector, and right vector. The existing `planeAngleToWorldPosition()` already takes a `Plane` parameter — extend the switch statement to handle all 9. For fusion planes, derive `up` and `right` from the normal using cross products with a reference vector.

```typescript
const S2 = 1 / Math.sqrt(2);

const PLANE_NORMALS: Record<Plane, Vector3> = {
  [Plane.WALL]:           new Vector3(0, 0, 1),
  [Plane.WHEEL]:          new Vector3(1, 0, 0),
  [Plane.FLOOR]:          new Vector3(0, 1, 0),
  [Plane.RIGHT_SHIELD]:   new Vector3(S2, 0, S2),
  [Plane.LEFT_SHIELD]:    new Vector3(-S2, 0, S2),
  [Plane.FORWARD_RAMP]:   new Vector3(0, S2, -S2),
  [Plane.BACKWARD_RAMP]:  new Vector3(0, S2, S2),
  [Plane.RIGHT_WING]:  new Vector3(S2, S2, 0),
  [Plane.LEFT_WING]:   new Vector3(-S2, S2, 0),
};

// Derive up/right for any plane from its normal.
// Convention: "up" is the component closest to world +Y,
// "right" is the cross product of up and normal.
function getPlaneVectors(plane: Plane): { up: Vector3; right: Vector3 } {
  const normal = PLANE_NORMALS[plane].clone();
  const worldUp = new THREE.Vector3(0, 1, 0);

  // If normal is nearly parallel to worldUp (Floor plane),
  // use worldZ as the reference instead.
  const ref = Math.abs(normal.dot(worldUp)) > 0.9
    ? new THREE.Vector3(0, 0, -1)
    : worldUp;

  const right = new THREE.Vector3().crossVectors(ref, normal).normalize();
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  return { up, right };
}
```

### Backward Compatibility

All existing sequences have no `plane` field. The system treats absent/undefined as `Plane.WALL`. No migration needed. No existing data changes.

### Persistence

The `plane` field must round-trip through Firebase save/load and JSON import/export:

1. **`createMotionData` factory** — Add `plane: data.plane ?? undefined` to pass through the field. Without this, any MotionData created via the factory silently drops plane data.
2. **Firebase serialization** — MotionData is serialized as plain objects. Optional fields with `undefined` values are omitted by `JSON.stringify`, which is correct (absent = WALL on load). Fields with valid Plane enum values persist as strings (`"wheel"`, `"floor"`, etc.).
3. **Import/export** — The import pipeline creates MotionData via `createMotionData`. Once the factory passes through `plane`, round-tripping works automatically.

### Precedence: MotionData.plane vs PlaneModeConfig

Two sources can set a hand's plane: the per-beat `MotionData.plane` field (authored data) and the `PlaneModeConfig` (mode-level override like dual-wheel preset). Resolution:

- **PlaneModeConfig wins when active.** Mode presets (dual-wheel, etc.) are whole-sequence overrides that change how the viewer renders, not the authored data. They override `MotionData.plane` at the rendering layer.
- **MotionData.plane is the source of truth for saved data.** When no mode preset is active, `MotionData.plane` drives rendering.
- In `beatDataToConfigs`: `const plane = modeConfig?.bluePlane ?? motion.plane ?? fallbackPlane`

---

## Pipeline Changes

### SequenceConverter

Currently hardcodes `plane: Plane = Plane.WALL` as a default parameter. Change to read `motion.plane` from the MotionData:

```typescript
motionDataToConfig3D(motion: MotionData, fallbackPlane: Plane = Plane.WALL): MotionConfig3D {
  const plane = motion.plane ?? fallbackPlane;
  // ... rest uses plane variable instead of hardcoded WALL
}
```

### PropStateInterpolator

Already receives `plane` via `MotionConfig3D` and calls `planeAngleToWorldPosition(config.plane, ...)`. No changes needed once `plane-transforms.ts` handles all 9 planes.

### AvatarAnimator

`HandPose.plane` is already populated from `PropState3D.plane`. The avatar's IK will do its best with non-wall planes. The body won't reorient (that's future work) but the hands will reach to the correct 3D positions. Accept visual weirdness at L8 — the prop paths are geometrically correct even if the body posture isn't ideal.

### Trails

Trail system is plane-agnostic — it follows `worldPosition` from PropState3D. Trails automatically paint on the correct plane circle. No changes needed.

---

## UI Design

### Whole-Sequence Toggle (Immediate)

Add per-hand plane dropdowns to the 3D viewer overlay controls. Six controls total (2 hands × 3 plane options):

```
[Blue Hand: Wall ▾]  [Red Hand: Wall ▾]
```

Changing a dropdown re-converts the entire sequence with the selected plane for that hand. This is the "brain candy" — watch a wall sequence projected onto wheel or floor plane.

### Per-Beat Plane Editor (Lab Tab — Later)

A timeline view where each beat shows both hands' plane assignments. Tap a cell to cycle Wall → Wheel → Floor. Color-coded: purple for Wall, blue for Wheel, green for Floor.

Gate indicators show which planes are available at each position. In diamond mode, positions highlight which 2 planes their gate connects. Invalid plane assignments (box mode on a different primary at L8) show a warning.

### Grid Visualization

The 3D viewer already has plane visibility toggles. When a hand is assigned to a non-wall plane, that plane's grid circle highlights automatically. The active plane for each hand is shown with the hand's color (blue/red) tinting the grid ring.

---

## Relationship to Dual-Wheel Plan

The existing plan at `docs/superpowers/plans/2026-04-05-dual-wheel-plane-mode.md` describes a specific preset: both hands on Wheel plane with lateral offsets and a 90° avatar rotation. Within the atomic plane system, dual-wheel becomes one preset configuration:

```typescript
// Dual-wheel is just a specific plane assignment
bluePlane: Plane.WHEEL
redPlane: Plane.WHEEL
// Plus lateral offsets and facing angle from PlaneModeConfig
```

The dual-wheel plan's `PlaneMode` enum, `PlaneModeConfig`, and lateral offset system are complementary to this spec. PlaneMode becomes a convenience preset that sets per-hand planes + avatar facing + lateral offsets in one click.

---

## Implementation Order

1. **Plane enum + normals** — Extend Plane enum to 9 entries, add normal vectors to plane-transforms.ts
2. **MotionData plane field** — Add optional `plane` to MotionData interface
3. **SequenceConverter** — Read `motion.plane` instead of hardcoded WALL
4. **Whole-sequence toggle UI** — Per-hand dropdown in 3D viewer overlay
5. **Per-beat editor** — Lab tab with timeline plane painting (separate session)
6. **Premium gate** — Hide plane controls for free users
7. **L9 prep** — Fusion plane math is already in the data model, UI unlock is a future PR

---

## What This Does NOT Cover

- **Avatar body reorientation** — The body doesn't know how to pose for wheel/floor plane movements. IK reaches to the right positions but the torso/hips stay wall-oriented. Future work.
- **2D pictograph changes** — Plane is purely a 3D rendering concept at L8. The 2D pictograph continues to show the sequence in its native notation as if all hands are on the same plane. If a user assigns different planes per hand, the 2D and 3D views will disagree — this is a known limitation. A "plane indicator" badge on pictographs is possible future work.
- **Plane-aware sequence generation** — The MCP sequence generator doesn't know about planes. Generated sequences are wall-plane. Plane assignment is a post-creation editing step.
- **Box mode plane switching** — Requires fusion planes (L9).
- **Triagonal grid mode** — L9 content. Data model ready, no UI.

---

## Tests

### Unit Tests (earned — silent bug territory)

1. **Plane normal correctness** — All 9 normals are unit vectors, perpendicular planes have zero dot product
2. **Gate point verification** — Each diamond position sits on exactly 2 primary circles, verified by dot product with normals
3. **planeAngleToWorldPosition** — Given angle + plane, output position lies on the correct plane and at the correct radius
4. **SequenceConverter plane passthrough** — MotionData with `plane: Plane.WHEEL` produces MotionConfig3D with `plane: Plane.WHEEL`
5. **Backward compatibility** — MotionData without plane field produces wall-plane output identical to current behavior

### Not Worth Testing

- UI rendering (visually obvious)
- Avatar IK response to non-wall planes (visually verified)
- Trail rendering on different planes (follows worldPosition, already tested)
