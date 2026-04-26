# PerformerRig Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sibling-based 3D scene graph with a parent-child `PerformerRig` component so avatars, grids, props, and effects can never desync.

**Architecture:** A single `PerformerRig.svelte` component owns position + facingAngle as a `T.Group`. Avatar, grid, props, and effects are children — the scene graph guarantees frame-perfect attachment. The STAGE_LIFT trick and `skipFacingTransform` flag are eliminated. Position math that was duplicated in 5 places collapses to one scene graph hierarchy.

**Tech Stack:** Svelte 5 + Threlte (Three.js) + TypeScript. Tests use Vitest with plain Three.js objects (no rendering needed).

**Spec:** `docs/superpowers/specs/2026-04-05-performer-rig-hierarchy-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/shared/3d/components/PerformerRig.svelte` | Unified transform hierarchy — owns position, facing, shoulder offset, hand anchors, visibility toggles |
| `tests/unit/3d-hierarchy/performer-rig-transforms.test.ts` | Snapshot tests verifying world positions AND rotations match old pipeline |
| `tests/unit/3d-hierarchy/fixtures/wall-mode-snapshots.json` | Captured position + rotation snapshots for wall mode |
| `tests/unit/3d-hierarchy/fixtures/dual-wheel-snapshots.json` | Captured position + rotation snapshots for dual-wheel mode |
| `tests/unit/3d-hierarchy/fixtures/museum-snapshots.json` | Captured snapshots with groundOffset=0.3 |

### Modified Files
| File | Change Summary |
|------|---------------|
| `src/lib/shared/3d/components/props/prop3d-transforms.ts` | Delete `computePropPosition()`. Remove facingQuat and skipFacingTransform from `computePropRotation()` and `computeFlatPropRotation()`. |
| `src/lib/shared/3d/components/Avatar3D.svelte` | Accept PropAnchor refs. Replace `toWorldPosition()` IK math with `getWorldPosition()`. Delete WALL_OFFSET import. |
| `src/lib/shared/3d/services/implementations/PropStateInterpolator.ts` | Delete lateralOffset addition (lines 180-182). Delete skipFacingTransform passthrough (lines 172-175). |
| `src/lib/shared/3d/services/implementations/SequenceConverter.ts` | Stop setting `lateralOffset` and `skipFacingTransform` on MotionConfig3D output. |
| `src/lib/shared/3d/domain/models/PropState3D.ts` | Remove `skipFacingTransform` field from `PropState3D` interface. |
| `src/lib/shared/3d/domain/models/MotionData3D.ts` | Remove `lateralOffset` and `skipFacingTransform` fields from `MotionConfig3D` interface. |
| `src/lib/shared/3d/effects/TipPositionBridge3D.ts` | Delete manual position replication (lines 36-55). Accept Object3D refs, use `getWorldPosition()`. |
| `src/lib/shared/3d/effects/contracts/ITipPositionBridge3D.ts` | Delete `SceneTransforms` interface. Update `ITipPositionBridge3D.update()` signature. |
| `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte` | Drop `avatarPosition`, `facingAngle`, `gridOffset` props. Accept PropAnchor refs. |
| `src/lib/shared/3d/components/Grid3D.svelte` | Remove `centerPosition`, `facingAngle`, `gridOffset` props. Keep as deprecated optionals during transition, then delete. |
| `src/lib/shared/3d/components/props/Prop3D.svelte` | Remove `avatarPosition`, `facingAngle`, `gridOffset` props. Keep as deprecated optionals during transition, then delete. |
| `src/lib/shared/3d/components/Viewer3DScene.svelte` | Replace all sibling wiring with single `<PerformerRig>`. Remove STAGE_LIFT. Remove Environment3D wrapper. |
| `src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte` | Replace sibling wiring with `<PerformerRig>` + groundOffset. ~227 lines to ~50. |
| `src/lib/features/realm/tools/3d-controls/ThreeDControlsLab.svelte` | Replace direct Avatar3D/Prop3D with `<PerformerRig>`. |
| `src/lib/shared/3d/domain/constants/plane-mode-configs.ts` | Remove `skipFacingTransform` from `PlaneModeConfig` interface and DUAL_WHEEL config. |

---

## Task 1: Capture Position Snapshots from Current Pipeline

**Purpose:** Record the exact world positions the current system produces, so we can assert the new hierarchy matches.

**Files:**
- Create: `tests/unit/3d-hierarchy/capture-snapshots.ts`
- Create: `tests/unit/3d-hierarchy/fixtures/wall-mode-snapshots.json`
- Create: `tests/unit/3d-hierarchy/fixtures/dual-wheel-snapshots.json`

- [ ] **Step 1: Create the snapshot capture utility**

This file imports the current `computePropPosition()` and `computePropRotation()` from `prop3d-transforms.ts`, feeds known PropState3D values, and writes JSON fixtures.

