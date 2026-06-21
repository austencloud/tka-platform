# Spatial Lab 3D Pivot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2D SVG canvas in the Spatial Lab with the existing 3D avatar scene (Scene3D + Avatar3D + Prop3D), with camera presets for wall/wheel/floor views and drag-to-reposition props.

**Architecture:** SpatialScene.svelte wraps Scene3D with drag state machine. State stores GridLocation enums, derives PropState3D via plane-coordinate-mapper. Analysis services still receive 2D projections. SVG canvas and all canvas/* components deleted.

**Tech Stack:** Svelte 5, Threlte, Three.js, @austencloud/scene-3d (Avatar3D, Prop3D, PropState3D, Plane)

---

## File Structure

**Create:**
- `src/lib/features/lab/tabs/spatial-lab/components/SpatialScene.svelte` — Scene3D wrapper + drag interaction
- `src/lib/features/lab/tabs/spatial-lab/services/grid-snap.ts` — find nearest GridLocation from 3D point
- `tests/unit/spatial-lab/grid-snap.test.ts` — grid snap tests

**Modify:**
- `src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-state.svelte.ts` — GridLocation-based state + PropState3D deriveds
- `src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-constants.ts` — presets use GridLocation
- `src/lib/features/lab/tabs/spatial-lab/services/demo-sequences.ts` — beats use GridLocation
- `src/lib/features/lab/tabs/spatial-lab/SpatialLab.svelte` — swap SpatialCanvas → SpatialScene
- `src/lib/features/lab/tabs/spatial-lab/components/SpatialControls.svelte` — remove SpatialCanvas import
- `src/lib/features/lab/tabs/spatial-lab/components/controls/ViewSwitcher.svelte` — map to camera presets
- `src/lib/features/lab/tabs/spatial-lab/components/controls/VisualizationToggles.svelte` — grid/stage toggles
- `src/lib/features/lab/tabs/spatial-lab/components/controls/InfoPanel.svelte` — remove SVG-specific grid lookup
- `src/lib/features/lab/tabs/spatial-lab/components/controls/PresetGrid.svelte` — GridLocation presets

**Delete:**
- `src/lib/features/lab/tabs/spatial-lab/components/SpatialCanvas.svelte`
- `src/lib/features/lab/tabs/spatial-lab/components/canvas/PropMarker.svelte`
- `src/lib/features/lab/tabs/spatial-lab/components/canvas/ArmLine.svelte`
- `src/lib/features/lab/tabs/spatial-lab/components/canvas/ReachEnvelope.svelte`
- `src/lib/features/lab/tabs/spatial-lab/components/canvas/CrossingIndicator.svelte`
- `src/lib/features/lab/tabs/spatial-lab/components/canvas/BodyDiagram.svelte`
- `src/lib/features/lab/tabs/spatial-lab/components/canvas/PlaneLines.svelte`

**Keep unchanged:**
- All 7 services in `services/` (body-rotation-solver, reach-calculator, crossing-detector, plane-split-detector, reachability-taxonomy, projection — grid-snap is new)
- All 7 test files (55 tests)
- `SpatialStatusBar.svelte`, `BeatTransport.svelte`, `SequenceSelector.svelte`

---

### Task 1: Grid snap service + tests

**Files:**
- Create: `src/lib/features/lab/tabs/spatial-lab/services/grid-snap.ts`
- Create: `tests/unit/spatial-lab/grid-snap.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/spatial-lab/grid-snap.test.ts
import { describe, it, expect } from "vitest";
import { snapToNearestGridLocation } from "../../../src/lib/features/lab/tabs/spatial-lab/services/grid-snap";
import { GridLocation } from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Plane } from "@austencloud/scene-3d";
import { Vector3 } from "three";

describe("grid-snap", () => {
  it("snaps a point near EAST to GridLocation.EAST", () => {
    const point = new Vector3(0.45, 0, 0.05);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.EAST);
  });

  it("snaps a point near WEST to GridLocation.WEST", () => {
    const point = new Vector3(-0.45, 0, -0.05);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.WEST);
  });

  it("snaps a point near NORTH to GridLocation.NORTH", () => {
    const point = new Vector3(0, 0.4, 0);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.NORTH);
  });

  it("snaps a point near SOUTH to GridLocation.SOUTH", () => {
    const point = new Vector3(0, -0.4, 0);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.SOUTH);
  });

  it("snaps to intercardinal locations (NORTHEAST)", () => {
    const point = new Vector3(0.3, 0.3, 0);
    const result = snapToNearestGridLocation(point, Plane.WALL);
    expect(result).toBe(GridLocation.NORTHEAST);
  });

  it("works on WHEEL plane", () => {
    const point = new Vector3(0, 0.4, 0.05);
    const result = snapToNearestGridLocation(point, Plane.WHEEL);
    expect(result).toBe(GridLocation.NORTH);
  });

  it("works on FLOOR plane", () => {
    const point = new Vector3(0.45, 0, 0.05);
    const result = snapToNearestGridLocation(point, Plane.FLOOR);
    expect(result).toBe(GridLocation.EAST);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/spatial-lab/grid-snap.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/features/lab/tabs/spatial-lab/services/grid-snap.ts
import type { Vector3 } from "three";
import type { Plane } from "@austencloud/scene-3d";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getAllGridPositions } from "$lib/shared/3d/services/plane-coordinate-mapper";

const ALL_LOCATIONS: GridLocation[] = [
  GridLocation.NORTH,
  GridLocation.NORTHEAST,
  GridLocation.EAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTH,
  GridLocation.SOUTHWEST,
  GridLocation.WEST,
  GridLocation.NORTHWEST,
];

export function snapToNearestGridLocation(
  point: Vector3,
  plane: Plane,
): GridLocation {
  const positions = getAllGridPositions(plane);
  let best = GridLocation.EAST;
  let bestDist = Infinity;

  for (const loc of ALL_LOCATIONS) {
    const pos = positions.get(loc);
    if (!pos) continue;
    const d = point.distanceTo(pos);
    if (d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }

  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/spatial-lab/grid-snap.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/services/grid-snap.ts tests/unit/spatial-lab/grid-snap.test.ts
git commit -m "feat(spatial-lab): add grid snap service for 3D→GridLocation snapping"
```

---

### Task 2: Migrate demo sequences to GridLocation

**Files:**
- Modify: `src/lib/features/lab/tabs/spatial-lab/services/demo-sequences.ts`
- Modify: `tests/unit/spatial-lab/sequence-mode.test.ts`

- [ ] **Step 1: Rewrite demo-sequences.ts with GridLocation beats**

```typescript
// src/lib/features/lab/tabs/spatial-lab/services/demo-sequences.ts
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Plane } from "@austencloud/scene-3d";

export interface SequenceBeat {
  left: GridLocation;
  right: GridLocation;
  plane?: Plane;
  label?: string;
}

export interface DemoSequence {
  name: string;
  description: string;
  beats: SequenceBeat[];
}

export const DEMO_SEQUENCES: DemoSequence[] = [
  {
    name: "Mirror Sweep",
    description: "Symmetric east-west sweep — no body turn needed",
    beats: [
      { left: GridLocation.WEST, right: GridLocation.EAST, label: "L:W R:E" },
      { left: GridLocation.NORTHWEST, right: GridLocation.NORTHEAST, label: "L:NW R:NE" },
      { left: GridLocation.NORTH, right: GridLocation.NORTH, label: "Both N" },
      { left: GridLocation.NORTHEAST, right: GridLocation.NORTHWEST, label: "L:NE R:NW" },
      { left: GridLocation.EAST, right: GridLocation.WEST, label: "L:E R:W" },
      { left: GridLocation.SOUTHEAST, right: GridLocation.SOUTHWEST, label: "L:SE R:SW" },
      { left: GridLocation.SOUTH, right: GridLocation.SOUTH, label: "Both S" },
      { left: GridLocation.SOUTHWEST, right: GridLocation.SOUTHEAST, label: "L:SW R:SE" },
    ],
  },
  {
    name: "Crossing",
    description: "Arms cross center — crossing detector fires",
    beats: [
      { left: GridLocation.WEST, right: GridLocation.EAST, label: "L:W R:E" },
      { left: GridLocation.SOUTHWEST, right: GridLocation.SOUTHEAST, label: "Inward" },
      { left: GridLocation.SOUTH, right: GridLocation.SOUTH, label: "Both S — close" },
      { left: GridLocation.EAST, right: GridLocation.WEST, label: "Crossed! L:E R:W" },
      { left: GridLocation.NORTHEAST, right: GridLocation.NORTHWEST, label: "Still crossed" },
      { left: GridLocation.WEST, right: GridLocation.EAST, label: "Back to start" },
    ],
  },
  {
    name: "Body Turn 90°",
    description: "Both props shift east — body auto-turns to face stage-right",
    beats: [
      { left: GridLocation.WEST, right: GridLocation.EAST, label: "L:W R:E (neutral)" },
      { left: GridLocation.SOUTH, right: GridLocation.EAST, label: "L moves S" },
      { left: GridLocation.SOUTHEAST, right: GridLocation.NORTHEAST, label: "Both E side" },
      { left: GridLocation.EAST, right: GridLocation.EAST, label: "Both E" },
      { left: GridLocation.SOUTHEAST, right: GridLocation.NORTHEAST, label: "Returning" },
      { left: GridLocation.WEST, right: GridLocation.EAST, label: "Back to neutral" },
    ],
  },
  {
    name: "Height Sweep",
    description: "Props sweep north-south — visible body reaction",
    beats: [
      { left: GridLocation.SOUTHWEST, right: GridLocation.SOUTHEAST, label: "Both low" },
      { left: GridLocation.WEST, right: GridLocation.EAST, label: "Both mid" },
      { left: GridLocation.NORTHWEST, right: GridLocation.NORTHEAST, label: "Both high" },
      { left: GridLocation.NORTH, right: GridLocation.NORTH, label: "Both top" },
      { left: GridLocation.NORTHWEST, right: GridLocation.NORTHEAST, label: "Descending" },
      { left: GridLocation.WEST, right: GridLocation.EAST, label: "Back to mid" },
    ],
  },
  {
    name: "Full Rotation",
    description: "Left prop circles the grid — body tracks it",
    beats: [
      { left: GridLocation.EAST, right: GridLocation.WEST, label: "Start: L:E R:W" },
      { left: GridLocation.NORTHEAST, right: GridLocation.WEST, label: "L → NE" },
      { left: GridLocation.NORTH, right: GridLocation.WEST, label: "L → N" },
      { left: GridLocation.NORTHWEST, right: GridLocation.WEST, label: "L → NW" },
      { left: GridLocation.WEST, right: GridLocation.WEST, label: "L → W (same!)" },
      { left: GridLocation.SOUTHWEST, right: GridLocation.WEST, label: "L → SW" },
      { left: GridLocation.SOUTH, right: GridLocation.WEST, label: "L → S" },
      { left: GridLocation.SOUTHEAST, right: GridLocation.WEST, label: "L → SE" },
    ],
  },
];
```

- [ ] **Step 2: Update sequence-mode tests**

```typescript
// tests/unit/spatial-lab/sequence-mode.test.ts
import { describe, it, expect } from "vitest";
import { DEMO_SEQUENCES } from "../../../src/lib/features/lab/tabs/spatial-lab/services/demo-sequences";
import { GridLocation } from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("demo-sequences", () => {
  it("has at least 3 sequences", () => {
    expect(DEMO_SEQUENCES.length).toBeGreaterThanOrEqual(3);
  });

  it("every sequence has 2+ beats with valid GridLocation values", () => {
    const validLocations = new Set(Object.values(GridLocation));
    for (const seq of DEMO_SEQUENCES) {
      expect(seq.beats.length).toBeGreaterThanOrEqual(2);
      for (const beat of seq.beats) {
        expect(validLocations.has(beat.left)).toBe(true);
        expect(validLocations.has(beat.right)).toBe(true);
      }
    }
  });

  it("every sequence has a name and description", () => {
    for (const seq of DEMO_SEQUENCES) {
      expect(seq.name.length).toBeGreaterThan(0);
      expect(seq.description.length).toBeGreaterThan(0);
    }
  });

  it("crossing sequence has beats where arms swap sides", () => {
    const crossing = DEMO_SEQUENCES.find((s) => s.name === "Crossing");
    expect(crossing).toBeDefined();
    const hasSwap = crossing!.beats.some(
      (b) => b.left === GridLocation.EAST && b.right === GridLocation.WEST,
    );
    expect(hasSwap).toBe(true);
  });

  it("height sweep has beats with N and S locations", () => {
    const heightSweep = DEMO_SEQUENCES.find((s) => s.name === "Height Sweep");
    expect(heightSweep).toBeDefined();
    const hasNorth = heightSweep!.beats.some(
      (b) => b.left === GridLocation.NORTH || b.right === GridLocation.NORTH,
    );
    expect(hasNorth).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/spatial-lab/sequence-mode.test.ts`
Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/services/demo-sequences.ts tests/unit/spatial-lab/sequence-mode.test.ts
git commit -m "refactor(spatial-lab): migrate demo sequences from Point3D to GridLocation"
```

---

### Task 3: Rewrite state + constants for GridLocation + PropState3D

**Files:**
- Modify: `src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-constants.ts`
- Modify: `src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-state.svelte.ts`

- [ ] **Step 1: Rewrite spatial-lab-constants.ts**

```typescript
// src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-constants.ts
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Plane } from "@austencloud/scene-3d";

export const BODY_CENTER = { x: 300, y: 330 } as const;
export const SHOULDER_DIST = 34;
export const MAX_REACH = 165;
export const BEHIND_THRESHOLD = 30;
export const MAX_ROTATION_SPEED = 3;

export interface Preset {
  name: string;
  left: GridLocation;
  right: GridLocation;
}

export const PRESETS: Preset[] = [
  { name: "L:W R:E",      left: GridLocation.WEST,      right: GridLocation.EAST },
  { name: "L:E R:W",      left: GridLocation.EAST,      right: GridLocation.WEST },
  { name: "Both E",       left: GridLocation.EAST,      right: GridLocation.EAST },
  { name: "Both W",       left: GridLocation.WEST,      right: GridLocation.WEST },
  { name: "Both N",       left: GridLocation.NORTH,     right: GridLocation.NORTH },
  { name: "Both S",       left: GridLocation.SOUTH,     right: GridLocation.SOUTH },
  { name: "L:NW R:NE",    left: GridLocation.NORTHWEST, right: GridLocation.NORTHEAST },
  { name: "L:SW R:SE",    left: GridLocation.SOUTHWEST, right: GridLocation.SOUTHEAST },
];

export const VIEW_TO_CAMERA: Record<string, "front" | "top" | "side"> = {
  wall: "front",
  wheel: "side",
  floor: "top",
};

export const VIEW_TO_PLANE: Record<string, Plane> = {
  wall: Plane.WALL,
  wheel: Plane.WHEEL,
  floor: Plane.FLOOR,
};
```

- [ ] **Step 2: Rewrite spatial-lab-state.svelte.ts**

```typescript
// src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-state.svelte.ts
import {
  computeTargetRotation,
  stepRotation,
  type Point2D,
} from "../services/body-rotation-solver";
import { getShoulderPosition, computeReachPercentage } from "../services/reach-calculator";
import { detectCrossing } from "../services/crossing-detector";
import { detectPlaneSplit } from "../services/plane-split-detector";
import { project3Dto2D, type ViewProjection } from "../services/projection";
import {
  BODY_CENTER,
  SHOULDER_DIST,
  MAX_REACH,
  BEHIND_THRESHOLD,
  MAX_ROTATION_SPEED,
  VIEW_TO_CAMERA,
  VIEW_TO_PLANE,
  type Preset,
} from "./spatial-lab-constants";
import { DEMO_SEQUENCES, type DemoSequence, type SequenceBeat } from "../services/demo-sequences";
import { diagnoseReachability, type ReachabilityDiagnosis } from "../services/reachability-taxonomy";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Plane } from "@austencloud/scene-3d";
import type { PropState3D } from "@austencloud/scene-3d";
import { LOCATION_ANGLES } from "$lib/shared/foundation/domain/math-constants";
import {
  gridLocationToPosition3D,
  calculatePropRotation,
} from "$lib/shared/3d/services/plane-coordinate-mapper";

export type LabMode = "sandbox" | "sequence";

function makePropState(location: GridLocation, plane: Plane): PropState3D {
  const angle = LOCATION_ANGLES[location] ?? 0;
  return {
    centerPathAngle: angle,
    staffRotationAngle: 0,
    plane,
    worldPosition: gridLocationToPosition3D(plane, location),
    worldRotation: calculatePropRotation(plane, 0),
  };
}

export class SpatialLabState {
  leftLocation = $state<GridLocation>(GridLocation.WEST);
  rightLocation = $state<GridLocation>(GridLocation.EAST);
  activePlane = $state<Plane>(Plane.WALL);
  bodyRotation = $state(0);
  bodyLocked = $state(false);
  showGrid = $state(true);
  showStage = $state(true);
  showLabels = $state(false);
  viewProjection = $state<ViewProjection>("wall");

  // Sequence mode
  mode = $state<LabMode>("sandbox");
  activeSequence = $state<DemoSequence | null>(null);
  beatIndex = $state(0);
  playing = $state(false);
  playbackBpm = $state(60);
  private _playElapsed = 0;

  // Drag state
  draggingSide = $state<"blue" | "red" | null>(null);

  private _targetRotation = 0;

  // PropState3D deriveds for Scene3D
  bluePropState: PropState3D = $derived(makePropState(this.leftLocation, this.activePlane));
  redPropState: PropState3D = $derived(makePropState(this.rightLocation, this.activePlane));

  // Camera preset derived from view
  cameraPreset = $derived(VIEW_TO_CAMERA[this.viewProjection] ?? "front");

  // Visible planes derived from view
  visiblePlanes = $derived(new Set([VIEW_TO_PLANE[this.viewProjection] ?? Plane.WALL]));

  // 2D projections for analysis engine (bridge between 3D and analysis services)
  private leftPos3D = $derived(this.bluePropState.worldPosition);
  private rightPos3D = $derived(this.redPropState.worldPosition);

  private leftProp2D: Point2D = $derived({
    x: BODY_CENTER.x + this.leftPos3D.x * 160,
    y: BODY_CENTER.y - this.leftPos3D.y * 160,
  });

  private rightProp2D: Point2D = $derived({
    x: BODY_CENTER.x + this.rightPos3D.x * 160,
    y: BODY_CENTER.y - this.rightPos3D.y * 160,
  });

  // Floor projections for body rotation (always bird's eye)
  private leftPropFloor: Point2D = $derived({
    x: BODY_CENTER.x + this.leftPos3D.x * 160,
    y: BODY_CENTER.y + this.leftPos3D.z * 160,
  });

  private rightPropFloor: Point2D = $derived({
    x: BODY_CENTER.x + this.rightPos3D.x * 160,
    y: BODY_CENTER.y + this.rightPos3D.z * 160,
  });

  leftShoulder = $derived(
    getShoulderPosition("left", this.bodyRotation, BODY_CENTER, SHOULDER_DIST),
  );

  rightShoulder = $derived(
    getShoulderPosition("right", this.bodyRotation, BODY_CENTER, SHOULDER_DIST),
  );

  planeSplitActive = $derived(
    detectPlaneSplit(this.leftPropFloor.y, this.rightPropFloor.y, BODY_CENTER.y, BEHIND_THRESHOLD),
  );

  crossing = $derived(
    detectCrossing(this.leftShoulder, this.leftProp2D, this.rightShoulder, this.rightProp2D),
  );

  leftReachPct = $derived(
    computeReachPercentage(this.leftShoulder, this.leftProp2D, MAX_REACH),
  );

  rightReachPct = $derived(
    computeReachPercentage(this.rightShoulder, this.rightProp2D, MAX_REACH),
  );

  leftReachable = $derived(this.leftReachPct <= 100);
  rightReachable = $derived(this.rightReachPct <= 100);

  leftDiagnosis: ReachabilityDiagnosis = $derived(
    diagnoseReachability(
      "left", this.leftProp2D, this.leftShoulder, this.rightShoulder,
      this.rightProp2D, BODY_CENTER, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    ),
  );

  rightDiagnosis: ReachabilityDiagnosis = $derived(
    diagnoseReachability(
      "right", this.rightProp2D, this.rightShoulder, this.leftShoulder,
      this.leftProp2D, BODY_CENTER, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    ),
  );

  // Avatar facing angle (degrees → radians for Avatar3D)
  facingAngle = $derived(this.bodyRotation * (Math.PI / 180));

  toggleBodyLock(): void {
    this.bodyLocked = !this.bodyLocked;
  }

  setView(view: ViewProjection): void {
    this.viewProjection = view;
    this.activePlane = VIEW_TO_PLANE[view] ?? Plane.WALL;
  }

  setLocation(side: "blue" | "red", location: GridLocation): void {
    if (side === "blue") this.leftLocation = location;
    else this.rightLocation = location;
  }

  applyPreset(preset: Preset): void {
    this.bodyLocked = false;
    this.leftLocation = preset.left;
    this.rightLocation = preset.right;
    this._syncBodyRotation();
  }

  // Sequence mode
  readonly demoSequences = DEMO_SEQUENCES;

  currentBeat = $derived<SequenceBeat | null>(
    this.activeSequence ? this.activeSequence.beats[this.beatIndex] ?? null : null,
  );

  totalBeats = $derived(this.activeSequence?.beats.length ?? 0);

  loadSequence(seq: DemoSequence): void {
    this.mode = "sequence";
    this.activeSequence = seq;
    this.beatIndex = 0;
    this.playing = false;
    this._playElapsed = 0;
    this.bodyLocked = false;
    const first = seq.beats[0];
    if (first) this._applyBeat(first);
  }

  exitSequenceMode(): void {
    this.mode = "sandbox";
    this.activeSequence = null;
    this.playing = false;
    this.beatIndex = 0;
    this._playElapsed = 0;
  }

  setBeat(index: number): void {
    if (!this.activeSequence) return;
    const clamped = Math.max(0, Math.min(index, this.activeSequence.beats.length - 1));
    this.beatIndex = clamped;
    this._playElapsed = 0;
    const beat = this.activeSequence.beats[clamped];
    if (beat) this._applyBeat(beat);
  }

  togglePlayback(): void {
    this.playing = !this.playing;
    this._playElapsed = 0;
  }

  private _applyBeat(beat: SequenceBeat): void {
    this.leftLocation = beat.left;
    this.rightLocation = beat.right;
    if (beat.plane) this.activePlane = beat.plane;
    this._syncBodyRotation();
  }

  private _syncBodyRotation(): void {
    this._targetRotation =
      computeTargetRotation(this.leftPropFloor, this.rightPropFloor, BODY_CENTER, BEHIND_THRESHOLD) ??
      this.bodyRotation;
    this.bodyRotation = this._targetRotation;
  }

  tick(): void {
    if (this.playing && this.activeSequence) {
      this._playElapsed++;
      const framesPerBeat = Math.round(60 / (this.playbackBpm / 60));
      if (this._playElapsed >= framesPerBeat) {
        this._playElapsed = 0;
        const next = (this.beatIndex + 1) % this.activeSequence.beats.length;
        this.beatIndex = next;
        const nextBeat = this.activeSequence.beats[next];
        if (nextBeat) this._applyBeat(nextBeat);
      }
    }

    if (this.bodyLocked) return;

    const target = computeTargetRotation(
      this.leftPropFloor,
      this.rightPropFloor,
      BODY_CENTER,
      BEHIND_THRESHOLD,
    );

    if (target !== null) {
      this._targetRotation = target;
    }

    this.bodyRotation = stepRotation(
      this.bodyRotation,
      this._targetRotation,
      MAX_ROTATION_SPEED,
    );
  }
}

export function createSpatialLabState(): SpatialLabState {
  return new SpatialLabState();
}
```

- [ ] **Step 3: Run typecheck + tests**

Run: `npm run check && npx vitest run tests/unit/spatial-lab/`
Expected: 0 errors (some tests may fail due to changed interfaces — fix in Task 2)

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-constants.ts src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-state.svelte.ts
git commit -m "refactor(spatial-lab): rewrite state for GridLocation + PropState3D"
```

---

### Task 4: Create SpatialScene.svelte (Scene3D wrapper + drag)

**Files:**
- Create: `src/lib/features/lab/tabs/spatial-lab/components/SpatialScene.svelte`

- [ ] **Step 1: Write the component**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/SpatialScene.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SpatialLabState } from "../state/spatial-lab-state.svelte";
  import Scene3D from "$lib/shared/3d/components/Scene3D.svelte";
  import { Avatar3D, Prop3D } from "@austencloud/scene-3d";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { snapToNearestGridLocation } from "../services/grid-snap";
  import { Vector3 } from "three";

  interface Props {
    state: SpatialLabState;
  }

  let { state: labState }: Props = $props();
  let rafId: number;

  function handleMeshClick(meshName: string, point: { x: number; y: number; z: number }) {
    if (labState.mode === "sequence") return;
    const lcName = meshName.toLowerCase();
    if (lcName.includes("blue") || lcName.includes("staff_blue") || lcName.includes("prop_blue")) {
      labState.draggingSide = "blue";
    } else if (lcName.includes("red") || lcName.includes("staff_red") || lcName.includes("prop_red")) {
      labState.draggingSide = "red";
    }
  }

  function handleDrag(position: { x: number; z: number }) {
    if (!labState.draggingSide) return;
    const dragPoint = new Vector3(position.x, 0, position.z);
    const nearest = snapToNearestGridLocation(dragPoint, labState.activePlane);
    labState.setLocation(labState.draggingSide, nearest);
  }

  function handlePointerUp() {
    labState.draggingSide = null;
  }

  function tick() {
    labState.tick();
    rafId = requestAnimationFrame(tick);
  }

  onMount(() => { rafId = requestAnimationFrame(tick); });
  onDestroy(() => { cancelAnimationFrame(rafId); });
</script>

<div class="scene-container">
  <Scene3D
    cameraPreset={labState.cameraPreset}
    showGrid={labState.showGrid}
    showLabels={labState.showLabels}
    showStage={labState.showStage}
    visiblePlanes={labState.visiblePlanes}
    disableOrbitControls={labState.draggingSide !== null}
    isDragging={labState.draggingSide !== null}
    onMeshClick={handleMeshClick}
    onDrag={handleDrag}
    onPointerUp={handlePointerUp}
  >
    {#snippet children()}
      <Prop3D
        propType={PropType.STAFF}
        propState={labState.bluePropState}
        color="blue"
      />
      <Prop3D
        propType={PropType.STAFF}
        propState={labState.redPropState}
        color="red"
      />
      <Avatar3D
        bluePropState={labState.bluePropState}
        redPropState={labState.redPropState}
        position={{ x: 0, y: 0, z: 0 }}
        facingAngle={labState.facingAngle}
      />
    {/snippet}
  </Scene3D>
</div>

<style>
  .scene-container {
    flex: 1;
    min-width: 0;
    min-height: 300px;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: 0 errors (warnings OK)

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/components/SpatialScene.svelte
git commit -m "feat(spatial-lab): add SpatialScene with Scene3D + drag interaction"
```

---

### Task 5: Delete SVG components + wire SpatialScene into SpatialLab

**Files:**
- Delete: `src/lib/features/lab/tabs/spatial-lab/components/SpatialCanvas.svelte`
- Delete: `src/lib/features/lab/tabs/spatial-lab/components/canvas/` (entire directory — 6 files)
- Modify: `src/lib/features/lab/tabs/spatial-lab/SpatialLab.svelte`

- [ ] **Step 1: Delete SVG files**

```bash
rm src/lib/features/lab/tabs/spatial-lab/components/SpatialCanvas.svelte
rm -r src/lib/features/lab/tabs/spatial-lab/components/canvas/
```

- [ ] **Step 2: Update SpatialLab.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/SpatialLab.svelte -->
<script lang="ts">
  import { createSpatialLabState } from "./state/spatial-lab-state.svelte";
  import SpatialScene from "./components/SpatialScene.svelte";
  import SpatialControls from "./components/SpatialControls.svelte";
  import SpatialStatusBar from "./components/SpatialStatusBar.svelte";

  const state = createSpatialLabState();
</script>

<div class="spatial-lab">
  <div class="lab-header">
    <div class="header-left">
      <span class="lab-title">Spatial Lab</span>
      <span class="lab-subtitle">{state.mode === "sequence" ? "Sequence Playback" : "Sandbox Mode"}</span>
    </div>
    <span class="header-hint">Drag props · Click body to lock/unlock · Orbit with mouse</span>
  </div>
  <div class="lab-body">
    <SpatialScene {state} />
    <SpatialControls {state} />
  </div>
  <SpatialStatusBar {state} />
</div>

<style>
  .spatial-lab {
    display: flex; flex-direction: column; height: 100%;
    background: #0d0d1a; color: #e0e0e0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
  .lab-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 20px; background: #12122a; border-bottom: 1px solid #2a2a4a;
  }
  .header-left { display: flex; align-items: baseline; }
  .lab-title { font-size: 16px; font-weight: 600; color: #fff; letter-spacing: 0.5px; }
  .lab-subtitle { font-size: 11px; color: #888; margin-left: 12px; }
  .header-hint { font-size: 10px; color: #666; }
  .lab-body { display: flex; flex: 1; overflow: hidden; }
</style>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/features/lab/tabs/spatial-lab/
git add src/lib/features/lab/tabs/spatial-lab/SpatialLab.svelte
git commit -m "refactor(spatial-lab): replace SVG canvas with Scene3D"
```

---

### Task 6: Update control panel components

**Files:**
- Modify: `src/lib/features/lab/tabs/spatial-lab/components/SpatialControls.svelte`
- Modify: `src/lib/features/lab/tabs/spatial-lab/components/controls/ViewSwitcher.svelte`
- Modify: `src/lib/features/lab/tabs/spatial-lab/components/controls/VisualizationToggles.svelte`
- Modify: `src/lib/features/lab/tabs/spatial-lab/components/controls/InfoPanel.svelte`
- Modify: `src/lib/features/lab/tabs/spatial-lab/components/controls/PresetGrid.svelte`

- [ ] **Step 1: Update SpatialControls.svelte** — remove SpatialCanvas import, keep all control wiring

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/SpatialControls.svelte -->
<script lang="ts">
  import type { SpatialLabState } from "../state/spatial-lab-state.svelte";
  import ViewSwitcher from "./controls/ViewSwitcher.svelte";
  import VisualizationToggles from "./controls/VisualizationToggles.svelte";
  import InfoPanel from "./controls/InfoPanel.svelte";
  import PresetGrid from "./controls/PresetGrid.svelte";
  import SequenceSelector from "./controls/SequenceSelector.svelte";
  import BeatTransport from "./controls/BeatTransport.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state: labState }: Props = $props();
</script>

<div class="side-panel">
  <ViewSwitcher active={labState.viewProjection} onchange={(v) => labState.setView(v)} />
  <VisualizationToggles state={labState} />
  <div class="divider"></div>
  <InfoPanel state={labState} />
  <div class="divider"></div>
  <SequenceSelector state={labState} />
  <BeatTransport state={labState} />
  {#if labState.mode === "sandbox"}
    <div class="divider"></div>
    <PresetGrid state={labState} />
  {/if}
</div>

<style>
  .side-panel {
    width: 260px; background: #12122a; border-left: 1px solid #2a2a4a;
    padding: 16px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto;
  }
  .divider { height: 1px; background: #2a2a4a; margin: 2px 0; }
</style>
```

- [ ] **Step 2: Update VisualizationToggles.svelte** — toggle grid/stage/labels instead of arm lines/reach envelopes

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/controls/VisualizationToggles.svelte -->
<script lang="ts">
  import type { SpatialLabState } from "../../state/spatial-lab-state.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state: labState }: Props = $props();

  const toggles = [
    { key: "showGrid" as const, label: "Grid planes" },
    { key: "showStage" as const, label: "Stage" },
    { key: "showLabels" as const, label: "Grid labels" },
  ];
</script>

<div class="panel-section">
  <span class="panel-label">Visualization</span>
  {#each toggles as t}
    <div class="toggle-row">
      <span class="toggle-label">{t.label}</span>
      <button
        class="toggle-btn"
        class:on={labState[t.key]}
        aria-pressed={labState[t.key]}
        aria-label={t.label}
        onclick={() => { labState[t.key] = !labState[t.key]; }}
      ></button>
    </div>
  {/each}
</div>

<style>
  .panel-section { display: flex; flex-direction: column; gap: 8px; }
  .panel-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px;
    color: #666; font-weight: 600;
  }
  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; }
  .toggle-label { font-size: 12px; color: #ccc; }
  .toggle-btn {
    width: 36px; height: 20px; border-radius: 10px; border: none; cursor: pointer;
    position: relative; transition: background 0.2s; background: #2a2a4a;
  }
  .toggle-btn.on { background: #4a6aff; }
  .toggle-btn::after {
    content: ''; position: absolute; top: 2px; left: 2px;
    width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.2s;
  }
  .toggle-btn.on::after { transform: translateX(16px); }
</style>
```

- [ ] **Step 3: Update InfoPanel.svelte** — remove SVG grid lookup, show location names directly

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/controls/InfoPanel.svelte -->
<script lang="ts">
  import type { SpatialLabState } from "../../state/spatial-lab-state.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state: labState }: Props = $props();

  const locationLabels: Record<string, string> = {
    n: "North", e: "East", s: "South", w: "West",
    ne: "NE", se: "SE", sw: "SW", nw: "NW",
  };

  function locName(loc: string): string {
    return locationLabels[loc] ?? loc;
  }

  function reachClass(pct: number): string {
    if (pct > 100) return "warn";
    if (pct > 80) return "yellow";
    return "green";
  }

  function rotClass(deg: number): string {
    if (Math.abs(deg) > 45) return "yellow";
    if (Math.abs(deg) > 15) return "";
    return "green";
  }
</script>

<div class="panel-section">
  <span class="panel-label">
    Body
    <span class="badge" class:locked={labState.bodyLocked} class:auto={!labState.bodyLocked}>
      {labState.bodyLocked ? "locked" : "auto"}
    </span>
  </span>
  <div class="info-card">
    <div class="info-row">
      <span class="info-label">Rotation</span>
      <span class="info-value {rotClass(labState.bodyRotation)}">{labState.bodyRotation.toFixed(1)}°</span>
    </div>
    <div class="info-row">
      <span class="info-label">Plane split</span>
      <span class="info-value {labState.planeSplitActive ? 'yellow' : 'green'}">
        {labState.planeSplitActive ? "Yes" : "No"}
      </span>
    </div>
    <div class="info-row">
      <span class="info-label">Arms crossing</span>
      <span class="info-value {labState.crossing ? 'warn' : 'green'}">
        {labState.crossing ? "Yes!" : "No"}
      </span>
    </div>
  </div>
</div>

<div class="panel-section">
  <span class="panel-label">Props</span>
  <div class="info-card">
    <div class="info-row">
      <span class="info-label">Blue (L)</span>
      <span class="info-value blue">{locName(labState.leftLocation)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">L reach</span>
      <span class="info-value {reachClass(labState.leftReachPct)}">{labState.leftReachPct}%</span>
    </div>
    <div class="spacer"></div>
    <div class="info-row">
      <span class="info-label">Red (R)</span>
      <span class="info-value red">{locName(labState.rightLocation)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">R reach</span>
      <span class="info-value {reachClass(labState.rightReachPct)}">{labState.rightReachPct}%</span>
    </div>
  </div>
</div>

{#if !labState.leftDiagnosis.reachable || !labState.rightDiagnosis.reachable}
<div class="panel-section">
  <span class="panel-label">Diagnosis</span>
  <div class="info-card diagnosis">
    {#if !labState.leftDiagnosis.reachable}
      <div class="diag-item">
        <span class="diag-side blue">Blue (L)</span>
        <span class="diag-reasons">{labState.leftDiagnosis.reasons.join(", ")}</span>
        <span class="diag-suggestion">{labState.leftDiagnosis.suggestion}</span>
      </div>
    {/if}
    {#if !labState.rightDiagnosis.reachable}
      <div class="diag-item">
        <span class="diag-side red">Red (R)</span>
        <span class="diag-reasons">{labState.rightDiagnosis.reasons.join(", ")}</span>
        <span class="diag-suggestion">{labState.rightDiagnosis.suggestion}</span>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .panel-section { display: flex; flex-direction: column; gap: 8px; }
  .panel-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px;
    color: #666; font-weight: 600; display: flex; align-items: center;
  }
  .badge {
    display: inline-block; font-size: 8px; text-transform: uppercase; letter-spacing: 0.8px;
    padding: 2px 6px; border-radius: 3px; margin-left: 6px;
  }
  .badge.auto { background: #2a3a2a; color: #4aff8a; }
  .badge.locked { background: #3a2a2a; color: #ff8844; }
  .info-card { padding: 10px 12px; border-radius: 8px; border: 1px solid #2a2a4a; background: #1a1a35; }
  .info-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 12px; }
  .info-label { color: #888; }
  .info-value { color: #fff; font-weight: 500; font-variant-numeric: tabular-nums; }
  .info-value.blue { color: #4a9eff; }
  .info-value.red { color: #ff4a4a; }
  .info-value.green { color: #4aff8a; }
  .info-value.yellow { color: #ffcc00; }
  .info-value.warn { color: #ff6644; }
  .spacer { height: 4px; }
  .diagnosis { border-color: #4a2a2a; background: #1a1520; }
  .diag-item { display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
  .diag-item + .diag-item { border-top: 1px solid #2a2a3a; padding-top: 6px; }
  .diag-side { font-size: 11px; font-weight: 600; }
  .diag-side.blue { color: #4a9eff; }
  .diag-side.red { color: #ff4a4a; }
  .diag-reasons { font-size: 10px; color: #ff8844; }
  .diag-suggestion { font-size: 10px; color: #aaa; font-style: italic; }
</style>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/components/SpatialControls.svelte src/lib/features/lab/tabs/spatial-lab/components/controls/
git commit -m "refactor(spatial-lab): update control panels for 3D scene"
```

---

### Task 7: Fix existing tests + final verification

**Files:**
- Modify: `tests/unit/spatial-lab/projection.test.ts` (may need minor adjustments if projection.ts exports changed)
- Modify: `tests/unit/spatial-lab/reachability-taxonomy.test.ts` (no changes expected)
- Run: all tests + typecheck + build

- [ ] **Step 1: Run all spatial-lab tests**

Run: `npx vitest run tests/unit/spatial-lab/`
Expected: All tests pass. If any fail due to changed imports from demo-sequences.ts, fix them.

- [ ] **Step 2: Run full typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit any test fixes**

```bash
git add tests/unit/spatial-lab/
git commit -m "test(spatial-lab): fix tests for 3D pivot"
```

---

## Self-Review

**Spec coverage:**
- [x] Scene3D replaces SVG canvas (Task 4, 5)
- [x] Camera presets for wall/wheel/floor (Task 3 VIEW_TO_CAMERA, Task 4 cameraPreset prop)
- [x] Prop dragging via raycast (Task 4 handleMeshClick/handleDrag/handlePointerUp)
- [x] Grid snapping (Task 1)
- [x] Demo sequences migrated to GridLocation (Task 2)
- [x] State rewrite with PropState3D deriveds (Task 3)
- [x] SVG files deleted (Task 5)
- [x] Control panels updated (Task 6)
- [x] Analysis engine kept (services untouched)
- [x] Tests pass (Task 7)

**Placeholder scan:** No TBD, TODO, or vague "add handling" steps found.

**Type consistency:** `makePropState(location, plane)` used consistently in state. `snapToNearestGridLocation(point, plane)` signature matches between grid-snap.ts and SpatialScene.svelte. `SequenceBeat.left`/`.right` are `GridLocation` everywhere.
