# Real Flow → TKA Sequence (ArUco Notation) Implementation Plan

> **Archived 2026-08-03. Do not execute this plan.** The ArUco tracker,
> camera-frame solver, marker generator, and vendored library were removed in
> commit `e42cfcae8b` after capture moved to illuminated staff endpoints. The
> shipped LED design is recorded in
> `docs/superpowers/specs/shipped/2026-06-20-real-flow-notation-aruco-design.md`.
> Real-video proof remains open in
> `docs/superpowers/specs/active/2026-07-03-fable-real-flow-notation-validation-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transcribe real double-staff flow video into a TKA pictograph sequence — grid position, orientation (radial/nonradial, in/out), motion type (pro/anti/float/dash/static), and turns — using single-camera ArUco 6-DOF pose to capture roll.

**Architecture:** Build the TKA classification brain first as pure, unit-tested units (`GridFrameSolver`, `TkaPoseClassifier`, beat segmenter, render bridge) operating on Three.js vectors/matrices — no video I/O. Wire the messy ArUco detector (`ArucoStaffTracker`, vendored js-aruco2) and the UI last, verified by integration against a real clip. Reuse the existing `prop-tracking-lab` scaffolding, `DetectedKeyframe` types, and render via the existing `PictographContainer`/`PictographRenderer`.

**Tech Stack:** TypeScript, Svelte 5 runes, Three.js (`Matrix4`/`Vector3`/`Quaternion`, already a dep at `^0.182`), vitest (`tests/config/vitest.config.ts`), vendored js-aruco2 (MIT core + BSD ArUco — ship-clean).

**Domain ground truth (verified via Flow Arts Knowledge MCP, 2026-06-21):**
- **Grid:** 8 locations `n/ne/e/se/s/sw/w/nw`. Cardinal = N/E/S/W (diamond), intercardinal = NE/SE/SW/NW (box). Adjacent = 90° (diamond) / 45° (8-point). Opposite = 180°.
- **Orientation** (`Orientation` enum, `pictograph-enums.ts`): `in` = prop points toward center, `out` = away, `clock`/`counter` = perpendicular (nonradial). Radial axis = in↔out; nonradial axis = clock↔counter.
- **Hand motion:** same location → static; adjacent perimeter arc → shift; diametrically opposite straight line → dash.
- **Shift prop type** (renderer `MotionType` = pro/anti/float/dash/static): **pro** = prop rotates WITH the arc (orientation preserved), **anti** = AGAINST the arc (orientation reverses), **float** = zero absolute prop rotation (holds spatial angle; the −0.5-turn boundary between pro and anti). Pro/anti is **arc-relative**, NOT absolute world cw/ccw.
- **Turns:** 1 turn = 180° of rotation *additional* to the motion type's base rotation. 0-turn pro and 0-turn anti both still rotate (base rate). Half-turn (90°) = L3, quarter-turn (45°) = L6. Absolute cw/ccw only becomes a distinct state at ≥1 turn.

**Grid frame convention (used everywhere below):** right-handed, **X = East (right), Y = North (up/top of pictograph), Z = toward camera (out of screen)**. The 2D grid plane is XY; location angle θ = `atan2(x, y)` measured clockwise from North (N=0°, NE=45°, E=90°, …, NW=315°).

---

## File Structure

**New files (pure brain — unit tested):**
- `src/lib/features/train/prop-tracking-lab/domain/notation-3d.ts` — 3D notation types (`DetectedMarker`, `StaffPose3D`, `MarkerAssignment`, `StaffMotionNotation`, `BeatPose3D`).
- `src/lib/features/train/prop-tracking-lab/services/grid-frame-solver.ts` — `GridFrameSolver`: ArUco camera-frame marker poses → grid-frame `StaffPose3D`.
- `src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.ts` — `TkaPoseClassifier`: `StaffPose3D` (+ inter-beat stream) → TKA primitives.
- `src/lib/features/train/prop-tracking-lab/services/beat-segmenter-3d.ts` — `segmentBeats3D`: 3D grip-position stream → beat frame indices (low-motion spans).
- `src/lib/features/train/prop-tracking-lab/services/notation-to-pictograph.ts` — `notationToPictographData`: a pair of per-staff `StaffMotionNotation` → renderable `PictographData`.

**New files (ArUco I/O — integration tested):**
- `src/lib/features/train/prop-tracking-lab/vendor/js-aruco2/` — vendored js-aruco2 sources + license.
- `src/lib/features/train/prop-tracking-lab/vendor/js-aruco2/index.ts` — typed ESM wrapper exposing `AR.Detector`, `POS.Posit`.
- `src/lib/features/train/prop-tracking-lab/services/aruco-staff-tracker.ts` — `ArucoStaffTracker`: per-frame `ImageData` → `DetectedMarker[]` (swaps `SimplePropTracker`).

**Modified files:**
- `src/lib/features/train/prop-tracking-lab/domain/models.ts` — re-export 3D notation types; add `markerAssignment` to config.
- `src/lib/features/train/prop-tracking-lab/components/PropTrackingLab.svelte` — drive the new pipeline + render the pictograph strip.

**Test files (co-located, `*.test.ts`):**
- `services/grid-frame-solver.test.ts`, `services/tka-pose-classifier.test.ts`, `services/beat-segmenter-3d.test.ts`, `services/notation-to-pictograph.test.ts`, `services/aruco-staff-tracker.test.ts`.

**Run a single test file:** `npx vitest run --config tests/config/vitest.config.ts <path>`

---

## Task 1: 3D notation domain types

**Files:**
- Create: `src/lib/features/train/prop-tracking-lab/domain/notation-3d.ts`
- Test: `src/lib/features/train/prop-tracking-lab/domain/notation-3d.test.ts`
- Modify: `src/lib/features/train/prop-tracking-lab/domain/models.ts`

- [ ] **Step 1: Write the failing test**

```ts
// notation-3d.test.ts
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { createMarkerAssignment, DEFAULT_MARKER_ASSIGNMENT } from './notation-3d';
import type { StaffPose3D, DetectedMarker } from './notation-3d';