```typescript
// tests/unit/3d-hierarchy/capture-snapshots.ts
import { Vector3, Quaternion } from "three";
import { computePropPosition, computePropRotation } from "../../../src/lib/shared/3d/components/props/prop3d-transforms";
import { planeAngleToWorldPosition, calculatePropQuaternion } from "../../../src/lib/shared/3d/domain/constants/plane-transforms";
import { Plane } from "../../../src/lib/shared/3d/domain/enums/Plane";
import { GRID_OFFSETS } from "../../../src/lib/shared/3d/domain/constants/plane-mode-configs";
import { PlaneMode } from "../../../src/lib/shared/3d/domain/enums/PlaneMode";
import { writeFileSync } from "fs";

const GRID_RADIUS = 0.57; // staffLength(0.95) * 0.6
const STAFF_HALF = 0.475; // staffLength / 2
const SHOULDER_HEIGHT = 1.56; // heightCm(190.5) * 0.82 * 0.01

interface Snapshot {
  label: string;
  planeMode: string;
  facingAngle: number;
  avatarPosition: { x: number; y: number; z: number };
  gridOffset: number;
  beats: BeatSnapshot[];
}

interface BeatSnapshot {
  beat: number;
  progress: number;
  blue: PropSnapshot;
  red: PropSnapshot;
}

interface PropSnapshot {
  inputAngle: number;
  inputStaffAngle: number;
  plane: string;
  propCenter: [number, number, number];
  propRotation: [number, number, number];
  skipFacingTransform: boolean;
  lateralOffset: number;
}

// Test angles: N(π/2), E(0), S(3π/2), W(π)
const LOCATION_ANGLES = { n: Math.PI / 2, e: 0, s: (3 * Math.PI) / 2, w: Math.PI };

function captureWallMode(): Snapshot {
  const facingAngle = 0;
  const avatarPosition = { x: 0, y: SHOULDER_HEIGHT, z: 0 };
  const gridOffset = GRID_OFFSETS[PlaneMode.WALL]; // 0.3

  const beats: BeatSnapshot[] = [];
  const testCases = [
    { blueAngle: LOCATION_ANGLES.n, redAngle: LOCATION_ANGLES.e, blueStaff: 0, redStaff: Math.PI },
    { blueAngle: LOCATION_ANGLES.s, redAngle: LOCATION_ANGLES.w, blueStaff: Math.PI / 2, redStaff: Math.PI / 4 },
  ];

  for (const [i, tc] of testCases.entries()) {
    for (const progress of [0, 0.25, 0.5, 0.75, 1.0]) {
      // Interpolate angle: start + (end - start) * progress
      const blueAngle = tc.blueAngle;
      const redAngle = tc.redAngle;
      const blueWorldPos = planeAngleToWorldPosition(Plane.WALL, blueAngle, GRID_RADIUS);
      const redWorldPos = planeAngleToWorldPosition(Plane.WALL, redAngle, GRID_RADIUS);
      const blueRot = calculatePropQuaternion(Plane.WALL, tc.blueStaff);
      const redRot = calculatePropQuaternion(Plane.WALL, tc.redStaff);

      const bluePropState = {
        plane: Plane.WALL, centerPathAngle: blueAngle, staffRotationAngle: tc.blueStaff,
        worldPosition: blueWorldPos, worldRotation: blueRot,
      };
      const redPropState = {
        plane: Plane.WALL, centerPathAngle: redAngle, staffRotationAngle: tc.redStaff,
        worldPosition: redWorldPos, worldRotation: redRot,
      };

      const blueCenter = computePropPosition(bluePropState as any, avatarPosition, facingAngle, gridOffset);
      const redCenter = computePropPosition(redPropState as any, avatarPosition, facingAngle, gridOffset);
      const blueRotEuler = computePropRotation(bluePropState as any, facingAngle);
      const redRotEuler = computePropRotation(redPropState as any, facingAngle);

      beats.push({
        beat: i, progress,
        blue: {
          inputAngle: blueAngle, inputStaffAngle: tc.blueStaff, plane: "WALL",
          propCenter: blueCenter, propRotation: blueRotEuler,
          skipFacingTransform: false, lateralOffset: 0,
        },
        red: {
          inputAngle: redAngle, inputStaffAngle: tc.redStaff, plane: "WALL",
          propCenter: redCenter, propRotation: redRotEuler,
          skipFacingTransform: false, lateralOffset: 0,
        },
      });
    }
  }

  return { label: "wall-mode", planeMode: "WALL", facingAngle, avatarPosition, gridOffset, beats };
}

function captureDualWheelMode(): Snapshot {
  const facingAngle = 0;
  const avatarPosition = { x: 0, y: SHOULDER_HEIGHT, z: 0 };
  const gridOffset = GRID_OFFSETS[PlaneMode.DUAL_WHEEL]; // 0

  const beats: BeatSnapshot[] = [];
  const blueAngle = LOCATION_ANGLES.n;
  const redAngle = LOCATION_ANGLES.s;
  const blueStaff = Math.PI;
  const redStaff = 0;
  const blueLateral = 0.4;
  const redLateral = -0.4;

  for (const progress of [0, 0.25, 0.5, 0.75, 1.0]) {
    const blueWorldPos = planeAngleToWorldPosition(Plane.WHEEL, blueAngle, GRID_RADIUS);
    blueWorldPos.x += blueLateral; // Interpolator adds lateral offset
    const redWorldPos = planeAngleToWorldPosition(Plane.WHEEL, redAngle, GRID_RADIUS);
    redWorldPos.x += redLateral;
    const blueRot = calculatePropQuaternion(Plane.WHEEL, blueStaff);
    const redRot = calculatePropQuaternion(Plane.WHEEL, redStaff);

    const bluePropState = {
      plane: Plane.WHEEL, centerPathAngle: blueAngle, staffRotationAngle: blueStaff,
      worldPosition: blueWorldPos, worldRotation: blueRot, skipFacingTransform: true,
    };
    const redPropState = {
      plane: Plane.WHEEL, centerPathAngle: redAngle, staffRotationAngle: redStaff,
      worldPosition: redWorldPos, worldRotation: redRot, skipFacingTransform: true,
    };

    const blueCenter = computePropPosition(bluePropState as any, avatarPosition, facingAngle, gridOffset);
    const redCenter = computePropPosition(redPropState as any, avatarPosition, facingAngle, gridOffset);
    const blueRotEuler = computePropRotation(bluePropState as any, facingAngle);
    const redRotEuler = computePropRotation(redPropState as any, facingAngle);

    beats.push({
      beat: 0, progress,
      blue: {
        inputAngle: blueAngle, inputStaffAngle: blueStaff, plane: "WHEEL",
        propCenter: blueCenter, propRotation: blueRotEuler,
        skipFacingTransform: true, lateralOffset: blueLateral,
      },
      red: {
        inputAngle: redAngle, inputStaffAngle: redStaff, plane: "WHEEL",
        propCenter: redCenter, propRotation: redRotEuler,
        skipFacingTransform: true, lateralOffset: redLateral,
      },
    });
  }

  return { label: "dual-wheel", planeMode: "DUAL_WHEEL", facingAngle, avatarPosition, gridOffset, beats };
}

function captureMuseum(): Snapshot {
  // Museum: same as wall mode but with groundOffset=0.3
  // avatarPosition.y = shoulderHeight + platformHeight
  const facingAngle = 0;
  const platformHeight = 0.3;
  const avatarPosition = { x: 0, y: SHOULDER_HEIGHT + platformHeight, z: 0 };
  const gridOffset = 0.3; // WALL mode

  const beats: BeatSnapshot[] = [];
  const blueAngle = LOCATION_ANGLES.n;
  const redAngle = LOCATION_ANGLES.e;
  const blueStaff = Math.PI / 2;
  const redStaff = 0;

  for (const progress of [0, 0.5, 1.0]) {
    const blueWorldPos = planeAngleToWorldPosition(Plane.WALL, blueAngle, GRID_RADIUS);
    const redWorldPos = planeAngleToWorldPosition(Plane.WALL, redAngle, GRID_RADIUS);
    const blueRot = calculatePropQuaternion(Plane.WALL, blueStaff);
    const redRot = calculatePropQuaternion(Plane.WALL, redStaff);

    const bluePropState = {
      plane: Plane.WALL, centerPathAngle: blueAngle, staffRotationAngle: blueStaff,
      worldPosition: blueWorldPos, worldRotation: blueRot,
    };
    const redPropState = {
      plane: Plane.WALL, centerPathAngle: redAngle, staffRotationAngle: redStaff,
      worldPosition: redWorldPos, worldRotation: redRot,
    };

    const blueCenter = computePropPosition(bluePropState as any, avatarPosition, facingAngle, gridOffset);
    const redCenter = computePropPosition(redPropState as any, avatarPosition, facingAngle, gridOffset);
    const blueRotEuler = computePropRotation(bluePropState as any, facingAngle);
    const redRotEuler = computePropRotation(redPropState as any, facingAngle);

    beats.push({
      beat: 0, progress,
      blue: {
        inputAngle: blueAngle, inputStaffAngle: blueStaff, plane: "WALL",
        propCenter: blueCenter, propRotation: blueRotEuler,
        skipFacingTransform: false, lateralOffset: 0,
      },
      red: {
        inputAngle: redAngle, inputStaffAngle: redStaff, plane: "WALL",
        propCenter: redCenter, propRotation: redRotEuler,
        skipFacingTransform: false, lateralOffset: 0,
      },
    });
  }

  return { label: "museum", planeMode: "WALL", facingAngle, avatarPosition, gridOffset, beats };
}

// Run capture and write fixtures
const wallSnapshot = captureWallMode();
const dualWheelSnapshot = captureDualWheelMode();
const museumSnapshot = captureMuseum();

writeFileSync("tests/unit/3d-hierarchy/fixtures/wall-mode-snapshots.json", JSON.stringify(wallSnapshot, null, 2));
writeFileSync("tests/unit/3d-hierarchy/fixtures/dual-wheel-snapshots.json", JSON.stringify(dualWheelSnapshot, null, 2));
writeFileSync("tests/unit/3d-hierarchy/fixtures/museum-snapshots.json", JSON.stringify(museumSnapshot, null, 2));

console.log(`Captured ${wallSnapshot.beats.length} wall, ${dualWheelSnapshot.beats.length} dual-wheel, ${museumSnapshot.beats.length} museum beats`);
```

- [ ] **Step 2: Create fixtures directory and run capture**

```bash
mkdir -p tests/unit/3d-hierarchy/fixtures
npx tsx tests/unit/3d-hierarchy/capture-snapshots.ts
```

Expected: Two JSON files written with position data. Verify a few values look reasonable (positions within ±1m of origin).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/3d-hierarchy/
git commit -m "test: capture position snapshots from current 3D pipeline for regression testing"
```

---

## Task 2: Write Snapshot Assertion Tests

**Purpose:** These tests construct a minimal Three.js scene graph matching the PerformerRig hierarchy and assert the world positions match the captured snapshots. They fail until the hierarchy is correct.

**Files:**
- Create: `tests/unit/3d-hierarchy/performer-rig-transforms.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/unit/3d-hierarchy/performer-rig-transforms.test.ts
import { describe, it, expect } from "vitest";
import { Group, Vector3, Euler, Quaternion } from "three";
import wallSnapshots from "./fixtures/wall-mode-snapshots.json";
import dualWheelSnapshots from "./fixtures/dual-wheel-snapshots.json";
import { planeAngleToWorldPosition, calculatePropQuaternion } from "../../../src/lib/shared/3d/domain/constants/plane-transforms";
import { Plane } from "../../../src/lib/shared/3d/domain/enums/Plane";

const GRID_RADIUS = 0.57;
const TOLERANCE = 0.001;

/**
 * Build a minimal Three.js scene graph matching the PerformerRig hierarchy.
 * Returns the prop anchor group whose world position should match the snapshot.
 */
function buildRigHierarchy(params: {
  rigPosition: { x: number; z: number };
  groundOffset: number;
  facingAngle: number;
  shoulderHeight: number;
  handAnchorPosition: { x: number; y: number; z: number };
  propLocalPosition: { x: number; y: number; z: number };
}): Group {
  // PerformerRig root
  const rig = new Group();
  rig.position.set(params.rigPosition.x, params.groundOffset, params.rigPosition.z);
  rig.rotation.y = params.facingAngle;

  // ShoulderAnchor
  const shoulder = new Group();
  shoulder.position.y = params.shoulderHeight;
  rig.add(shoulder);

  // HandAnchor
  const handAnchor = new Group();
  handAnchor.position.set(
    params.handAnchorPosition.x,
    params.handAnchorPosition.y,
    params.handAnchorPosition.z
  );
  shoulder.add(handAnchor);

  // PropAnchor
  const propAnchor = new Group();
  propAnchor.position.set(
    params.propLocalPosition.x,
    params.propLocalPosition.y,
    params.propLocalPosition.z
  );
  handAnchor.add(propAnchor);

  // Force matrix update
  rig.updateWorldMatrix(false, true);

  return propAnchor;
}

describe("PerformerRig hierarchy matches old pipeline (wall mode)", () => {
  const snapshot = wallSnapshots;

  for (const beat of snapshot.beats) {
    it(`beat ${beat.beat} progress ${beat.progress} — blue prop position`, () => {
      // In wall mode: HandAnchor at z=gridOffset(0.3), no lateral offset
      const blueWorldPos = planeAngleToWorldPosition(
        Plane.WALL,
        beat.blue.inputAngle,
        GRID_RADIUS
      );

      const propAnchor = buildRigHierarchy({
        rigPosition: { x: 0, z: 0 },
        groundOffset: 0,
        facingAngle: snapshot.facingAngle,
        shoulderHeight: snapshot.avatarPosition.y,
        handAnchorPosition: { x: 0, y: 0, z: snapshot.gridOffset },
        propLocalPosition: {
          x: blueWorldPos.x,
          y: blueWorldPos.y,
          z: blueWorldPos.z,
        },
      });

      const worldPos = new Vector3();
      propAnchor.getWorldPosition(worldPos);

      expect(worldPos.x).toBeCloseTo(beat.blue.propCenter[0], 3);
      expect(worldPos.y).toBeCloseTo(beat.blue.propCenter[1], 3);
      expect(worldPos.z).toBeCloseTo(beat.blue.propCenter[2], 3);
    });

    it(`beat ${beat.beat} progress ${beat.progress} — red prop position`, () => {
      const redWorldPos = planeAngleToWorldPosition(
        Plane.WALL,
        beat.red.inputAngle,
        GRID_RADIUS
      );

      const propAnchor = buildRigHierarchy({
        rigPosition: { x: 0, z: 0 },
        groundOffset: 0,
        facingAngle: snapshot.facingAngle,
        shoulderHeight: snapshot.avatarPosition.y,
        handAnchorPosition: { x: 0, y: 0, z: snapshot.gridOffset },
        propLocalPosition: {
          x: redWorldPos.x,
          y: redWorldPos.y,
          z: redWorldPos.z,
        },
      });

      const worldPos = new Vector3();
      propAnchor.getWorldPosition(worldPos);

      expect(worldPos.x).toBeCloseTo(beat.red.propCenter[0], 3);
      expect(worldPos.y).toBeCloseTo(beat.red.propCenter[1], 3);
      expect(worldPos.z).toBeCloseTo(beat.red.propCenter[2], 3);
    });
  }
});

describe("PerformerRig hierarchy matches old pipeline (dual-wheel mode)", () => {
  const snapshot = dualWheelSnapshots;

  for (const beat of snapshot.beats) {
    it(`progress ${beat.progress} — blue prop position (dual-wheel)`, () => {
      // Dual-wheel: interpolator currently outputs worldPos with lateral baked in.
      // New system: HandAnchor owns lateral offset, interpolator outputs pure plane-local.
      // So we subtract lateral offset from the snapshot input to get plane-local,
      // then let the hierarchy add it back via HandAnchor.
      const pureBluePos = planeAngleToWorldPosition(
        Plane.WHEEL,
        beat.blue.inputAngle,
        GRID_RADIUS
      );

      const propAnchor = buildRigHierarchy({
        rigPosition: { x: 0, z: 0 },
        groundOffset: 0,
        facingAngle: snapshot.facingAngle,
        shoulderHeight: snapshot.avatarPosition.y,
        // HandAnchor owns the lateral offset
        handAnchorPosition: { x: beat.blue.lateralOffset, y: 0, z: 0 },
        // PropAnchor gets pure plane-local position (no lateral)
        propLocalPosition: {
          x: pureBluePos.x,
          y: pureBluePos.y,
          z: pureBluePos.z,
        },
      });

      const worldPos = new Vector3();
      propAnchor.getWorldPosition(worldPos);

      expect(worldPos.x).toBeCloseTo(beat.blue.propCenter[0], 3);
      expect(worldPos.y).toBeCloseTo(beat.blue.propCenter[1], 3);
      expect(worldPos.z).toBeCloseTo(beat.blue.propCenter[2], 3);
    });

    it(`progress ${beat.progress} — red prop position (dual-wheel)`, () => {
      const pureRedPos = planeAngleToWorldPosition(
        Plane.WHEEL,
        beat.red.inputAngle,
        GRID_RADIUS
      );

      const propAnchor = buildRigHierarchy({
        rigPosition: { x: 0, z: 0 },
        groundOffset: 0,
        facingAngle: snapshot.facingAngle,
        shoulderHeight: snapshot.avatarPosition.y,
        handAnchorPosition: { x: beat.red.lateralOffset, y: 0, z: 0 },
        propLocalPosition: {
          x: pureRedPos.x,
          y: pureRedPos.y,
          z: pureRedPos.z,
        },
      });

      const worldPos = new Vector3();
      propAnchor.getWorldPosition(worldPos);

      expect(worldPos.x).toBeCloseTo(beat.red.propCenter[0], 3);
      expect(worldPos.y).toBeCloseTo(beat.red.propCenter[1], 3);
      expect(worldPos.z).toBeCloseTo(beat.red.propCenter[2], 3);
    });
  }
});