describe('notation-3d types', () => {
  it('DEFAULT_MARKER_ASSIGNMENT has distinct ids and a positive marker size', () => {
    const a = DEFAULT_MARKER_ASSIGNMENT;
    const ids = new Set([a.centerRefId, a.blueId, a.redId]);
    expect(ids.size).toBe(3);
    expect(a.markerSizeMm).toBeGreaterThan(0);
  });

  it('createMarkerAssignment overrides only provided fields', () => {
    const a = createMarkerAssignment({ blueId: 7 });
    expect(a.blueId).toBe(7);
    expect(a.centerRefId).toBe(DEFAULT_MARKER_ASSIGNMENT.centerRefId);
  });

  it('StaffPose3D / DetectedMarker are usable structurally', () => {
    const marker: DetectedMarker = {
      id: 1, posCam: new Vector3(0, 0, 500), rotCam: [1, 0, 0, 0, 1, 0, 0, 0, 1], corners: [],
    };
    const pose: StaffPose3D = { gripPos: new Vector3(), axisDir: new Vector3(0, 1, 0), rollRad: 0 };
    expect(marker.rotCam).toHaveLength(9);
    expect(pose.axisDir.y).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/domain/notation-3d.test.ts`
Expected: FAIL — "Failed to resolve import './notation-3d'".

- [ ] **Step 3: Write the types**

```ts
// notation-3d.ts
import type { Vector3 } from 'three';
import type {
  GridLocation,
  MotionType,
  RotationDirection,
  Orientation,
} from './tka-enums';

/**
 * 3D notation domain types for the ArUco real-flow pipeline.
 *
 * Grid frame convention: X = East (right), Y = North (top), Z = toward camera.
 * The 2D grid plane is XY; location angle = atan2(x, y) clockwise from North.
 */

/** One ArUco marker detected in a single video frame, in CAMERA space. */
export interface DetectedMarker {
  /** Marker dictionary id. */
  id: number;
  /** Marker-center translation in camera frame (POSIT model-size units = mm). */
  posCam: Vector3;
  /** Camera-frame orientation as a 3x3 ROW-MAJOR rotation matrix (length 9). */
  rotCam: number[];
  /** Detection corner pixels (debug / confidence only). */
  corners: { x: number; y: number }[];
}

export type StaffColor = 'blue' | 'red';

/** Which marker id is which role + the physical marker edge length for POSIT. */
export interface MarkerAssignment {
  centerRefId: number;
  blueId: number;
  redId: number;
  /** Physical marker edge length (mm). POSIT model size; same unit for all markers. */
  markerSizeMm: number;
}

export const DEFAULT_MARKER_ASSIGNMENT: MarkerAssignment = {
  centerRefId: 0,
  blueId: 1,
  redId: 2,
  markerSizeMm: 80,
};

export function createMarkerAssignment(
  over: Partial<MarkerAssignment> = {},
): MarkerAssignment {
  return { ...DEFAULT_MARKER_ASSIGNMENT, ...over };
}

/** A staff's 6-DOF pose expressed in the TKA grid frame. */
export interface StaffPose3D {
  /** Marker/grip position in grid frame. */
  gripPos: Vector3;
  /** Unit vector along the shaft, from grip toward the marked tip, grid frame. */
  axisDir: Vector3;
  /** Roll about axisDir (radians), relative to grid-up reference. Range (-PI, PI]. */
  rollRad: number;
}

/** A classified beat for one staff. */
export interface BeatPose3D {
  staff: StaffColor;
  frameIndex: number;
  pose: StaffPose3D;
  location: GridLocation;
  orientation: Orientation;
}

/** The full TKA notation for one staff across a start→end beat pair. */
export interface StaffMotionNotation {
  staff: StaffColor;
  startLocation: GridLocation;
  endLocation: GridLocation;
  /** Hand-path family before prop-rotation refinement. */
  handMotion: 'static' | 'shift' | 'dash';
  /** Renderer-level motion type (shift resolves to pro/anti/float). */
  motionType: MotionType;
  rotationDirection: RotationDirection;
  /** Additional turns beyond base rotation, rounded to the configured increment. */
  turns: number;
  startOrientation: Orientation;
  endOrientation: Orientation;
  /** 0-1; lowest per-frame ArUco confidence over the beat span. */
  confidence: number;
}
```

- [ ] **Step 4: Create the local enum re-export so the brain has no UI-domain coupling**

```ts
// src/lib/features/train/prop-tracking-lab/domain/tka-enums.ts
/**
 * Re-export the canonical TKA enums the classifier emits, so notation-3d and the
 * services depend on one local module instead of deep pictograph paths.
 */
export type { GridLocation } from './models';
export {
  MotionType,
  RotationDirection,
  Orientation,
} from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
export type {
  MotionType as MotionTypeT,
  RotationDirection as RotationDirectionT,
  Orientation as OrientationT,
} from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
```

Note: `MotionType`/`RotationDirection`/`Orientation` in `pictograph-enums.ts` are `const` objects whose value type shares the name (`export type MotionType = (typeof MotionType)[keyof typeof MotionType]`). The value export gives the constants (e.g. `MotionType.PRO`); the type is carried by the same identifier. In `notation-3d.ts` import the **types** via `import type { MotionType } from './tka-enums'`.

- [ ] **Step 5: Re-export from models.ts**

Add to the bottom of `src/lib/features/train/prop-tracking-lab/domain/models.ts`:

```ts
// 3D ArUco-notation pipeline types (see notation-3d.ts).
export type {
  DetectedMarker,
  StaffColor,
  MarkerAssignment,
  StaffPose3D,
  BeatPose3D,
  StaffMotionNotation,
} from './notation-3d';
export { DEFAULT_MARKER_ASSIGNMENT, createMarkerAssignment } from './notation-3d';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/domain/notation-3d.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/domain/notation-3d.ts \
        src/lib/features/train/prop-tracking-lab/domain/notation-3d.test.ts \
        src/lib/features/train/prop-tracking-lab/domain/tka-enums.ts \
        src/lib/features/train/prop-tracking-lab/domain/models.ts
git commit -m "feat(notation): 3D ArUco-notation domain types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: GridFrameSolver — camera→grid transform + StaffPose3D

**Files:**
- Create: `src/lib/features/train/prop-tracking-lab/services/grid-frame-solver.ts`
- Test: `src/lib/features/train/prop-tracking-lab/services/grid-frame-solver.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// grid-frame-solver.test.ts
import { describe, it, expect } from 'vitest';
import { Vector3, Matrix4 } from 'three';
import { GridFrameSolver } from './grid-frame-solver';
import type { DetectedMarker } from '../domain/notation-3d';

/** Build a DetectedMarker from a row-major 3x3 rotation + camera translation. */
function marker(id: number, rotRowMajor: number[], pos: Vector3): DetectedMarker {
  return { id, posCam: pos, rotCam: rotRowMajor, corners: [] };
}

const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('GridFrameSolver', () => {
  it('with center at camera origin, staff grip maps to its camera translation', () => {
    const center = marker(0, IDENTITY3, new Vector3(0, 0, 0));
    const staff = marker(1, IDENTITY3, new Vector3(0.3, 0.1, 0.4));
    const gridFromCam = GridFrameSolver.gridFromCamera(center);
    const pose = GridFrameSolver.solve(staff, gridFromCam);
    expect(pose.gripPos.x).toBeCloseTo(0.3, 5);
    expect(pose.gripPos.y).toBeCloseTo(0.1, 5);
    expect(pose.gripPos.z).toBeCloseTo(0.4, 5);
  });

  it('reads the shaft axis (marker local +Y) into the grid frame', () => {
    const center = marker(0, IDENTITY3, new Vector3(0, 0, 0));
    // Identity orientation: local +Y stays grid +Y.
    const staff = marker(1, IDENTITY3, new Vector3(0, 0, 0.5));
    const pose = GridFrameSolver.solve(staff, GridFrameSolver.gridFromCamera(center));
    expect(pose.axisDir.x).toBeCloseTo(0, 5);
    expect(pose.axisDir.y).toBeCloseTo(1, 5);
    expect(pose.axisDir.z).toBeCloseTo(0, 5);
  });

  it('a staff lying along East has axisDir = grid +X', () => {
    // Rotate -90deg about Z so marker local +Y -> grid +X. Row-major Rz(-90):
    // [ cos sin 0; -sin cos 0; 0 0 1 ] with angle -90 => cos=0, sin=-1
    const rz = [0, -1, 0, 1, 0, 0, 0, 0, 1];
    const center = marker(0, IDENTITY3, new Vector3(0, 0, 0));
    const staff = marker(1, rz, new Vector3(0.3, 0, 0.5));
    const pose = GridFrameSolver.solve(staff, GridFrameSolver.gridFromCamera(center));
    expect(pose.axisDir.x).toBeCloseTo(1, 5);
    expect(pose.axisDir.y).toBeCloseTo(0, 5);
  });

  it('expresses staff pose relative to a rotated/translated center marker', () => {
    // Center translated to (1,0,2). Staff at (1.3,0,2). Relative grip = (0.3,0,0).
    const center = marker(0, IDENTITY3, new Vector3(1, 0, 2));
    const staff = marker(1, IDENTITY3, new Vector3(1.3, 0, 2));
    const pose = GridFrameSolver.solve(staff, GridFrameSolver.gridFromCamera(center));
    expect(pose.gripPos.x).toBeCloseTo(0.3, 5);
    expect(pose.gripPos.y).toBeCloseTo(0, 5);
    expect(pose.gripPos.z).toBeCloseTo(0, 5);
  });

  it('roll is 0 for an identity-oriented staff and tracks a twist about the axis', () => {
    const center = marker(0, IDENTITY3, new Vector3(0, 0, 0));
    const staff0 = marker(1, IDENTITY3, new Vector3(0, 0, 0.5));
    expect(GridFrameSolver.solve(staff0, GridFrameSolver.gridFromCamera(center)).rollRad)
      .toBeCloseTo(0, 4);

    // Twist 90deg about local +Y (the shaft). Row-major Ry(90): [0 0 1; 0 1 0; -1 0 0]
    const ry = [0, 0, 1, 0, 1, 0, -1, 0, 0];
    const staffTwisted = marker(1, ry, new Vector3(0, 0, 0.5));
    const roll = GridFrameSolver.solve(staffTwisted, GridFrameSolver.gridFromCamera(center)).rollRad;
    expect(Math.abs(roll)).toBeCloseTo(Math.PI / 2, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/grid-frame-solver.test.ts`
Expected: FAIL — "Failed to resolve import './grid-frame-solver'".

- [ ] **Step 3: Implement GridFrameSolver**

```ts
// grid-frame-solver.ts
import { Matrix4, Vector3 } from 'three';
import type { DetectedMarker, StaffPose3D } from '../domain/notation-3d';

/**
 * Turns ArUco camera-frame marker poses into grid-frame staff poses.
 *
 * The center reference marker defines the grid origin + axes; every staff pose
 * is read relative to it (gridFromStaff = inverse(camFromCenter) * camFromStaff),
 * so no metric/world calibration is needed. Grid frame: X=East, Y=North, Z=toward camera.
 *
 * Marker convention: the staff shaft runs along the marker's local +Y; the
 * marked tip is the +Y end. Roll is measured about that shaft axis.
 */
export class GridFrameSolver {
  /** camera→grid Matrix4 from the center reference marker. */
  static gridFromCamera(centerRef: DetectedMarker): Matrix4 {
    return markerMatrix(centerRef).invert();
  }

  static solve(staff: DetectedMarker, gridFromCam: Matrix4): StaffPose3D {
    const gridFromStaff = gridFromCam.clone().multiply(markerMatrix(staff));
    const e = gridFromStaff.elements; // column-major

    const gripPos = new Vector3(e[12], e[13], e[14]);
    // Basis columns of the rotation part.
    const xAxis = new Vector3(e[0], e[1], e[2]).normalize(); // marker local +X
    const axisDir = new Vector3(e[4], e[5], e[6]).normalize(); // marker local +Y = shaft

    return { gripPos, axisDir, rollRad: computeRoll(axisDir, xAxis) };
  }
}

/** Row-major 3x3 rotCam + camera translation → Three.js Matrix4 (camFromMarker). */
function markerMatrix(m: DetectedMarker): Matrix4 {
  const r = m.rotCam;
  // Matrix4.set takes ROW-MAJOR args; rotCam is row-major.
  return new Matrix4().set(
    r[0], r[1], r[2], m.posCam.x,
    r[3], r[4], r[5], m.posCam.y,
    r[6], r[7], r[8], m.posCam.z,
    0, 0, 0, 1,
  );
}

/**
 * Roll = signed angle of the marker's local +X about the shaft axis, relative to
 * a reference perpendicular built from grid-up (Y). Range (-PI, PI].
 */
function computeRoll(axisDir: Vector3, localX: Vector3): number {
  const up = new Vector3(0, 1, 0);
  // Project grid-up onto the plane perpendicular to the shaft as the 0-roll ref.
  let ref = up.clone().addScaledVector(axisDir, -up.dot(axisDir));
  if (ref.lengthSq() < 1e-8) {
    // Shaft nearly parallel to grid-up: fall back to grid-East as the reference.
    const east = new Vector3(1, 0, 0);
    ref = east.clone().addScaledVector(axisDir, -east.dot(axisDir));
  }
  ref.normalize();
  const refPerp = new Vector3().crossVectors(axisDir, ref).normalize();
  // localX may have a component along axisDir; the atan2 of its in-plane parts is the roll.
  return Math.atan2(localX.dot(refPerp), localX.dot(ref));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/grid-frame-solver.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/services/grid-frame-solver.ts \
        src/lib/features/train/prop-tracking-lab/services/grid-frame-solver.test.ts
git commit -m "feat(notation): GridFrameSolver camera->grid 6-DOF transform

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: TkaPoseClassifier — grid location + grid mode

**Files:**
- Create: `src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.ts`
- Test: `src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tka-pose-classifier.test.ts (Task 3 portion)
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { TkaPoseClassifier } from './tka-pose-classifier';

const c = new TkaPoseClassifier();

describe('TkaPoseClassifier.classifyLocation', () => {
  it('maps the four cardinals (X=East, Y=North)', () => {
    expect(c.classifyLocation(new Vector3(0, 1, 0))).toBe('n');
    expect(c.classifyLocation(new Vector3(1, 0, 0))).toBe('e');
    expect(c.classifyLocation(new Vector3(0, -1, 0))).toBe('s');
    expect(c.classifyLocation(new Vector3(-1, 0, 0))).toBe('w');
  });

  it('maps the four intercardinals', () => {
    expect(c.classifyLocation(new Vector3(1, 1, 0))).toBe('ne');
    expect(c.classifyLocation(new Vector3(1, -1, 0))).toBe('se');
    expect(c.classifyLocation(new Vector3(-1, -1, 0))).toBe('sw');
    expect(c.classifyLocation(new Vector3(-1, 1, 0))).toBe('nw');
  });

  it('ignores Z (depth) and small radius noise', () => {
    expect(c.classifyLocation(new Vector3(0.02, 0.98, 0.7))).toBe('n');
  });

  it('snaps near-boundary angles to the nearest 45deg bucket', () => {
    // 20deg from North -> still N
    expect(c.classifyLocation(new Vector3(Math.sin(0.35), Math.cos(0.35), 0))).toBe('n');
    // 30deg from North -> NE side (closer to 45 than 0)
    expect(c.classifyLocation(new Vector3(Math.sin(0.6), Math.cos(0.6), 0))).toBe('ne');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`
Expected: FAIL — "Failed to resolve import './tka-pose-classifier'".

- [ ] **Step 3: Implement the class shell + classifyLocation**

```ts
// tka-pose-classifier.ts
import { Vector3 } from 'three';
import type { GridLocation } from '../domain/models';
import { GridMode } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';

/** 8 grid locations ordered clockwise from North at 45deg steps. */
const LOCATIONS: GridLocation[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const CARDINALS = new Set<GridLocation>(['n', 'e', 's', 'w']);

export interface ClassifierConfig {
  /** Round turns to this increment. 0.5 = half-turn (L3); 0.25 = quarter (L6). */
  turnIncrement: number;
  /** |cos angle| above this = radial (in/out); below = nonradial (clock/counter). */
  radialDotThreshold: number;
}

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  turnIncrement: 0.5,
  radialDotThreshold: 0.707, // 45deg split between radial and nonradial
};

export class TkaPoseClassifier {
  constructor(private config: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG) {}

  /** Nearest of the 8 grid locations for a grip position (XY plane, Z ignored). */
  classifyLocation(gripPos: Vector3): GridLocation {
    // Clockwise angle from North: atan2(East, North).
    const theta = Math.atan2(gripPos.x, gripPos.y); // (-PI, PI], 0 = North
    const deg = ((theta * 180) / Math.PI + 360) % 360;
    const bucket = Math.round(deg / 45) % 8;
    return LOCATIONS[bucket]!;
  }

  /** Diamond when both ends are cardinal; box when both intercardinal. */
  gridModeFor(a: GridLocation, b: GridLocation): GridMode {
    const cardinalCount = (CARDINALS.has(a) ? 1 : 0) + (CARDINALS.has(b) ? 1 : 0);
    return cardinalCount >= 1 ? GridMode.DIAMOND : GridMode.BOX;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.ts \
        src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts
git commit -m "feat(notation): grid-location classification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: TkaPoseClassifier — orientation (radial/nonradial, in/out)

**MCP-ground at implementation:** before writing, call `get_term_definition("orientation")` and `get_domain_topic("orientation algebra")` to re-confirm: `in` = shaft points toward center, `out` = away, `clock`/`counter` = perpendicular. The test cases below encode exactly that.

**Files:**
- Modify: `src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.ts`
- Modify: `src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to tka-pose-classifier.test.ts
import { Orientation } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';

describe('TkaPoseClassifier.classifyOrientation', () => {
  // Staff at North (gripPos +Y). Radius-out direction at North = +Y.
  it('shaft pointing away from center = OUT', () => {
    const grip = new Vector3(0, 1, 0);
    const axisOut = new Vector3(0, 1, 0); // points further out (north)
    expect(c.classifyOrientation(grip, axisOut)).toBe(Orientation.OUT);
  });

  it('shaft pointing toward center = IN', () => {
    const grip = new Vector3(0, 1, 0);
    const axisIn = new Vector3(0, -1, 0); // points back toward center
    expect(c.classifyOrientation(grip, axisIn)).toBe(Orientation.IN);
  });

  it('shaft perpendicular, tangent toward +East at North = CLOCK', () => {
    // At North, clockwise tangent (toward East) is +X.
    const grip = new Vector3(0, 1, 0);
    const axisTangentCW = new Vector3(1, 0, 0);
    expect(c.classifyOrientation(grip, axisTangentCW)).toBe(Orientation.CLOCK);
  });

  it('shaft perpendicular, tangent toward -East at North = COUNTER', () => {
    const grip = new Vector3(0, 1, 0);
    const axisTangentCCW = new Vector3(-1, 0, 0);
    expect(c.classifyOrientation(grip, axisTangentCCW)).toBe(Orientation.COUNTER);
  });

  it('ignores the out-of-plane (Z) component of the shaft', () => {
    const grip = new Vector3(0, 1, 0);
    const axisOutTilted = new Vector3(0, 1, 0.5); // tilted toward camera but radial in-plane
    expect(c.classifyOrientation(grip, axisOutTilted)).toBe(Orientation.OUT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`
Expected: FAIL — "classifyOrientation is not a function".

- [ ] **Step 3: Implement classifyOrientation**

Add the import and method to `tka-pose-classifier.ts`:

```ts
// add to imports
import { Orientation } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
```

```ts
// add as a method on TkaPoseClassifier
/**
 * Orientation of the shaft relative to the radius at its grid location.
 * Radial (|radialDot| >= threshold): OUT if pointing away from center, IN if toward.
 * Nonradial: CLOCK if the in-plane shaft points clockwise-tangent, COUNTER otherwise.
 */
classifyOrientation(gripPos: Vector3, axisDir: Vector3): Orientation {
  const radial = new Vector3(gripPos.x, gripPos.y, 0);
  if (radial.lengthSq() < 1e-9) return Orientation.OUT; // degenerate (at center)
  radial.normalize();
  const axis2d = new Vector3(axisDir.x, axisDir.y, 0);
  if (axis2d.lengthSq() < 1e-9) return Orientation.OUT; // shaft straight at camera
  axis2d.normalize();

  const radialDot = axis2d.dot(radial); // +1 = out, -1 = in
  if (Math.abs(radialDot) >= this.config.radialDotThreshold) {
    return radialDot >= 0 ? Orientation.OUT : Orientation.IN;
  }
  // Nonradial: clockwise tangent at a location = radius rotated -90deg in screen terms.
  // In XY (X=East,Y=North), the clockwise tangent t = (radial.y, -radial.x).
  const tangentCW = new Vector3(radial.y, -radial.x, 0);
  return axis2d.dot(tangentCW) >= 0 ? Orientation.CLOCK : Orientation.COUNTER;
}
```

Verify the CLOCK case by hand: at North radial=(0,1); tangentCW=(1,0); axisTangentCW=(1,0) → dot=1 ≥0 → CLOCK. ✓ COUNTER: axis=(-1,0)·(1,0)=-1 → COUNTER. ✓

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`
Expected: PASS (Task 3 + Task 4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.ts \
        src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts
git commit -m "feat(notation): orientation classification (in/out/clock/counter)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: TkaPoseClassifier — hand motion + pro/anti/float

**MCP-ground at implementation:** call `get_term_definition` for `static`, `shift`, `dash`, `pro`, `anti`, `float`, and `get_domain_topic("motion-types-complete")`. Confirm: same location→static, adjacent→shift, opposite→dash; pro=prop rotates WITH the arc, anti=AGAINST, float=zero absolute prop rotation. Pro/anti is arc-relative.

**Files:**
- Modify: `src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.ts`
- Modify: `src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to tka-pose-classifier.test.ts
import { MotionType } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';

describe('TkaPoseClassifier.classifyHandMotion', () => {
  it('same location = static', () => {
    expect(c.classifyHandMotion('n', 'n')).toBe('static');
  });
  it('adjacent (45deg) = shift', () => {
    expect(c.classifyHandMotion('n', 'ne')).toBe('shift');
    expect(c.classifyHandMotion('e', 'n')).toBe('shift');
  });
  it('opposite (180deg) = dash', () => {
    expect(c.classifyHandMotion('n', 's')).toBe('dash');
    expect(c.classifyHandMotion('ne', 'sw')).toBe('dash');
  });
  it('90deg cardinal-to-cardinal counts as a shift (diamond adjacency)', () => {
    expect(c.classifyHandMotion('n', 'e')).toBe('shift');
  });
});

describe('TkaPoseClassifier.classifyShiftType', () => {
  // arcAngle and propNetRotation are signed (CCW positive) radians.
  it('prop rotates WITH the arc (propNet ~= arc) = pro', () => {
    expect(c.classifyShiftType(Math.PI / 2, Math.PI / 2)).toBe(MotionType.PRO);
  });
  it('prop rotates AGAINST the arc (propNet ~= -arc) = anti', () => {
    expect(c.classifyShiftType(Math.PI / 2, -Math.PI / 2)).toBe(MotionType.ANTI);
  });
  it('prop holds absolute angle (propNet ~= 0) = float', () => {
    expect(c.classifyShiftType(Math.PI / 2, 0)).toBe(MotionType.FLOAT);
  });
  it('pro with extra spin still classifies pro (sign matches arc)', () => {
    // One extra full turn beyond base: propNet = arc + 2*PI, same sign as arc.
    expect(c.classifyShiftType(Math.PI / 2, Math.PI / 2 + 2 * Math.PI)).toBe(MotionType.PRO);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`
Expected: FAIL — "classifyHandMotion is not a function".

- [ ] **Step 3: Implement classifyHandMotion + classifyShiftType**

Add the import and methods to `tka-pose-classifier.ts`:

```ts
// extend the existing pictograph-enums import:
import { MotionType, Orientation } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
```

```ts
// methods on TkaPoseClassifier

/** Angular separation (0..4, in 45deg units) between two grid locations. */
private locStep(a: GridLocation, b: GridLocation): number {
  const ia = LOCATIONS.indexOf(a);
  const ib = LOCATIONS.indexOf(b);
  const raw = Math.abs(ia - ib) % 8;
  return Math.min(raw, 8 - raw); // 0..4
}

/** Hand-path family: same→static, opposite(4 steps)→dash, else→shift. */
classifyHandMotion(start: GridLocation, end: GridLocation): 'static' | 'shift' | 'dash' {
  const step = this.locStep(start, end);
  if (step === 0) return 'static';
  if (step === 4) return 'dash';
  return 'shift';
}

/**
 * Shift prop type from the arc direction vs the prop's net spatial rotation.
 * Both signed CCW-positive radians. With-arc = pro, against = anti, ~0 spin = float.
 * Float band = a small absolute-rotation deadzone (the -0.5-turn boundary).
 */
classifyShiftType(arcAngle: number, propNetRotation: number): MotionType {
  const FLOAT_BAND = Math.PI / 4; // < 45deg net spin over a shift = float
  if (Math.abs(propNetRotation) < FLOAT_BAND) return MotionType.FLOAT;
  return Math.sign(propNetRotation) === Math.sign(arcAngle)
    ? MotionType.PRO
    : MotionType.ANTI;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`
Expected: PASS (all Task 3-5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.ts \
        src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts
git commit -m "feat(notation): hand-motion + pro/anti/float classification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: TkaPoseClassifier — turns, rotation direction, and the full per-staff notation

**MCP-ground at implementation:** call `get_domain_topic("base-rotation")` and `get_term_definition("turns")`. Confirm: turns = additional rotation beyond base; 1 turn = 180deg; pro base = +arc, anti base = -arc; dash/static base = 0.

**Files:**
- Modify: `src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.ts`
- Modify: `src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`

- [ ] **Step 1: Add the failing test**

```ts
// append to tka-pose-classifier.test.ts
import { RotationDirection } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
import type { StaffPose3D } from '../domain/notation-3d';

function pose(grip: Vector3, axis: Vector3, roll = 0): StaffPose3D {
  return { gripPos: grip, axisDir: axis, rollRad: roll };
}

describe('TkaPoseClassifier.classifyMotion (full per-staff notation)', () => {
  it('static, no spin = static motion, 0 turns', () => {
    const start = pose(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
    const end = pose(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
    const n = c.classifyMotion('blue', start, end, /*arcAngle*/ 0, /*propNet*/ 0, 1);
    expect(n.handMotion).toBe('static');
    expect(n.motionType).toBe(MotionType.STATIC);
    expect(n.turns).toBe(0);
    expect(n.startLocation).toBe('n');
    expect(n.endLocation).toBe('n');
  });

  it('dash N->S with one extra turn of spin', () => {
    const start = pose(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
    const end = pose(new Vector3(0, -1, 0), new Vector3(0, -1, 0));
    // dash base = 0; net prop rotation = PI (1 turn) CCW.
    const n = c.classifyMotion('blue', start, end, 0, Math.PI, 1);
    expect(n.handMotion).toBe('dash');
    expect(n.motionType).toBe(MotionType.DASH);
    expect(n.turns).toBe(1);
    expect(n.rotationDirection).toBe(RotationDirection.COUNTER_CLOCKWISE);
  });

  it('pro shift N->E at base rotation = 0 turns', () => {
    const start = pose(new Vector3(0, 1, 0), new Vector3(0, 1, 0)); // out at N
    const end = pose(new Vector3(1, 0, 0), new Vector3(1, 0, 0)); // out at E
    // Hand arc N->E is clockwise => arcAngle = -PI/2 (CCW-positive convention).
    // Pro base preserves orientation: propNet = arcAngle = -PI/2. Additional = 0.
    const n = c.classifyMotion('blue', start, end, -Math.PI / 2, -Math.PI / 2, 1);
    expect(n.handMotion).toBe('shift');
    expect(n.motionType).toBe(MotionType.PRO);
    expect(n.turns).toBe(0);
  });

  it('anti shift with a half extra turn rounds turns to 0.5', () => {
    const start = pose(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
    const end = pose(new Vector3(1, 0, 0), new Vector3(1, 0, 0));
    // anti base = -arc = +PI/2; add 90deg (0.5 turn): propNet = PI/2 + PI/2 = PI.
    const n = c.classifyMotion('blue', start, end, -Math.PI / 2, Math.PI, 1);
    expect(n.motionType).toBe(MotionType.ANTI);
    expect(n.turns).toBe(0.5);
  });

  it('carries the lowest confidence over the beat span', () => {
    const p = pose(new Vector3(0, 1, 0), new Vector3(0, 1, 0));
    const n = c.classifyMotion('red', p, p, 0, 0, 0.42);
    expect(n.confidence).toBeCloseTo(0.42, 5);
    expect(n.staff).toBe('red');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`
Expected: FAIL — "classifyMotion is not a function".

- [ ] **Step 3: Implement classifyMotion + helpers**

Add to `tka-pose-classifier.ts` (extend imports and add methods):

```ts
// extend imports
import { MotionType, Orientation, RotationDirection } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
import type { StaffColor, StaffPose3D, StaffMotionNotation } from '../domain/notation-3d';
```

```ts
// methods on TkaPoseClassifier

/** Round a turn count to the configured increment (default 0.5). */
private roundTurns(raw: number): number {
  const inc = this.config.turnIncrement;
  return Math.round(raw / inc) * inc;
}

/** Base prop rotation inherent to a motion type, signed CCW-positive. */
private baseRotation(motionType: MotionType, arcAngle: number): number {
  switch (motionType) {
    case MotionType.PRO: return arcAngle;     // preserves orientation
    case MotionType.ANTI: return -arcAngle;   // reverses orientation
    default: return 0;                        // dash, static, float
  }
}

/**
 * Full per-staff notation across a beat pair.
 * @param arcAngle signed CCW-positive hand-arc rotation about center (shift only; 0 otherwise)
 * @param propNetRotation signed CCW-positive net prop spin over the span
 * @param confidence lowest per-frame ArUco confidence over the span
 */
classifyMotion(
  staff: StaffColor,
  start: StaffPose3D,
  end: StaffPose3D,
  arcAngle: number,
  propNetRotation: number,
  confidence: number,
): StaffMotionNotation {
  const startLocation = this.classifyLocation(start.gripPos);
  const endLocation = this.classifyLocation(end.gripPos);
  const handMotion = this.classifyHandMotion(startLocation, endLocation);

  let motionType: MotionType;
  if (handMotion === 'static') motionType = MotionType.STATIC;
  else if (handMotion === 'dash') motionType = MotionType.DASH;
  else motionType = this.classifyShiftType(arcAngle, propNetRotation);

  const additional = propNetRotation - this.baseRotation(motionType, arcAngle);
  const turns = motionType === MotionType.FLOAT
    ? 0 // float has no turn count
    : this.roundTurns(Math.abs(additional) / Math.PI);

  let rotationDirection: RotationDirection;
  if (turns === 0 || motionType === MotionType.FLOAT) {
    rotationDirection = RotationDirection.NO_ROTATION;
  } else {
    rotationDirection = additional >= 0
      ? RotationDirection.COUNTER_CLOCKWISE
      : RotationDirection.CLOCKWISE;
  }

  return {
    staff,
    startLocation,
    endLocation,
    handMotion,
    motionType,
    rotationDirection,
    turns,
    startOrientation: this.classifyOrientation(start.gripPos, start.axisDir),
    endOrientation: this.classifyOrientation(end.gripPos, end.axisDir),
    confidence,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts`
Expected: PASS (all Task 3-6 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.ts \
        src/lib/features/train/prop-tracking-lab/services/tka-pose-classifier.test.ts
git commit -m "feat(notation): turns + rotation direction + full per-staff notation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Beat segmenter (3D grip-position stream)

Beats = spans where the grip holds still (low motion), the same model the existing 2D lab uses (`keyframeMotionThreshold`). Operates on the per-frame grip-position stream and returns the representative frame index of each held span, plus the signed arc and net prop rotation accumulated between consecutive beats.

**Files:**
- Create: `src/lib/features/train/prop-tracking-lab/services/beat-segmenter-3d.ts`
- Test: `src/lib/features/train/prop-tracking-lab/services/beat-segmenter-3d.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// beat-segmenter-3d.test.ts
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { segmentBeats3D, accumulateBetween } from './beat-segmenter-3d';
import type { StaffPose3D } from '../domain/notation-3d';

function pose(x: number, y: number, roll = 0): StaffPose3D {
  return { gripPos: new Vector3(x, y, 0), axisDir: new Vector3(0, 1, 0), rollRad: roll };
}

describe('segmentBeats3D', () => {
  it('finds two held spans separated by motion', () => {
    // 4 frames held at North, 3 frames moving, 4 frames held at East.
    const frames: StaffPose3D[] = [
      pose(0, 1), pose(0, 1), pose(0, 1), pose(0, 1),
      pose(0.3, 0.9), pose(0.6, 0.6), pose(0.9, 0.3),
      pose(1, 0), pose(1, 0), pose(1, 0), pose(1, 0),
    ];
    const beats = segmentBeats3D(frames, { motionThreshold: 0.05, minHeldFrames: 3 });
    expect(beats.length).toBe(2);
    // Representative frame is the middle of each held span.
    expect(beats[0]!.gripPos.y).toBeCloseTo(1, 5);
    expect(beats[1]!.gripPos.x).toBeCloseTo(1, 5);
  });

  it('a single held span yields one beat', () => {
    const frames = [pose(0, 1), pose(0, 1), pose(0, 1), pose(0, 1)];
    expect(segmentBeats3D(frames, { motionThreshold: 0.05, minHeldFrames: 3 }).length).toBe(1);
  });
});

describe('accumulateBetween', () => {
  it('sums signed arc angle (CCW positive) and net roll between two frame indices', () => {
    // Grip sweeps North(0,1) -> West(-1,0): +90deg CCW. Roll advances +0.1 each step.
    const frames: StaffPose3D[] = [
      pose(0, 1, 0.0),
      pose(-0.7, 0.7, 0.1),
      pose(-1, 0, 0.2),
    ];
    const { arcAngle, propNetRotation } = accumulateBetween(frames, 0, 2);
    expect(arcAngle).toBeCloseTo(Math.PI / 2, 2);
    expect(propNetRotation).toBeCloseTo(0.2, 4);
  });

  it('unwraps roll across the +/-PI seam', () => {
    // Roll jumps 3.0 -> -3.0 (a +0.283 step across PI, not -6.0).
    const frames: StaffPose3D[] = [pose(0, 1, 3.0), pose(0, 1, -3.0)];
    const { propNetRotation } = accumulateBetween(frames, 0, 1);
    expect(propNetRotation).toBeCloseTo((Math.PI - 3.0) * 2, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/beat-segmenter-3d.test.ts`
Expected: FAIL — "Failed to resolve import './beat-segmenter-3d'".

- [ ] **Step 3: Implement the segmenter**

```ts
// beat-segmenter-3d.ts
import { Vector3 } from 'three';
import type { StaffPose3D } from '../domain/notation-3d';

export interface SegmentConfig {
  /** Per-frame grip displacement (grid units) below which the staff is "held". */
  motionThreshold: number;
  /** Minimum consecutive held frames to count as a beat. */
  minHeldFrames: number;
}

export const DEFAULT_SEGMENT_CONFIG: SegmentConfig = {
  motionThreshold: 0.05,
  minHeldFrames: 3,
};

/** Held-span beat poses: the middle frame of each low-motion run. */
export function segmentBeats3D(
  frames: StaffPose3D[],
  config: SegmentConfig = DEFAULT_SEGMENT_CONFIG,
): StaffPose3D[] {
  const beats: StaffPose3D[] = [];
  let runStart = 0;

  const flush = (endExclusive: number) => {
    const len = endExclusive - runStart;
    if (len >= config.minHeldFrames) {
      beats.push(frames[runStart + Math.floor(len / 2)]!);
    }
  };

  for (let i = 1; i <= frames.length; i++) {
    const moved =
      i < frames.length &&
      frames[i]!.gripPos.distanceTo(frames[i - 1]!.gripPos) > config.motionThreshold;
    if (moved || i === frames.length) {
      flush(i);
      runStart = i;
    }
  }
  return beats;
}

/** Shortest signed delta from a to b in (-PI, PI]. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Signed grip-arc angle about center (CCW+) and unwrapped net roll over [from,to]. */
export function accumulateBetween(
  frames: StaffPose3D[],
  from: number,
  to: number,
): { arcAngle: number; propNetRotation: number } {
  let arcAngle = 0;
  let propNetRotation = 0;
  for (let i = from + 1; i <= to; i++) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    // Hand arc: CCW-positive angle of the grip vector about center (XY plane).
    const aPrev = Math.atan2(prev.gripPos.y, prev.gripPos.x);
    const aCur = Math.atan2(cur.gripPos.y, cur.gripPos.x);
    arcAngle += angleDelta(aPrev, aCur);
    // Net roll: unwrap across the +/-PI seam.
    propNetRotation += angleDelta(prev.rollRad, cur.rollRad);
  }
  return { arcAngle, propNetRotation };
}
```

Hand-check the arc sign for the test: grip North=(0,1) → `atan2(1,0)=+PI/2`; West=(-1,0) → `atan2(0,-1)=PI`. Delta from PI/2 to PI = +PI/2 (CCW). ✓ Note this `atan2(y,x)` arc convention (standard math CCW) is the signed-arc input to `classifyMotion`; it is independent of the `atan2(x,y)` clockwise-from-North convention used only for *location bucketing*. Keep them separate — arc accumulation is CCW-positive math angle; location bucketing is clockwise-from-North.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/beat-segmenter-3d.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/services/beat-segmenter-3d.ts \
        src/lib/features/train/prop-tracking-lab/services/beat-segmenter-3d.test.ts
git commit -m "feat(notation): 3D beat segmenter + arc/roll accumulation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Render bridge — StaffMotionNotation pair → PictographData

Maps a blue+red `StaffMotionNotation` pair into a `PictographData` the existing `PictographContainer` can render (it prepares + renders internally). Letter is left null (a notation strip, not a named letter); grid mode is derived from the locations.

**Files:**
- Create: `src/lib/features/train/prop-tracking-lab/services/notation-to-pictograph.ts`
- Test: `src/lib/features/train/prop-tracking-lab/services/notation-to-pictograph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// notation-to-pictograph.test.ts
import { describe, it, expect } from 'vitest';
import { notationToPictographData } from './notation-to-pictograph';
import { MotionType, RotationDirection, Orientation } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
import { GridLocation, GridMode } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
import type { StaffMotionNotation } from '../domain/notation-3d';

function note(over: Partial<StaffMotionNotation>): StaffMotionNotation {
  return {
    staff: 'blue',
    startLocation: 'n',
    endLocation: 'e',
    handMotion: 'shift',
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
    startOrientation: Orientation.OUT,
    endOrientation: Orientation.OUT,
    confidence: 1,
    ...over,
  };
}

describe('notationToPictographData', () => {
  it('builds blue+red motions with mapped enums and locations', () => {
    const blue = note({ staff: 'blue', startLocation: 'n', endLocation: 'e' });
    const red = note({ staff: 'red', startLocation: 's', endLocation: 'w', motionType: MotionType.ANTI });
    const pd = notationToPictographData(blue, red, 'beat-1');

    expect(pd.id).toBe('beat-1');
    expect(pd.motions.blue!.motionType).toBe(MotionType.PRO);
    expect(pd.motions.blue!.startLocation).toBe(GridLocation.NORTH);
    expect(pd.motions.blue!.endLocation).toBe(GridLocation.EAST);
    expect(pd.motions.red!.motionType).toBe(MotionType.ANTI);
    expect(pd.motions.red!.startLocation).toBe(GridLocation.SOUTH);
  });

  it('derives diamond grid mode for cardinal locations', () => {
    const pd = notationToPictographData(
      note({ startLocation: 'n', endLocation: 'e' }),
      note({ staff: 'red', startLocation: 's', endLocation: 'w' }),
      'b',
    );
    expect(pd.gridMode).toBe(GridMode.DIAMOND);
  });

  it('derives box grid mode for intercardinal locations', () => {
    const pd = notationToPictographData(
      note({ startLocation: 'ne', endLocation: 'se' }),
      note({ staff: 'red', startLocation: 'sw', endLocation: 'nw' }),
      'b',
    );
    expect(pd.gridMode).toBe(GridMode.BOX);
  });

  it('float maps to turns "fl"', () => {
    const pd = notationToPictographData(
      note({ motionType: MotionType.FLOAT, turns: 0 }),
      note({ staff: 'red' }),
      'b',
    );
    expect(pd.motions.blue!.turns).toBe('fl');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/notation-to-pictograph.test.ts`
Expected: FAIL — "Failed to resolve import './notation-to-pictograph'".

- [ ] **Step 3: Implement the bridge**

```ts
// notation-to-pictograph.ts
import type { PictographData } from '$lib/shared/pictograph/shared/domain/models/pictograph-data';
import { createMotionData } from '$lib/shared/pictograph/shared/domain/models/motion-data';
import { MotionType, MotionColor } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
import { GridLocation, GridMode } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
import type { StaffMotionNotation } from '../domain/notation-3d';

/** Lowercase notation location -> GridLocation enum value. */
const LOCATION_MAP: Record<string, GridLocation> = {
  n: GridLocation.NORTH,
  ne: GridLocation.NORTHEAST,
  e: GridLocation.EAST,
  se: GridLocation.SOUTHEAST,
  s: GridLocation.SOUTH,
  sw: GridLocation.SOUTHWEST,
  w: GridLocation.WEST,
  nw: GridLocation.NORTHWEST,
};

const CARDINAL = new Set(['n', 'e', 's', 'w']);

function toMotion(n: StaffMotionNotation, color: MotionColor, gridMode: GridMode) {
  return createMotionData({
    motionType: n.motionType,
    rotationDirection: n.rotationDirection,
    startLocation: LOCATION_MAP[n.startLocation]!,
    endLocation: LOCATION_MAP[n.endLocation]!,
    turns: n.motionType === MotionType.FLOAT ? 'fl' : n.turns,
    startOrientation: n.startOrientation,
    endOrientation: n.endOrientation,
    color,
    gridMode,
  });
}

/** Build a renderable PictographData from a blue+red notation pair. */
export function notationToPictographData(
  blue: StaffMotionNotation,
  red: StaffMotionNotation,
  id: string,
): PictographData {
  const allCardinal = [blue.startLocation, blue.endLocation, red.startLocation, red.endLocation]
    .every((l) => CARDINAL.has(l));
  const gridMode = allCardinal ? GridMode.DIAMOND : GridMode.BOX;

  return {
    id,
    letter: null,
    motions: {
      blue: toMotion(blue, MotionColor.BLUE, gridMode),
      red: toMotion(red, MotionColor.RED, gridMode),
    },
    gridMode,
  };
}
```

**Verify before writing:** confirm `GridLocation` enum member names (`NORTH`, `NORTHEAST`, …) and `GridMode` members by reading `src/lib/shared/pictograph/grid/domain/enums/grid-enums.ts`. If member names differ, fix `LOCATION_MAP` and the `GridMode` references to match.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/notation-to-pictograph.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/services/notation-to-pictograph.ts \
        src/lib/features/train/prop-tracking-lab/services/notation-to-pictograph.test.ts
git commit -m "feat(notation): render bridge notation pair -> PictographData

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Vendor js-aruco2 + typed ArucoStaffTracker

js-aruco2 exposes global `AR`/`POS`/`CV` namespaces (not ESM). Vendor the four source files, wrap them in a typed ESM module, and build the per-frame tracker. This task is verified by a smoke/integration test (constructing the detector + running it on a generated marker image), not pure unit logic.

**Files:**
- Create: `src/lib/features/train/prop-tracking-lab/vendor/js-aruco2/{aruco.js,cv.js,posit1.js,svd.js,LICENSE.txt}`
- Create: `src/lib/features/train/prop-tracking-lab/vendor/js-aruco2/index.ts`
- Create: `src/lib/features/train/prop-tracking-lab/vendor/js-aruco2/js-aruco2.d.ts`
- Create: `src/lib/features/train/prop-tracking-lab/services/aruco-staff-tracker.ts`
- Test: `src/lib/features/train/prop-tracking-lab/services/aruco-staff-tracker.test.ts`

- [ ] **Step 1: Vendor the sources (retain license)**

Download these from the pinned MIT/BSD repo `damianofalcioni/js-aruco2` (`master`) into the vendor dir, unchanged, keeping their headers:
- `src/aruco.js` → `vendor/js-aruco2/aruco.js`  (`AR` namespace: `AR.Detector`, `AR.Dictionary`)
- `src/cv.js` → `vendor/js-aruco2/cv.js`  (`CV` image ops; aruco.js depends on it)
- `src/posit1.js` → `vendor/js-aruco2/posit1.js`  (`POS` namespace: `POS.Posit`)
- `src/svd.js` → `vendor/js-aruco2/svd.js`  (`SVD`; posit depends on it)
- `LICENSE.txt` → `vendor/js-aruco2/LICENSE.txt`

```bash
cd src/lib/features/train/prop-tracking-lab/vendor/js-aruco2
BASE=https://raw.githubusercontent.com/damianofalcioni/js-aruco2/master
curl -fsSL "$BASE/src/aruco.js"  -o aruco.js
curl -fsSL "$BASE/src/cv.js"     -o cv.js
curl -fsSL "$BASE/src/posit1.js" -o posit1.js
curl -fsSL "$BASE/src/svd.js"    -o svd.js
curl -fsSL "$BASE/LICENSE.txt"   -o LICENSE.txt
```

If a path 404s, list the repo's `src/` via `https://github.com/damianofalcioni/js-aruco2/tree/master/src` and adjust filenames. Confirm `aruco.js` references `CV` and `posit1.js` references `SVD` so all four are present.

- [ ] **Step 2: Write the typed wrapper + ambient types**

The vendored files assign to a shared object when loaded as CommonomJS-free scripts; under Vite, import them for side effects and read the globals off `globalThis`. Wrap that once:

```ts
// vendor/js-aruco2/js-aruco2.d.ts
export interface ArucoMarker {
  id: number;
  corners: { x: number; y: number }[];
}
export interface PositPose {
  bestError: number;
  bestRotation: number[][]; // 3x3
  bestTranslation: number[]; // [x,y,z]
}
export interface ArucoDetector {
  detect(imageData: ImageData): ArucoMarker[];
}
export interface PositSolver {
  pose(corners: { x: number; y: number }[]): PositPose;
}
```

```ts
// vendor/js-aruco2/index.ts
// Side-effect imports: each file attaches its namespace to globalThis.
import './svd.js';
import './cv.js';
import './aruco.js';
import './posit1.js';
import type { ArucoDetector, PositSolver, ArucoMarker, PositPose } from './js-aruco2.d';

type ARNamespace = { Detector: new (opts?: { dictionaryName?: string }) => ArucoDetector };
type POSNamespace = { Posit: new (modelSize: number, focalLength: number) => PositSolver };

const AR = (globalThis as Record<string, unknown>).AR as ARNamespace;
const POS = (globalThis as Record<string, unknown>).POS as POSNamespace;

if (!AR?.Detector || !POS?.Posit) {
  throw new Error('js-aruco2 failed to load: AR.Detector / POS.Posit missing on globalThis');
}

/** ARUCO_MIP_36h12 is the robust default dictionary for this pipeline. */
export function createDetector(dictionaryName = 'ARUCO_MIP_36h12'): ArucoDetector {
  return new AR.Detector({ dictionaryName });
}

/** modelSize = physical marker edge length (mm); focalLength in pixels (~canvas width). */
export function createPosit(modelSize: number, focalLength: number): PositSolver {
  return new POS.Posit(modelSize, focalLength);
}

export type { ArucoDetector, PositSolver, ArucoMarker, PositPose };
```

If the vendored build attaches namespaces via ESM `export` rather than globals, replace the `globalThis` reads with named imports — inspect the head/tail of `aruco.js`/`posit1.js` after download and adapt. The wrapper is the single seam, so only this file changes.

- [ ] **Step 3: Write the ArucoStaffTracker + a smoke test**

```ts
// aruco-staff-tracker.ts
import { Vector3 } from 'three';
import { createDetector, createPosit } from '../vendor/js-aruco2/index';
import type { ArucoDetector, PositSolver } from '../vendor/js-aruco2/index';
import type { DetectedMarker, MarkerAssignment } from '../domain/notation-3d';

/**
 * Per-frame ArUco detection + POSIT 6-DOF pose. Pure per-frame; no TKA knowledge.
 * Output markers carry a ROW-MAJOR rotation (rotCam) + camera translation (posCam),
 * exactly what GridFrameSolver consumes.
 */
export class ArucoStaffTracker {
  private detector: ArucoDetector;
  private posit: PositSolver;

  constructor(assignment: MarkerAssignment, focalLengthPx: number) {
    this.detector = createDetector();
    this.posit = createPosit(assignment.markerSizeMm, focalLengthPx);
  }

  /** Detect all markers in a frame and solve each one's 6-DOF pose. */
  detect(frame: ImageData): DetectedMarker[] {
    const markers = this.detector.detect(frame);
    const out: DetectedMarker[] = [];
    for (const m of markers) {
      // POSIT expects corners centered on the image; recenter to principal point.
      const cx = frame.width / 2;
      const cy = frame.height / 2;
      const centered = m.corners.map((c) => ({ x: c.x - cx, y: cy - c.y }));
      const pose = this.posit.pose(centered);
      const r = pose.bestRotation;
      out.push({
        id: m.id,
        posCam: new Vector3(pose.bestTranslation[0]!, pose.bestTranslation[1]!, pose.bestTranslation[2]!),
        rotCam: [r[0]![0]!, r[0]![1]!, r[0]![2]!, r[1]![0]!, r[1]![1]!, r[1]![2]!, r[2]![0]!, r[2]![1]!, r[2]![2]!],
        corners: m.corners,
      });
    }
    return out;
  }
}
```

```ts
// aruco-staff-tracker.test.ts
import { describe, it, expect } from 'vitest';
import { ArucoStaffTracker } from './aruco-staff-tracker';
import { DEFAULT_MARKER_ASSIGNMENT } from '../domain/notation-3d';

describe('ArucoStaffTracker (smoke)', () => {
  it('constructs the detector + posit without throwing', () => {
    const tracker = new ArucoStaffTracker(DEFAULT_MARKER_ASSIGNMENT, 640);
    expect(tracker).toBeInstanceOf(ArucoStaffTracker);
  });

  it('returns an empty array on a blank frame', () => {
    const tracker = new ArucoStaffTracker(DEFAULT_MARKER_ASSIGNMENT, 640);
    const blank = new ImageData(64, 64); // all-zero RGBA
    expect(tracker.detect(blank)).toEqual([]);
  });
});
```

If `ImageData` is undefined under the vitest jsdom/node env, add a minimal polyfill at the top of the test:
```ts
// @vitest-environment jsdom
```
(`jsdom` provides `ImageData`.) Confirm the vitest config's default environment; add the directive only if the smoke test errors on `ImageData`.

- [ ] **Step 4: Run the smoke test**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/aruco-staff-tracker.test.ts`
Expected: PASS (2 tests). If it fails on global namespace loading, inspect the vendored files' export style and adjust `vendor/js-aruco2/index.ts` per Step 2's note, then re-run.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/vendor/js-aruco2 \
        src/lib/features/train/prop-tracking-lab/services/aruco-staff-tracker.ts \
        src/lib/features/train/prop-tracking-lab/services/aruco-staff-tracker.test.ts
git commit -m "feat(notation): vendor js-aruco2 + ArucoStaffTracker 6-DOF detection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Pipeline orchestrator + wire into PropTrackingLab UI

Tie the units into one pass and render the result. Add a small orchestrator that runs the whole chain over a frame stream, then drive it from the existing lab component and render the notation strip with `PictographContainer`.

**Files:**
- Create: `src/lib/features/train/prop-tracking-lab/services/notation-pipeline.ts`
- Test: `src/lib/features/train/prop-tracking-lab/services/notation-pipeline.test.ts`
- Modify: `src/lib/features/train/prop-tracking-lab/components/PropTrackingLab.svelte`

- [ ] **Step 1: Write the failing orchestrator test**

```ts
// notation-pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { framesToNotation } from './notation-pipeline';
import type { StaffPose3D } from '../domain/notation-3d';

function p(x: number, y: number, axis: Vector3, roll = 0): StaffPose3D {
  return { gripPos: new Vector3(x, y, 0), axisDir: axis, rollRad: roll };
}

describe('framesToNotation', () => {
  it('turns held->move->held staff streams into one motion notation per staff', () => {
    const out = new Vector3(0, 1, 0);
    const east = new Vector3(1, 0, 0);
    // Blue: held at N (out), arc to E (out). Red: held at S, held at S (static).
    const blueFrames: StaffPose3D[] = [
      p(0, 1, out), p(0, 1, out), p(0, 1, out),
      p(0.7, 0.7, new Vector3(0.7, 0.7, 0)), p(1, 0, east),
      p(1, 0, east), p(1, 0, east), p(1, 0, east),
    ];
    const redFrames: StaffPose3D[] = [
      p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)),
      p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)),
      p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)), p(0, -1, new Vector3(0, -1, 0)),
    ];
    const confidences = blueFrames.map(() => 1);

    const beats = framesToNotation(blueFrames, redFrames, confidences, confidences);
    expect(beats.length).toBeGreaterThanOrEqual(1);
    const first = beats[0]!;
    expect(first.blue.startLocation).toBe('n');
    expect(first.blue.endLocation).toBe('e');
    expect(first.blue.handMotion).toBe('shift');
    expect(first.red.handMotion).toBe('static');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/notation-pipeline.test.ts`
Expected: FAIL — "Failed to resolve import './notation-pipeline'".

- [ ] **Step 3: Implement the orchestrator**

```ts
// notation-pipeline.ts
import type { StaffPose3D, StaffMotionNotation } from '../domain/notation-3d';
import { segmentBeats3D, accumulateBetween, DEFAULT_SEGMENT_CONFIG } from './beat-segmenter-3d';
import type { SegmentConfig } from './beat-segmenter-3d';
import { TkaPoseClassifier, DEFAULT_CLASSIFIER_CONFIG } from './tka-pose-classifier';
import type { ClassifierConfig } from './tka-pose-classifier';

export interface BeatNotation {
  blue: StaffMotionNotation;
  red: StaffMotionNotation;
}

/**
 * Full notation pass: per-staff beat segmentation + inter-beat accumulation +
 * classification, paired into one BeatNotation per consecutive beat pair.
 * Beat boundaries are taken from the blue staff (the leader); red is sampled at
 * the same frame indices so the two strands stay aligned.
 */
export function framesToNotation(
  blueFrames: StaffPose3D[],
  redFrames: StaffPose3D[],
  blueConfidence: number[],
  redConfidence: number[],
  segConfig: SegmentConfig = DEFAULT_SEGMENT_CONFIG,
  classConfig: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG,
): BeatNotation[] {
  const classifier = new TkaPoseClassifier(classConfig);
  const beats = segmentBeats3D(blueFrames, segConfig);

  // Map each beat pose back to its frame index (nearest by grip position).
  const beatIndices = beats.map((b) =>
    blueFrames.findIndex((f) => f.gripPos.equals(b.gripPos)),
  );

  const out: BeatNotation[] = [];
  for (let i = 0; i < beatIndices.length - 1; i++) {
    const from = beatIndices[i]!;
    const to = beatIndices[i + 1]!;
    const blueAcc = accumulateBetween(blueFrames, from, to);
    const redAcc = accumulateBetween(redFrames, from, to);

    out.push({
      blue: classifier.classifyMotion(
        'blue', blueFrames[from]!, blueFrames[to]!,
        blueAcc.arcAngle, blueAcc.propNetRotation,
        minSlice(blueConfidence, from, to),
      ),
      red: classifier.classifyMotion(
        'red', redFrames[from]!, redFrames[to]!,
        redAcc.arcAngle, redAcc.propNetRotation,
        minSlice(redConfidence, from, to),
      ),
    });
  }

  // Single-beat clips (no motion) still emit one static notation.
  if (out.length === 0 && beatIndices.length === 1) {
    const idx = beatIndices[0]!;
    out.push({
      blue: classifier.classifyMotion('blue', blueFrames[idx]!, blueFrames[idx]!, 0, 0, minSlice(blueConfidence, idx, idx)),
      red: classifier.classifyMotion('red', redFrames[idx]!, redFrames[idx]!, 0, 0, minSlice(redConfidence, idx, idx)),
    });
  }
  return out;
}

function minSlice(arr: number[], from: number, to: number): number {
  let m = 1;
  for (let i = from; i <= to; i++) m = Math.min(m, arr[i] ?? 1);
  return m;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab/services/notation-pipeline.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Wire the UI — swap tracker, run the pipeline, render the strip**

In `PropTrackingLab.svelte`, replace the `SimplePropTracker` review flow with: per-frame `ArucoStaffTracker.detect` → split markers by `MarkerAssignment` → `GridFrameSolver.solve` per staff per frame → accumulate two `StaffPose3D[]` streams + confidence arrays → `framesToNotation` → `notationToPictographData` per beat → render a row of `<PictographContainer>`.

Add to the `<script>`:

```ts
import { ArucoStaffTracker } from '../services/aruco-staff-tracker';
import { GridFrameSolver } from '../services/grid-frame-solver';
import { framesToNotation } from '../services/notation-pipeline';
import { notationToPictographData } from '../services/notation-to-pictograph';
import { DEFAULT_MARKER_ASSIGNMENT, type StaffPose3D } from '../domain/notation-3d';
import PictographContainer from '$lib/shared/pictograph/shared/components/PictographContainer.svelte';
import type { PictographData } from '$lib/shared/pictograph/shared/domain/models/pictograph-data';

let notationPictographs = $state<PictographData[]>([]);

async function runNotation() {
  if (!videoElement) return;
  const assignment = DEFAULT_MARKER_ASSIGNMENT;
  const tracker = new ArucoStaffTracker(assignment, videoWidth);

  const blueFrames: StaffPose3D[] = [];
  const redFrames: StaffPose3D[] = [];
  const blueConf: number[] = [];
  const redConf: number[] = [];

  const total = Math.floor((videoDuration / 1000) * fps);
  const dt = 1000 / fps;
  extractionCanvas ??= document.createElement('canvas');
  extractionCanvas.width = videoWidth;
  extractionCanvas.height = videoHeight;
  extractionCtx ??= extractionCanvas.getContext('2d', { willReadFrequently: true });
  if (!extractionCtx) return;

  let lastBlue: StaffPose3D | null = null;
  let lastRed: StaffPose3D | null = null;

  for (let i = 0; i < total; i++) {
    videoElement.currentTime = (i * dt) / 1000;
    await waitForSeek(videoElement);
    extractionCtx.drawImage(videoElement, 0, 0);
    const frame = extractionCtx.getImageData(0, 0, videoWidth, videoHeight);

    const markers = tracker.detect(frame);
    const center = markers.find((m) => m.id === assignment.centerRefId);
    const blue = markers.find((m) => m.id === assignment.blueId);
    const red = markers.find((m) => m.id === assignment.redId);

    if (center && blue) {
      const g = GridFrameSolver.gridFromCamera(center);
      lastBlue = GridFrameSolver.solve(blue, g);
      blueConf.push(1);
    } else { blueConf.push(0); }
    if (center && red) {
      const g = GridFrameSolver.gridFromCamera(center);
      lastRed = GridFrameSolver.solve(red, g);
      redConf.push(0.0 + (red ? 1 : 0));
    } else { redConf.push(0); }

    // Hold last good pose through short dropouts (the segmenter interpolates).
    if (lastBlue) blueFrames.push(lastBlue);
    if (lastRed) redFrames.push(lastRed);
  }

  const beats = framesToNotation(blueFrames, redFrames, blueConf, redConf);
  notationPictographs = beats.map((b, i) => notationToPictographData(b.blue, b.red, `beat-${i}`));
}
```

Add a "Notate Flow" button in the review phase that calls `runNotation()`, and a strip below the stats panel:

```svelte
{#if notationPictographs.length > 0}
  <div class="notation-strip">
    {#each notationPictographs as pd (pd.id)}
      <div class="notation-cell">
        <PictographContainer pictographData={pd} disableTransitions />
      </div>
    {/each}
  </div>
{/if}
```

```css
.notation-strip {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem;
  background: var(--theme-card-bg);
  border-radius: 8px;
}
.notation-cell {
  flex: 0 0 auto;
  width: 120px;
  aspect-ratio: 1;
}
```

- [ ] **Step 6: Typecheck the changed surface**

Run: `npm run check > /tmp/notation-check.log 2>&1; grep -niE "prop-tracking-lab|notation" /tmp/notation-check.log`
Expected: no errors referencing the new files. Fix any that appear (most likely enum member-name mismatches in `notation-to-pictograph.ts` — reconcile against `grid-enums.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/train/prop-tracking-lab/services/notation-pipeline.ts \
        src/lib/features/train/prop-tracking-lab/services/notation-pipeline.test.ts \
        src/lib/features/train/prop-tracking-lab/components/PropTrackingLab.svelte
git commit -m "feat(notation): pipeline orchestrator + lab UI (notate flow + render strip)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Integration verification on a real clip + final pass

**Files:**
- Modify (if needed by integration findings): classifier/segmenter configs.

- [ ] **Step 1: Generate printable markers**

Use the vendored dictionary to emit three `ARUCO_MIP_36h12` markers (ids = `DEFAULT_MARKER_ASSIGNMENT`: 0 center-ref, 1 blue, 2 red) as SVG via `AR.Dictionary(...).generateSVG(id)`. Add a dev-only "Download Markers" affordance, or generate them in a scratch node script. Print at the configured `markerSizeMm` (80 mm). Fix the center-ref marker flat at grid center; attach blue/red markers near each staff grip.

- [ ] **Step 2: Capture a short known clip**

One phone, static framing, whole performer + both staves in view, fast shutter, good light. Perform a SHORT sequence whose TKA notation you know (e.g. a 2-beat: both staves static at alpha, then a single pro shift). Keep it to a few beats.

- [ ] **Step 3: Run the lab end-to-end**

Load the clip in the Prop Tracking Lab, draw/confirm framing, run "Notate Flow", and compare the rendered pictograph strip against the performed sequence. Capture: which beats matched (position, orientation, motion type, turns) and which didn't.

- [ ] **Step 4: Tune from evidence, not assumption**

If positions are right but orientation flips, re-check the marker shaft-axis convention (local +Y = marked tip) and `radialDotThreshold`. If beats over/under-segment, tune `motionThreshold`/`minHeldFrames`. If pro/anti invert, re-verify the arc-sign convention against `accumulateBetween`. Make each change, re-run the relevant unit test, then re-run the clip.

- [ ] **Step 5: Full check + test sweep**

```bash
npx vitest run --config tests/config/vitest.config.ts src/lib/features/train/prop-tracking-lab
npm run check > /tmp/notation-final-check.log 2>&1; grep -niE "error|prop-tracking-lab" /tmp/notation-final-check.log
```
Expected: all prop-tracking-lab tests green; no new check errors in the feature.

- [ ] **Step 6: Report results with evidence**

Per verification protocol: report the side-by-side (source clip vs rendered strip) and the per-beat match table. State explicitly what classified correctly and what needs the next iteration. Do not claim "works" without the comparison evidence.

- [ ] **Step 7: Commit any tuning**

```bash
git add src/lib/features/train/prop-tracking-lab
git commit -m "chore(notation): tune segmenter/classifier from real-clip integration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- ArucoStaffTracker (swap SimplePropTracker) → Task 9. ✓
- GridFrameSolver (center-ref → grid frame, StaffPose3D w/ roll) → Task 2. ✓
- TkaPoseClassifier (grid position, orientation radial/nonradial+in/out, motion type, turns; MCP-grounded) → Tasks 3-6, each with an MCP-grounding note. ✓
- Beat segmenter reusing the lab's keyframe/held-span model → Task 7. ✓
- Emit + render via existing PictographRenderer → Tasks 8 (bridge) + 10 (PictographContainer in UI). ✓
- js-aruco2 dependency, license verified → Task 9 (MIT core + BSD ArUco confirmed). ✓
- Capture protocol (markers, center-ref, one phone) → Task 11. ✓
- Error handling (dropout interpolation, confidence per beat, ref-marker visibility) → Task 10 (hold-last-pose through dropouts; confidence arrays) + Task 11 (tuning). ✓
- Out-of-scope deferrals (markerless, body, 2-phone, canonical export) honored — no tasks add them. ✓

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Each code step shows full code; each test step shows full assertions. ✓

**3. Type consistency:**
- `StaffPose3D` = `{ gripPos, axisDir, rollRad }` consistent across Tasks 1, 2, 6, 7, 10. ✓
- `StaffMotionNotation` fields consistent across Tasks 1, 6, 8. ✓
- `DetectedMarker` = `{ id, posCam, rotCam(9, row-major), corners }` consistent across Tasks 1, 2, 9. ✓
- `classifyMotion(staff, start, end, arcAngle, propNetRotation, confidence)` signature consistent Tasks 6, 10. ✓
- `accumulateBetween(frames, from, to)` → `{ arcAngle, propNetRotation }` consistent Tasks 7, 10. ✓
- Two distinct angle conventions explicitly separated (location bucketing = `atan2(x,y)` CW-from-North; arc accumulation = `atan2(y,x)` CCW math) — flagged in Tasks 3 and 7 to prevent a sign bug. ✓

**Open implementation checks the executor must do (not gaps, but verify-against-source):** (a) `GridLocation`/`GridMode` enum member names in `grid-enums.ts` (Task 8 notes this); (b) js-aruco2 export style — globals vs ESM — adapt the single wrapper file (Task 9 notes this); (c) `ImageData` availability under the vitest env (Task 9 notes the jsdom directive).