describe("PerformerRig with groundOffset (museum)", () => {
  it("groundOffset shifts all world positions up", () => {
    const groundOffset = 0.3; // Museum platform
    const blueWorldPos = planeAngleToWorldPosition(Plane.WALL, Math.PI / 2, GRID_RADIUS);

    const propAnchor = buildRigHierarchy({
      rigPosition: { x: 0, z: 0 },
      groundOffset,
      facingAngle: 0,
      shoulderHeight: 1.56,
      handAnchorPosition: { x: 0, y: 0, z: 0.3 },
      propLocalPosition: { x: blueWorldPos.x, y: blueWorldPos.y, z: blueWorldPos.z },
    });

    const worldPos = new Vector3();
    propAnchor.getWorldPosition(worldPos);

    // Same as wall mode but y shifted up by groundOffset
    const noOffsetAnchor = buildRigHierarchy({
      rigPosition: { x: 0, z: 0 },
      groundOffset: 0,
      facingAngle: 0,
      shoulderHeight: 1.56,
      handAnchorPosition: { x: 0, y: 0, z: 0.3 },
      propLocalPosition: { x: blueWorldPos.x, y: blueWorldPos.y, z: blueWorldPos.z },
    });
    const basePos = new Vector3();
    noOffsetAnchor.getWorldPosition(basePos);

    expect(worldPos.x).toBeCloseTo(basePos.x, 3);
    expect(worldPos.y).toBeCloseTo(basePos.y + groundOffset, 3);
    expect(worldPos.z).toBeCloseTo(basePos.z, 3);
  });
});
```

Add these additional test blocks to the same test file:

```typescript
describe("Prop rotation matches old pipeline", () => {
  const snapshot = wallSnapshots;

  for (const beat of snapshot.beats) {
    it(`beat ${beat.beat} progress ${beat.progress} — blue rotation`, () => {
      // New system: computePropRotation(propState) without facingAngle
      // For wall mode facingAngle=0, old and new should produce identical results
      const blueRot = calculatePropQuaternion(Plane.WALL, beat.blue.inputStaffAngle);
      const propState = { worldRotation: blueRot } as any;

      // Import the new simplified computePropRotation
      const { computePropRotation } = require("../../../src/lib/shared/3d/components/props/prop3d-transforms");
      const newRot = computePropRotation(propState);

      expect(newRot[0]).toBeCloseTo(beat.blue.propRotation[0], 3);
      expect(newRot[1]).toBeCloseTo(beat.blue.propRotation[1], 3);
      expect(newRot[2]).toBeCloseTo(beat.blue.propRotation[2], 3);
    });
  }
});

describe("Tip positions computed from hierarchy", () => {
  it("tip positions are center +/- halfLength along rotated axis", () => {
    const STAFF_HALF = 0.475;
    const blueWorldPos = planeAngleToWorldPosition(Plane.WALL, Math.PI / 2, GRID_RADIUS);
    const blueRot = calculatePropQuaternion(Plane.WALL, 0);

    const propAnchor = buildRigHierarchy({
      rigPosition: { x: 0, z: 0 },
      groundOffset: 0,
      facingAngle: 0,
      shoulderHeight: 1.56,
      handAnchorPosition: { x: 0, y: 0, z: 0.3 },
      propLocalPosition: { x: blueWorldPos.x, y: blueWorldPos.y, z: blueWorldPos.z },
    });

    const center = new Vector3();
    propAnchor.getWorldPosition(center);

    // Staff axis after rotation
    const HORIZONTAL_QUAT = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));
    const finalQuat = blueRot.clone().multiply(HORIZONTAL_QUAT);
    const axis = new Vector3(1, 0, 0).applyQuaternion(finalQuat);

    const thumbTip = center.clone().add(axis.clone().multiplyScalar(STAFF_HALF));
    const pinkyTip = center.clone().sub(axis.clone().multiplyScalar(STAFF_HALF));

    // Tips should be staffLength apart
    expect(thumbTip.distanceTo(pinkyTip)).toBeCloseTo(STAFF_HALF * 2, 3);
    // Tips should be equidistant from center
    expect(thumbTip.distanceTo(center)).toBeCloseTo(STAFF_HALF, 3);
    expect(pinkyTip.distanceTo(center)).toBeCloseTo(STAFF_HALF, 3);
  });
});

describe("Museum snapshots with groundOffset", () => {
  const snapshot = museumSnapshots;

  for (const beat of snapshot.beats) {
    it(`museum progress ${beat.progress} — blue position matches`, () => {
      const blueWorldPos = planeAngleToWorldPosition(Plane.WALL, beat.blue.inputAngle, GRID_RADIUS);

      const propAnchor = buildRigHierarchy({
        rigPosition: { x: 0, z: 0 },
        groundOffset: 0.3, // Platform height
        facingAngle: snapshot.facingAngle,
        shoulderHeight: 1.56, // Shoulder relative to ground, NOT including platform
        handAnchorPosition: { x: 0, y: 0, z: snapshot.gridOffset },
        propLocalPosition: { x: blueWorldPos.x, y: blueWorldPos.y, z: blueWorldPos.z },
      });

      const worldPos = new Vector3();
      propAnchor.getWorldPosition(worldPos);

      expect(worldPos.x).toBeCloseTo(beat.blue.propCenter[0], 3);
      expect(worldPos.y).toBeCloseTo(beat.blue.propCenter[1], 3);
      expect(worldPos.z).toBeCloseTo(beat.blue.propCenter[2], 3);
    });
  }
});
```

Also add the import for museum snapshots at the top:
```typescript
import museumSnapshots from "./fixtures/museum-snapshots.json";
```

- [ ] **Step 2: Run tests — expect them to pass (they test the hierarchy math directly)**

```bash
npx vitest run tests/unit/3d-hierarchy/performer-rig-transforms.test.ts
```

Expected: All tests PASS. These tests validate that the PerformerRig's group hierarchy produces the same world positions as the old `computePropPosition()` pipeline for the same inputs.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/3d-hierarchy/performer-rig-transforms.test.ts
git commit -m "test: add snapshot assertion tests for PerformerRig hierarchy"
```

---

## Task 3: Create PerformerRig.svelte

**Purpose:** The core new component. A `T.Group` hierarchy with ShoulderAnchor, HandAnchors, GridAnchor, PropAnchors, and visibility toggles.

**Files:**
- Create: `src/lib/shared/3d/components/PerformerRig.svelte`

- [ ] **Step 1: Create the component**

```svelte
<script lang="ts">
  /**
   * PerformerRig — Unified 3D transform hierarchy.
   *
   * One T.Group owns position + facingAngle. Avatar, grid, props, and
   * effects are children. The scene graph guarantees frame-perfect
   * attachment. No manual cos/sin. No STAGE_LIFT trick.
   */
  import { T } from "@threlte/core";
  import type { Group } from "three";
  import Avatar3D from "./Avatar3D.svelte";
  import Grid3D from "./Grid3D.svelte";
  import Prop3D from "../components/props/Prop3D.svelte";
  import EffectOrchestrator3D from "../effects/EffectOrchestrator3D.svelte";
  import { Plane } from "../domain/enums/Plane";
  import { PlaneMode } from "../domain/enums/PlaneMode";
  import { GRID_OFFSETS, PLANE_MODE_CONFIGS } from "../domain/constants/plane-mode-configs";
  import { userProportionsState } from "../state/user-proportions-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { AvatarInstanceState } from "../state/avatar-instance-state.svelte";
  import type { PropState3D } from "../domain/models/PropState3D";
  import type { GridMode } from "../domain/constants/grid-layout";
  import type { TipEffectMap } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { Snippet } from "svelte";

  interface Props {
    /** World position (x/z). Ground is y=0. */
    position: { x: number; z: number };
    /** Avatar body facing direction (radians, 0 = +Z toward audience) */
    facingAngle: number;
    /** Height from ground to shoulder (meters) */
    shoulderHeight?: number;
    /** Determines grid offset, lateral hand positions */
    planeMode: PlaneMode;
    /** Avatar instance — provides prop states, step configs, etc. */
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

    // Prop state overrides (for mirror mode — caller swaps before passing)
    bluePropState?: PropState3D | null;
    redPropState?: PropState3D | null;

    // Effects
    tipEffectMap?: TipEffectMap;
    isPlaying?: boolean;
    staffHalfLength?: number;

    // Vertical offset (museum platforms, stages)
    groundOffset?: number;

    // Extension point
    extras?: Snippet;
  }

  let {
    position,
    facingAngle,
    shoulderHeight = userProportionsState.shoulderHeight,
    planeMode,
    avatarState,
    showAvatar = true,
    showGrid = true,
    showProps = true,
    showEffects = true,
    visiblePlanes = new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]),
    gridMode = "diamond",
    bluePropType = PropType.STAFF,
    redPropType = PropType.STAFF,
    bluePropState: bluePropStateOverride,
    redPropState: redPropStateOverride,
    tipEffectMap = {},
    isPlaying = false,
    staffHalfLength = userProportionsState.staffLength / 2,
    groundOffset = 0,
    extras,
  }: Props = $props();

  // Resolve prop states: use overrides if provided, otherwise read from avatarState
  const bluePropState = $derived(bluePropStateOverride ?? avatarState.bluePropState);
  const redPropState = $derived(redPropStateOverride ?? avatarState.redPropState);

  // HandAnchor positions from PlaneModeConfig
  const modeConfig = $derived(PLANE_MODE_CONFIGS[planeMode]);
  const gridOffset = $derived(GRID_OFFSETS[planeMode]);

  // Per-hand anchor positions.
  // Wall: both at z=gridOffset, no lateral split.
  // Dual-wheel: lateral split, no forward offset.
  // Custom: per-hand based on each hand's plane.
  const blueHandPos = $derived({
    x: modeConfig.blueLateralOffset,
    y: 0,
    z: modeConfig.bluePlane === Plane.WALL ? gridOffset : 0,
  });
  const redHandPos = $derived({
    x: modeConfig.redLateralOffset,
    y: 0,
    z: modeConfig.redPlane === Plane.WALL ? gridOffset : 0,
  });

  // Dual-wheel grid: two separate grids offset laterally
  const isDualWheel = $derived(planeMode === PlaneMode.DUAL_WHEEL);

  // PropAnchor refs — passed to Avatar3D for IK and to EffectOrchestrator for tips
  let bluePropAnchorRef = $state<Group | undefined>(undefined);
  let redPropAnchorRef = $state<Group | undefined>(undefined);
</script>

<!-- PerformerRig root — owns position + facing. Everything inside inherits. -->
<T.Group
  position.x={position.x}
  position.y={groundOffset}
  position.z={position.z}
  rotation.y={facingAngle}
>
  <!-- Avatar slot: feet at ground level (y=0 inside rig) -->
  {#if showAvatar}
    <Avatar3D
      id={avatarState.id ?? "rig"}
      {bluePropState}
      {redPropState}
      position={{ x: 0, y: 0, z: 0 }}
      facingAngle={0}
      isActive={false}
      isMoving={false}
      {bluePropAnchorRef}
      {redPropAnchorRef}
    />
  {/if}

  <!-- ShoulderAnchor: grid, props, and effects live at shoulder height -->
  <T.Group position.y={shoulderHeight}>

    <!-- GridAnchor -->
    {#if showGrid}
      {#if isDualWheel}
        <!-- Two grids for dual-wheel, offset laterally -->
        <T.Group position.x={modeConfig.blueLateralOffset}>
          <Grid3D
            visiblePlanes={new Set([Plane.WHEEL])}
            planeOpacity={0.10}
            showLabels={false}
            {gridMode}
          />
        </T.Group>
        <T.Group position.x={modeConfig.redLateralOffset}>
          <Grid3D
            visiblePlanes={new Set([Plane.WHEEL])}
            planeOpacity={0.10}
            showLabels={false}
            {gridMode}
          />
        </T.Group>
      {:else}
        <T.Group position.z={gridOffset}>
          <Grid3D
            {visiblePlanes}
            planeOpacity={0.12}
            showLabels={false}
            {gridMode}
          />
        </T.Group>
      {/if}
    {/if}

    <!-- Blue HandAnchor + PropAnchor -->
    <T.Group
      position.x={blueHandPos.x}
      position.y={blueHandPos.y}
      position.z={blueHandPos.z}
    >
      {#if bluePropState}
        <T.Group
          bind:ref={bluePropAnchorRef}
          position.x={bluePropState.worldPosition.x}
          position.y={bluePropState.worldPosition.y}
          position.z={bluePropState.worldPosition.z}
        >
          {#if showProps}
            <Prop3D
              propType={bluePropType}
              propState={bluePropState}
              color="blue"
              isActivePlayer={false}
            />
          {/if}
        </T.Group>
      {/if}
    </T.Group>

    <!-- Red HandAnchor + PropAnchor -->
    <T.Group
      position.x={redHandPos.x}
      position.y={redHandPos.y}
      position.z={redHandPos.z}
    >
      {#if redPropState}
        <T.Group
          bind:ref={redPropAnchorRef}
          position.x={redPropState.worldPosition.x}
          position.y={redPropState.worldPosition.y}
          position.z={redPropState.worldPosition.z}
        >
          {#if showProps}
            <Prop3D
              propType={redPropType}
              propState={redPropState}
              color="red"
              isActivePlayer={false}
            />
          {/if}
        </T.Group>
      {/if}
    </T.Group>

    <!-- Effects -->
    {#if showEffects}
      <EffectOrchestrator3D
        {bluePropState}
        {redPropState}
        {isPlaying}
        {staffHalfLength}
        {bluePropAnchorRef}
        {redPropAnchorRef}
        globalTipEffectMap={tipEffectMap}
      />
    {/if}

  </T.Group>

  <!-- Extras slot (platform meshes, labels, etc.) -->
  {#if extras}
    {@render extras()}
  {/if}
</T.Group>
```

- [ ] **Step 2: Verify the project still type-checks**

```bash
npm run check 2>&1 | head -30
```

Expected: Type errors related to Avatar3D not accepting `bluePropAnchorRef`/`redPropAnchorRef` yet, and Prop3D/Grid3D/EffectOrchestrator3D still expecting old props. These are expected — we fix them in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/PerformerRig.svelte
git commit -m "feat: create PerformerRig.svelte — unified 3D transform hierarchy"
```

---

## Task 4: Update PropStateInterpolator and SequenceConverter

**Purpose:** Stop baking lateralOffset and skipFacingTransform into interpolator output. The PerformerRig handles these via HandAnchor groups.

**Files:**
- Modify: `src/lib/shared/3d/services/implementations/PropStateInterpolator.ts:170-185`
- Modify: `src/lib/shared/3d/services/implementations/SequenceConverter.ts:79-105`
- Modify: `src/lib/shared/3d/domain/models/MotionData3D.ts:41-53`
- Modify: `src/lib/shared/3d/domain/models/PropState3D.ts:37-38`

- [ ] **Step 1: Remove lateralOffset and skipFacingTransform from PropStateInterpolator**

In `src/lib/shared/3d/services/implementations/PropStateInterpolator.ts`, delete lines 172-182 (the skipFacingTransform passthrough and lateralOffset addition):

```typescript
// DELETE these lines (approximately 172-182):
//   if (config.skipFacingTransform) {
//     result.skipFacingTransform = true;
//   }
//
//   if (config.lateralOffset) {
//     result.worldPosition.x += config.lateralOffset;
//   }
```

- [ ] **Step 2: Remove lateralOffset and skipFacingTransform from SequenceConverter**

In `src/lib/shared/3d/services/implementations/SequenceConverter.ts`, remove the fields from the MotionConfig3D construction (~lines 92-94, 102-104):

```typescript
// DELETE from blue config:
//   lateralOffset: blueOffset || undefined,
//   skipFacingTransform: skipFacing,

// DELETE from red config:
//   lateralOffset: redOffset || undefined,
//   skipFacingTransform: skipFacing,
```

Also delete the `skipFacing` variable declaration (~line 79):
```typescript
// DELETE:
//   const skipFacing = modeConfig?.skipFacingTransform;
```

- [ ] **Step 3: Remove fields from interfaces**

In `src/lib/shared/3d/domain/models/MotionData3D.ts`, delete the `lateralOffset`, `skipFacingTransform` fields and their JSDoc from `MotionConfig3D` interface (lines 37-53).

In `src/lib/shared/3d/domain/models/PropState3D.ts`, delete the `skipFacingTransform` field from `PropState3D` interface (lines 37-38).

- [ ] **Step 4: Remove skipFacingTransform from PlaneModeConfig**

In `src/lib/shared/3d/domain/constants/plane-mode-configs.ts`, delete the `skipFacingTransform` field from the `PlaneModeConfig` interface (lines 38-42).

- [ ] **Step 5: Verify type-check — find remaining consumers**

```bash
npm run check 2>&1 | grep -i "skipFacingTransform\|lateralOffset" | head -20
```

Expected: Errors from Avatar3D, TipPositionBridge3D, and any other files still referencing these fields. Note these for tasks 6-8.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/services/implementations/PropStateInterpolator.ts src/lib/shared/3d/services/implementations/SequenceConverter.ts src/lib/shared/3d/domain/models/MotionData3D.ts src/lib/shared/3d/domain/models/PropState3D.ts src/lib/shared/3d/domain/constants/plane-mode-configs.ts
git commit -m "refactor: remove lateralOffset and skipFacingTransform from interpolator pipeline"
```

---

## Task 5: Update Grid3D — Make Position Props Optional

**Purpose:** Grid3D drops `centerPosition`, `facingAngle`, `gridOffset` as required props. Inside PerformerRig, the parent GridAnchor group handles all positioning. Outside (deprecated consumers), the old props still work.

**Files:**
- Modify: `src/lib/shared/3d/components/Grid3D.svelte:20-68`

- [ ] **Step 1: Make position props optional with identity defaults**

Change the Props interface so `centerPosition`, `facingAngle`, and `gridOffset` default to identity transforms (origin, no rotation, no offset):

```typescript
interface Props {
  visiblePlanes?: Set<Plane>;
  size?: number;
  showLabels?: boolean;
  planeOpacity?: number;
  gridMode?: GridMode;
  /** @deprecated — use parent group for positioning. Kept for transition. */
  centerPosition?: { x: number; y: number; z: number };
  /** @deprecated — use parent group for rotation. Kept for transition. */
  facingAngle?: number;
  /** @deprecated — use parent group for offset. Kept for transition. */
  gridOffset?: number;
  label?: string;
}
```

Defaults remain `centerPosition = { x: 0, y: 0, z: 0 }`, `facingAngle = 0`, `gridOffset = 0`. Inside PerformerRig, the parent groups handle all transforms, so Grid3D renders at its local origin. Old consumers that pass these props explicitly still work.

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/components/Grid3D.svelte
git commit -m "refactor: make Grid3D position props optional (deprecated, parent handles positioning)"
```

---

## Task 6: Update Prop3D and Prop Components — Remove Position Math

**Purpose:** Simplify prop3d-transforms.ts AND update all prop components in one task so the build never breaks. Delete `computePropPosition()`, remove facing from rotation functions, and update all consumers simultaneously.

**Files:**
- Modify: `src/lib/shared/3d/components/props/prop3d-transforms.ts` — delete `computePropPosition()`, simplify rotation functions, consolidate `computeFlatPropRotation` into `computePropRotation`
- Modify: `src/lib/shared/3d/components/props/Prop3D.svelte` — make `avatarPosition`, `facingAngle`, `gridOffset` optional with identity defaults
- Modify: `src/lib/shared/3d/components/Staff3D.svelte` — remove position computation, use parent
- Modify: `src/lib/shared/3d/components/props/GltfProp3D.svelte` — same
- Modify: `src/lib/shared/3d/components/props/Fan3D.svelte` — update rotation call
- Modify: `src/lib/shared/3d/components/props/Hoop3D.svelte` — update rotation call

- [ ] **Step 1: Rewrite prop3d-transforms.ts**

Delete `computePropPosition()` entirely. Simplify rotation and consolidate `computeFlatPropRotation` into `computePropRotation` (they become identical after removing facingQuat):

```typescript
/**
 * Shared rotation math for all 3D prop components.
 *
 * Position is handled by the PerformerRig scene graph hierarchy.
 * This file only handles rotation: horizontal tilt + plane/staff quaternion.
 * Facing rotation is inherited from the parent PerformerRig group.
 */

import { Quaternion, Euler } from "three";
import type { PropState3D } from "../../domain/models/PropState3D";

/**
 * Base tilt quaternion: lays a +Y cylinder horizontal (along -X).
 * Applied before worldRotation which handles plane + staff spin.
 */
const HORIZONTAL_QUAT = new Quaternion().setFromEuler(
  new Euler(0, 0, Math.PI / 2)
);

/**
 * Compute local-space rotation (Euler) for any prop type.
 *
 * Composition: worldRotation x horizontalQuat
 * - horizontalQuat: lays cylinder horizontal (Y -> -X)
 * - worldRotation: planeQuat x staffSpin (from calculatePropQuaternion)
 *
 * Facing rotation is NOT applied here — the parent PerformerRig group handles it.
 * Works for both cylindrical (staff, club) and flat (fan, hoop) props.
 */
export function computePropRotation(
  propState: PropState3D,
): [number, number, number] {
  const finalQuat = propState.worldRotation.clone().multiply(HORIZONTAL_QUAT);
  const euler = new Euler().setFromQuaternion(finalQuat);
  return [euler.x, euler.y, euler.z];
}
```

Note: `computeFlatPropRotation` is deleted — it was identical to `computePropRotation` after simplification. Fan3D and Hoop3D use `computePropRotation` instead.

- [ ] **Step 2: Update Prop3D dispatcher**

Make `avatarPosition`, `facingAngle`, `gridOffset` optional with identity defaults. When inside PerformerRig, these are unused (parent group handles positioning).

- [ ] **Step 3: Update Staff3D — remove position computation**

Staff3D currently calls `computePropPosition()`. Remove that call. The component's position is now set by its parent PropAnchor group. Keep rotation via simplified `computePropRotation()` (no facingAngle arg).

Find the position and rotation lines and replace:
```typescript
// OLD:
const pos = computePropPosition(propState, avatarPosition, facingAngle, gridOffset);
const rot = computePropRotation(propState, facingAngle);

// NEW:
const rot = computePropRotation(propState);
// Position handled by parent PropAnchor group — Staff3D renders at local origin
```

Remove the `position` attribute from the `T.Group` or `T.Mesh` that used `pos`.

- [ ] **Step 4: Update GltfProp3D — same pattern as Staff3D**

- [ ] **Step 5: Update Fan3D and Hoop3D — use consolidated rotation**

Change `computeFlatPropRotation(propState, facingAngle)` to `computePropRotation(propState)`. Update the import.

- [ ] **Step 6: Verify type-check**

```bash
npm run check 2>&1 | head -30
```

Expected: Clean or only errors from Avatar3D/EffectOrchestrator (fixed in Tasks 7-8).

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/3d/components/props/ src/lib/shared/3d/components/Staff3D.svelte
git commit -m "refactor: simplify prop transforms — delete position math, consolidate rotation, update all consumers"
```

---

## Task 7: Update Avatar3D — IK from Scene Graph

**Purpose:** Replace manual `toWorldPosition()` with `getWorldPosition()` from PropAnchor refs.

**Files:**
- Modify: `src/lib/shared/3d/components/Avatar3D.svelte:64-101` (add props), `652-704` (IK section)

- [ ] **Step 1: Add PropAnchor ref props to Avatar3D**

Add to the Props interface:
```typescript
/** PropAnchor group ref for blue hand IK target (from PerformerRig) */
bluePropAnchorRef?: Group;
/** PropAnchor group ref for red hand IK target (from PerformerRig) */
redPropAnchorRef?: Group;
```

Import `Group` from `three`.

- [ ] **Step 2: Replace toWorldPosition() in the IK section**

Find the IK section (~lines 652-704). Replace the entire `toWorldPosition` function and the manual cos/sin + rootWorld computation with:

```typescript
// IK targets: read world positions from PropAnchor groups in PerformerRig.
// If refs aren't available (standalone Avatar3D), fall back to prop state positions.
const blueIKTarget = new Vector3();
const redIKTarget = new Vector3();

if (bluePropAnchorRef && bluePropState) {
  bluePropAnchorRef.updateWorldMatrix(true, false);
  bluePropAnchorRef.getWorldPosition(blueIKTarget);
} else if (bluePropState) {
  // Fallback for standalone usage: use worldPosition directly
  blueIKTarget.copy(bluePropState.worldPosition);
}

if (redPropAnchorRef && redPropState) {
  redPropAnchorRef.updateWorldMatrix(true, false);
  redPropAnchorRef.getWorldPosition(redIKTarget);
} else if (redPropState) {
  redIKTarget.copy(redPropState.worldPosition);
}

const blueWorldProp = bluePropState
  ? { ...bluePropState, worldPosition: blueIKTarget }
  : null;
const redWorldProp = redPropState
  ? { ...redPropState, worldPosition: redIKTarget }
  : null;

animationService.setPropsAndBlend(blueWorldProp, redWorldProp);
animationService.update(delta);
```

- [ ] **Step 3: Delete the old toWorldPosition function and supporting code**

Delete:
- The `const cos = Math.cos(facingAngle)` / `const sin = Math.sin(facingAngle)` lines
- The `const gridOffset = -WALL_OFFSET` line
- The `rootWorld` computation block
- The `toWorldPosition()` function definition
- The `WALL_OFFSET` import at the top of the file

- [ ] **Step 4: Verify type-check**

```bash
npm run check 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/Avatar3D.svelte
git commit -m "refactor: Avatar3D IK reads from scene graph refs instead of manual transform math"
```

---

## Task 8: Update TipPositionBridge3D and EffectOrchestrator3D

**Purpose:** Effects read prop positions from scene graph refs instead of replicating the transform pipeline.

**Files:**
- Modify: `src/lib/shared/3d/effects/contracts/ITipPositionBridge3D.ts`
- Modify: `src/lib/shared/3d/effects/TipPositionBridge3D.ts`
- Modify: `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte`

- [ ] **Step 1: Update ITipPositionBridge3D contract**

Delete the `SceneTransforms` interface. Add optional `propAnchorRef` to the `update()` method:

```typescript
import type { PropTipPositions3D } from "../types";
import type { Group } from "three";

export interface PropState3DLike {
  worldPosition: { x: number; y: number; z: number };
  worldRotation: { x: number; y: number; z: number; w: number };
  staffRotationAngle: number;
  plane: string;
  centerPathAngle: number;
}

export interface ITipPositionBridge3D {
  update(
    propIndex: number,
    propState: PropState3DLike,
    staffHalfLength: number,
    deltaTime: number,
    propAnchorRef?: Group,
  ): PropTipPositions3D;

  reset(): void;
}
```

- [ ] **Step 2: Update TipPositionBridge3D implementation**

Replace the "replicate Staff3D position computation" block (lines 36-55) with scene graph read:

```typescript
// Read prop center from scene graph if ref is available
const center = new Vector3();
if (propAnchorRef) {
  propAnchorRef.updateWorldMatrix(true, false);
  propAnchorRef.getWorldPosition(center);
} else {
  // Fallback: use propState worldPosition directly
  center.set(propState.worldPosition.x, propState.worldPosition.y, propState.worldPosition.z);
}
```

Delete the manual cos/sin rotation code, the `sceneTransforms` parameter usage, and all references to `avatarPosition`, `facingAngle`, `gridOffset`.

- [ ] **Step 3: Update EffectOrchestrator3D**

Replace `avatarPosition`, `facingAngle`, `gridOffset` props with `bluePropAnchorRef` and `redPropAnchorRef` (both `Group | undefined`). Pass the refs through to TipPositionBridge3D's `update()` calls.

- [ ] **Step 4: Verify type-check**

```bash
npm run check 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/effects/
git commit -m "refactor: effects read prop positions from scene graph refs"
```

---

## Task 9: Wire PerformerRig into Viewer3DScene

**Purpose:** Replace the entire sibling wiring in Viewer3DScene with a single `<PerformerRig>` call.

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DScene.svelte`

- [ ] **Step 1: Rewrite Viewer3DScene to use PerformerRig**

The file currently has ~285 lines of sibling wiring. Replace lines 172-284 (everything after the `isNightEnvironment` derived) with:

```svelte
<!-- 3D Environment (no STAGE_LIFT wrapper — environment sits at ground level) -->
{#if hasEnvironment}
  <Environment3D {backgroundType} />
{/if}

<!-- Lighting -->
<T.AmbientLight intensity={isNightEnvironment ? 0.2 : hasEnvironment ? 0.3 : 0.4} />
<T.DirectionalLight position={[5, 10, 5]} intensity={isNightEnvironment ? 0.4 : hasEnvironment ? 0.6 : 0.8} />

<!-- Ground disc (only when no environment provides its own ground) -->
{#if !hasEnvironment}
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T.CircleGeometry args={[2, 64]} />
    <T.MeshStandardMaterial color="#1a1a2e" />
  </T.Mesh>
{/if}

<!-- Single PerformerRig replaces all sibling wiring -->
<PerformerRig
  position={{ x: 0, z: 0 }}
  facingAngle={facingAngle}
  planeMode={avatarState.planeMode}
  {avatarState}
  showGrid={viewer3DState.showGrid}
  visiblePlanes={gridVisiblePlanes}
  gridMode={(sequenceData?.gridMode ?? "diamond")}
  bluePropType={isMirror ? redPropType : bluePropType}
  redPropType={isMirror ? bluePropType : redPropType}
  bluePropState={bluePropState}
  redPropState={redPropState}
  tipEffectMap={globalTipEffectMap}
  {isPlaying}
/>
```

Delete:
- The `STAGE_LIFT` and `avatarPosition` derived values
- The `propGridOffset` derived
- The entire grid rendering section (the dual-wheel branching, the Grid3D calls)
- The `T.Group position.y={-STAGE_LIFT}` wrapper around Avatar3D
- The direct Prop3D calls
- The direct EffectOrchestrator3D call
- The `STAGE_LIFT` Environment3D wrapper (line 176)

Add import for PerformerRig. Remove unused imports (Grid3D, Prop3D, EffectOrchestrator3D, GRID_OFFSETS, PLANE_MODE_CONFIGS, PropType import if handled elsewhere).

- [ ] **Step 2: Verify type-check**

```bash
npm run check 2>&1 | head -30
```

- [ ] **Step 3: Verify Avatar3D facingAngle=0 doesn't double-rotate**

Avatar3D applies `rotation.y={facingAngle}` to its PERFORMER group (line 770/796). PerformerRig passes `facingAngle={0}` to Avatar3D since the rig root handles facing. Verify Avatar3D's mesh group rotation is 0 when inside the rig (the rig root's rotation.y handles world-space facing). If Avatar3D reads facingAngle from its own prop, passing 0 is correct and no double-rotation occurs.

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DScene.svelte
git commit -m "feat: wire PerformerRig into Viewer3DScene — single hierarchy replaces 5 siblings"
```

---

## Task 10: Wire PerformerRig into MuseumPerformerStation3D

**Files:**
- Modify: `src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte`

- [ ] **Step 1: Replace sibling wiring with PerformerRig**

The current file has ~227 lines. The new version uses PerformerRig with a platform mesh in extras:

Keep the script section's sequence loading logic (lines 62-129), prop type resolution (lines 132-146), and platformColor constant. Replace the template (lines 151-226) with:

```svelte
<T.Group name={`performer-station-${stationId}`} position.x={worldX} position.z={worldZ}>
  {#if performerState}
    <PerformerRig
      position={{ x: 0, z: 0 }}
      {facingAngle}
      planeMode={PlaneMode.WALL}
      avatarState={performerState}
      {showGrid}
      visiblePlanes={new Set([Plane.WALL])}
      gridMode={(resolvedSequence?.gridMode ?? "diamond")}
      {bluePropType}
      {redPropType}
      groundOffset={PLATFORM_HEIGHT}
    >
      {#snippet extras()}
        <!-- Circular platform -->
        <T.Mesh position.y={0.15} castShadow receiveShadow>
          <T.CylinderGeometry args={[0.8, 0.9, 0.3, 24]} />
          <T.MeshStandardMaterial color={platformColor} roughness={0.85} />
        </T.Mesh>
      {/snippet}
    </PerformerRig>
  {/if}
</T.Group>
```

Delete:
- The `STAGE_LIFT` constant and `avatarLocalPosition` derived
- The `T.Group position.y={-STAGE_LIFT}` wrapper
- The direct Avatar3D, Prop3D, and Grid3D calls

Add imports for `PerformerRig` and `PlaneMode`. Remove unused imports.

- [ ] **Step 2: Verify type-check and build**

```bash
npm run check 2>&1 | head -20
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/components/game/MuseumPerformerStation3D.svelte
git commit -m "feat: wire PerformerRig into MuseumPerformerStation3D — 227 lines to ~60"
```

---

## Task 11: Wire PerformerRig into ThreeDControlsLab

**Files:**
- Modify: `src/lib/features/realm/tools/3d-controls/ThreeDControlsLab.svelte`

- [ ] **Step 1: Replace direct Avatar3D + Prop3D with PerformerRig**

ThreeDControlsLab constructs PropState3D manually (lines 51-61) and passes them directly to Avatar3D + Prop3D inside a Scene3D snippet. Replace the snippet children with a PerformerRig.

The lab doesn't have an AvatarInstanceState — it constructs prop states manually. Create a minimal adapter or use PerformerRig's prop state override props (`bluePropState`, `redPropState`) with `showAvatar` toggled by the `showFigure` state.

This is a dev tool, so a pragmatic approach is fine. The key change: remove `avatarPosition`, `facingAngle`, `gridOffset` from Prop3D calls and use PerformerRig's hierarchy instead.

- [ ] **Step 2: Verify type-check**

```bash
npm run check 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/realm/tools/3d-controls/ThreeDControlsLab.svelte
git commit -m "refactor: ThreeDControlsLab uses PerformerRig"
```

---

## Task 12: Delete Dead Code

**Purpose:** Remove all deprecated props, deleted interfaces, and unused imports now that all consumers are migrated.

**Files:**
- Modify: `src/lib/shared/3d/components/Grid3D.svelte` — remove deprecated props and outer positioning groups
- Modify: `src/lib/shared/3d/components/props/Prop3D.svelte` — remove deprecated transform props
- Verify: `src/lib/shared/3d/domain/constants/performer-positions.ts` — check if `WALL_OFFSET` has remaining consumers

- [ ] **Step 1: Clean Grid3D — remove deprecated positioning props**

Remove `centerPosition`, `facingAngle`, `gridOffset` from the Props interface and the two-level group hierarchy. Grid3D renders plane geometry at its local origin — parent handles all positioning.

- [ ] **Step 2: Clean Prop3D — remove deprecated transform props**

Remove `avatarPosition`, `facingAngle`, `gridOffset` from Prop3D's props interface.

- [ ] **Step 3: Check WALL_OFFSET usage**

```bash
grep -r "WALL_OFFSET" src/ --include="*.ts" --include="*.svelte" | grep -v "node_modules"
```

If only `performer-positions.ts` defines it and no consumer imports it, delete it. If formation presets still use it, leave it.

- [ ] **Step 4: Check Scene3D internal grid rendering**

Scene3D renders its own grids via `{#each gridPositions}`. Since all consumers now use PerformerRig for grids, check if Scene3D's grid rendering is still used. If ThreeDControlsLab passes `showGrid={false}` to Scene3D (because PerformerRig handles its own grid), remove Scene3D's grid loop. If other consumers still rely on it, leave it with a TODO comment.

- [ ] **Step 5: Full type-check and build**

```bash
npm run check 2>&1 | tail -20
npm run build 2>&1 | tail -10
```

Expected: Zero errors. All deprecated code paths removed.

- [ ] **Step 6: Run existing tests**

```bash
npm test 2>&1 | tail -20
```

Expected: All 49 existing test files pass. No regressions.

- [ ] **Step 7: Run the snapshot tests**

```bash
npx vitest run tests/unit/3d-hierarchy/ 2>&1
```

Expected: All snapshot tests pass — hierarchy positions match the old pipeline.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: delete deprecated position props and dead code from Grid3D, Prop3D"
```

---

## Task 13: Visual Verification

**Purpose:** Confirm the refactor looks correct in the running app.

- [ ] **Step 1: Verify wall mode in viewer**

Open the app, load a wall-mode sequence, and verify:
- Props orbit correctly at shoulder height
- Grid disc aligns with prop orbit path
- Avatar arms reach to prop positions (IK working)
- Effects (trails) follow prop tips

Use Chrome DevTools MCP to take a screenshot or query world positions via `browser_evaluate`.

- [ ] **Step 2: Verify dual-wheel mode**

Load a dual-wheel sequence. Verify:
- Two wheel grids appear, offset laterally
- Props orbit in YZ planes at correct lateral positions
- No visual difference from before the refactor

- [ ] **Step 3: Verify museum performers**

Navigate to the museum. Verify:
- Performers stand on platforms (feet at platform height)
- Props orbit at correct shoulder height above platform
- Grid disc visible if showGrid is enabled

- [ ] **Step 4: Verify mirror mode**

Toggle mirror mode in the viewer. Verify prop colors swap and positions mirror correctly.

- [ ] **Step 5: Verify props-only mode**

Set `showAvatar={false}` and `showGrid={false}` in PerformerRig (via dev controls or temporary code change). Verify props float in space at correct positions.

- [ ] **Step 6: Commit any fixes discovered during verification**

```bash
git add -A
git commit -m "fix: visual verification corrections for PerformerRig hierarchy"
```
