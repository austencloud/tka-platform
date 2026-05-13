# Spatial Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive bird's-eye SVG diagram tool for exploring body rotation, plane splitting, and arm reachability. Phase 1: sandbox mode with floor view only.

**Architecture:** Standalone lab tab using pure 2D SVG (no Three.js). Svelte 5 reactive state drives an SVG canvas with draggable props, auto body rotation, reach envelopes, and crossing detection. Follows existing Collision Lab patterns for state/context/component structure.

**Tech Stack:** Svelte 5 ($state/$derived), SVG, TypeScript, Vitest

---

### Task 1: Pure Computation Services

**Files:**
- Create: `src/lib/features/lab/tabs/spatial-lab/services/body-rotation-solver.ts`
- Create: `src/lib/features/lab/tabs/spatial-lab/services/reach-calculator.ts`
- Create: `src/lib/features/lab/tabs/spatial-lab/services/crossing-detector.ts`
- Create: `src/lib/features/lab/tabs/spatial-lab/services/plane-split-detector.ts`
- Create: `tests/unit/spatial-lab/body-rotation-solver.test.ts`
- Create: `tests/unit/spatial-lab/reach-calculator.test.ts`
- Create: `tests/unit/spatial-lab/crossing-detector.test.ts`
- Create: `tests/unit/spatial-lab/plane-split-detector.test.ts`

These are pure functions with no Svelte dependency. TDD all four.

- [ ] **Step 1: Write failing tests for body-rotation-solver**

```typescript
// tests/unit/spatial-lab/body-rotation-solver.test.ts
import { describe, it, expect } from "vitest";
import {
  computeTargetRotation,
  stepRotation,
} from "$lib/features/lab/tabs/spatial-lab/services/body-rotation-solver";

describe("computeTargetRotation", () => {
  const body = { x: 300, y: 330 };
  const BEHIND_THRESHOLD = 30;

  it("faces toward single front prop", () => {
    const angle = computeTargetRotation(
      { x: 460, y: 180 },
      { x: 460, y: 180 },
      body,
      BEHIND_THRESHOLD,
    );
    expect(angle).toBeGreaterThan(30);
    expect(angle).toBeLessThan(60);
  });

  it("faces straight ahead when both props centered", () => {
    const angle = computeTargetRotation(
      { x: 290, y: 180 },
      { x: 310, y: 180 },
      body,
      BEHIND_THRESHOLD,
    );
    expect(Math.abs(angle)).toBeLessThan(5);
  });

  it("ignores behind-body props in rotation calculation", () => {
    const angle = computeTargetRotation(
      { x: 460, y: 180 },
      { x: 140, y: 480 },
      body,
      BEHIND_THRESHOLD,
    );
    // Should face toward L at E (right), not average toward center
    expect(angle).toBeGreaterThan(25);
  });

  it("holds current angle when all props behind", () => {
    const angle = computeTargetRotation(
      { x: 140, y: 480 },
      { x: 460, y: 480 },
      body,
      BEHIND_THRESHOLD,
    );
    expect(angle).toBeNull();
  });

  it("clamps to ±90 degrees", () => {
    const angle = computeTargetRotation(
      { x: 520, y: 330 },
      { x: 520, y: 330 },
      body,
      BEHIND_THRESHOLD,
    );
    expect(Math.abs(angle!)).toBeLessThanOrEqual(90);
  });
});

describe("stepRotation", () => {
  it("moves toward target within speed limit", () => {
    const result = stepRotation(0, 45, 3);
    expect(result).toBe(3);
  });

  it("snaps to target when within speed limit", () => {
    const result = stepRotation(44, 45, 3);
    expect(result).toBe(45);
  });

  it("takes shortest path across ±180 boundary", () => {
    const result = stepRotation(178, -178, 3);
    // Should go 178 → 181 (= -179), not 178 → 175
    expect(result).toBeGreaterThan(178);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/spatial-lab/body-rotation-solver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement body-rotation-solver**

```typescript
// src/lib/features/lab/tabs/spatial-lab/services/body-rotation-solver.ts
export interface Point2D {
  x: number;
  y: number;
}

export function computeTargetRotation(
  leftProp: Point2D,
  rightProp: Point2D,
  bodyCenter: Point2D,
  behindThreshold: number,
): number | null {
  const lBehind = leftProp.y > bodyCenter.y + behindThreshold;
  const rBehind = rightProp.y > bodyCenter.y + behindThreshold;

  if (lBehind && rBehind) return null;

  let mx: number, my: number;
  if (lBehind) {
    mx = rightProp.x;
    my = rightProp.y;
  } else if (rBehind) {
    mx = leftProp.x;
    my = leftProp.y;
  } else {
    mx = (leftProp.x + rightProp.x) / 2;
    my = (leftProp.y + rightProp.y) / 2;
  }

  const dx = mx - bodyCenter.x;
  const dy = my - bodyCenter.y;
  const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  return Math.max(-90, Math.min(90, angle));
}

export function stepRotation(
  current: number,
  target: number,
  maxSpeed: number,
): number {
  let diff = target - current;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;

  if (Math.abs(diff) <= maxSpeed) return target;
  return current + Math.sign(diff) * maxSpeed;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/spatial-lab/body-rotation-solver.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for reach-calculator**

```typescript
// tests/unit/spatial-lab/reach-calculator.test.ts
import { describe, it, expect } from "vitest";
import {
  getShoulderPosition,
  computeReachPercentage,
} from "$lib/features/lab/tabs/spatial-lab/services/reach-calculator";

describe("getShoulderPosition", () => {
  const body = { x: 300, y: 330 };
  const shoulderDist = 34;

  it("places shoulders horizontally when body faces forward", () => {
    const left = getShoulderPosition("left", 0, body, shoulderDist);
    const right = getShoulderPosition("right", 0, body, shoulderDist);
    expect(left.x).toBeLessThan(body.x);
    expect(right.x).toBeGreaterThan(body.x);
    expect(Math.abs(left.y - right.y)).toBeLessThan(1);
  });

  it("rotates shoulders with body", () => {
    const left = getShoulderPosition("left", 90, body, shoulderDist);
    // At 90° rotation (facing right), left shoulder should be above body
    expect(left.y).toBeLessThan(body.y);
    expect(Math.abs(left.x - body.x)).toBeLessThan(5);
  });
});

describe("computeReachPercentage", () => {
  it("returns 0 when prop at shoulder", () => {
    const pct = computeReachPercentage({ x: 100, y: 100 }, { x: 100, y: 100 }, 165);
    expect(pct).toBe(0);
  });

  it("returns 100 at max reach", () => {
    const pct = computeReachPercentage({ x: 0, y: 0 }, { x: 165, y: 0 }, 165);
    expect(pct).toBe(100);
  });

  it("returns > 100 when out of reach", () => {
    const pct = computeReachPercentage({ x: 0, y: 0 }, { x: 200, y: 0 }, 165);
    expect(pct).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 6: Implement reach-calculator**

```typescript
// src/lib/features/lab/tabs/spatial-lab/services/reach-calculator.ts
import type { Point2D } from "./body-rotation-solver";

const SHOULDER_Y_OFFSET = -4;

export function getShoulderPosition(
  side: "left" | "right",
  bodyRotationDeg: number,
  bodyCenter: Point2D,
  shoulderDist: number,
): Point2D {
  const rad = bodyRotationDeg * (Math.PI / 180);
  const sign = side === "left" ? -1 : 1;
  return {
    x: bodyCenter.x + sign * shoulderDist * Math.cos(rad) - SHOULDER_Y_OFFSET * Math.sin(rad),
    y: bodyCenter.y + sign * shoulderDist * Math.sin(rad) + SHOULDER_Y_OFFSET * Math.cos(rad),
  };
}

export function computeReachPercentage(
  shoulder: Point2D,
  prop: Point2D,
  maxReach: number,
): number {
  const dist = Math.hypot(prop.x - shoulder.x, prop.y - shoulder.y);
  return Math.round((dist / maxReach) * 100);
}
```

- [ ] **Step 7: Run reach-calculator tests**

Run: `npx vitest run tests/unit/spatial-lab/reach-calculator.test.ts`
Expected: PASS

- [ ] **Step 8: Write failing tests for crossing-detector**

```typescript
// tests/unit/spatial-lab/crossing-detector.test.ts
import { describe, it, expect } from "vitest";
import { detectCrossing } from "$lib/features/lab/tabs/spatial-lab/services/crossing-detector";

describe("detectCrossing", () => {
  it("detects X-shaped crossing", () => {
    // Left arm goes from top-left to bottom-right, right arm top-right to bottom-left
    const result = detectCrossing(
      { x: 100, y: 100 }, { x: 400, y: 400 },
      { x: 400, y: 100 }, { x: 100, y: 400 },
    );
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(250, 0);
    expect(result!.y).toBeCloseTo(250, 0);
  });

  it("returns null for parallel lines", () => {
    const result = detectCrossing(
      { x: 100, y: 100 }, { x: 100, y: 400 },
      { x: 200, y: 100 }, { x: 200, y: 400 },
    );
    expect(result).toBeNull();
  });

  it("returns null when lines diverge (no segment intersection)", () => {
    const result = detectCrossing(
      { x: 100, y: 100 }, { x: 200, y: 100 },
      { x: 100, y: 200 }, { x: 200, y: 200 },
    );
    expect(result).toBeNull();
  });

  it("ignores intersections near endpoints", () => {
    // Lines that meet at a shared endpoint shouldn't count
    const result = detectCrossing(
      { x: 100, y: 100 }, { x: 200, y: 200 },
      { x: 200, y: 200 }, { x: 300, y: 100 },
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 9: Implement crossing-detector**

```typescript
// src/lib/features/lab/tabs/spatial-lab/services/crossing-detector.ts
import type { Point2D } from "./body-rotation-solver";

const ENDPOINT_MARGIN = 0.05;

export function detectCrossing(
  armLStart: Point2D,
  armLEnd: Point2D,
  armRStart: Point2D,
  armREnd: Point2D,
): Point2D | null {
  const x1 = armLStart.x, y1 = armLStart.y;
  const x2 = armLEnd.x, y2 = armLEnd.y;
  const x3 = armRStart.x, y3 = armRStart.y;
  const x4 = armREnd.x, y4 = armREnd.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.01) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t > ENDPOINT_MARGIN && t < 1 - ENDPOINT_MARGIN &&
      u > ENDPOINT_MARGIN && u < 1 - ENDPOINT_MARGIN) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }
  return null;
}
```

- [ ] **Step 10: Run crossing-detector tests**

Run: `npx vitest run tests/unit/spatial-lab/crossing-detector.test.ts`
Expected: PASS

- [ ] **Step 11: Write failing tests for plane-split-detector**

```typescript
// tests/unit/spatial-lab/plane-split-detector.test.ts
import { describe, it, expect } from "vitest";
import { detectPlaneSplit } from "$lib/features/lab/tabs/spatial-lab/services/plane-split-detector";

describe("detectPlaneSplit", () => {
  const bodyY = 330;
  const threshold = 30;

  it("no split when both props in front", () => {
    expect(detectPlaneSplit(180, 180, bodyY, threshold)).toBe(false);
  });

  it("splits when left prop behind body", () => {
    expect(detectPlaneSplit(480, 180, bodyY, threshold)).toBe(true);
  });

  it("splits when right prop behind body", () => {
    expect(detectPlaneSplit(180, 480, bodyY, threshold)).toBe(true);
  });

  it("splits when both behind", () => {
    expect(detectPlaneSplit(480, 480, bodyY, threshold)).toBe(true);
  });

  it("no split at threshold boundary", () => {
    expect(detectPlaneSplit(360, 180, bodyY, threshold)).toBe(false);
  });

  it("splits just past threshold", () => {
    expect(detectPlaneSplit(361, 180, bodyY, threshold)).toBe(true);
  });
});
```

- [ ] **Step 12: Implement plane-split-detector**

```typescript
// src/lib/features/lab/tabs/spatial-lab/services/plane-split-detector.ts
export function detectPlaneSplit(
  leftPropY: number,
  rightPropY: number,
  bodyCenterY: number,
  threshold: number,
): boolean {
  return leftPropY > bodyCenterY + threshold || rightPropY > bodyCenterY + threshold;
}
```

- [ ] **Step 13: Run all spatial-lab tests**

Run: `npx vitest run tests/unit/spatial-lab/`
Expected: All PASS

- [ ] **Step 14: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/services/ tests/unit/spatial-lab/
git commit -m "feat(spatial-lab): add pure computation services with tests

body-rotation-solver, reach-calculator, crossing-detector, plane-split-detector"
```

---

### Task 2: Lab State

**Files:**
- Create: `src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-state.svelte.ts`
- Create: `src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-constants.ts`

- [ ] **Step 1: Create constants file**

```typescript
// src/lib/features/lab/tabs/spatial-lab/state/spatial-lab-constants.ts
export const BODY_CENTER = { x: 300, y: 330 } as const;
export const SHOULDER_DIST = 34;
export const MAX_REACH = 165;
export const BEHIND_THRESHOLD = 30;
export const MAX_ROTATION_SPEED = 3;
export const PLANE_1_Y = 180;
export const PLANE_2_Y = 480;
export const CANVAS_SIZE = 600;

export const GRID_POINTS_P1 = [
  { name: "W", x: 140, y: 180 },
  { name: "N/S", x: 300, y: 180 },
  { name: "E", x: 460, y: 180 },
] as const;

export const GRID_POINTS_P2 = [
  { name: "W", x: 140, y: 480 },
  { name: "N/S", x: 300, y: 480 },
  { name: "E", x: 460, y: 480 },
] as const;

export interface Preset {
  name: string;
  left: { x: number; y: number };
  right: { x: number; y: number };
}

export const PRESETS: Preset[] = [
  { name: "Both at E", left: { x: 450, y: 180 }, right: { x: 460, y: 180 } },
  { name: "Both at W", left: { x: 130, y: 180 }, right: { x: 150, y: 180 } },
  { name: "L:W R:E", left: { x: 140, y: 180 }, right: { x: 460, y: 180 } },
  { name: "L:E R:W", left: { x: 460, y: 180 }, right: { x: 140, y: 180 } },
  { name: "R Behind E", left: { x: 460, y: 180 }, right: { x: 460, y: 480 } },
  { name: "L Behind W", left: { x: 140, y: 480 }, right: { x: 140, y: 180 } },
  { name: "Both Behind", left: { x: 140, y: 480 }, right: { x: 460, y: 480 } },
  { name: "Both N/S", left: { x: 290, y: 180 }, right: { x: 310, y: 180 } },
];
```

- [ ] **Step 2: Create reactive state**

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
import {
  BODY_CENTER,
  SHOULDER_DIST,
  MAX_REACH,
  BEHIND_THRESHOLD,
  MAX_ROTATION_SPEED,
  GRID_POINTS_P1,
  GRID_POINTS_P2,
  type Preset,
} from "./spatial-lab-constants";

export class SpatialLabState {
  leftProp = $state<Point2D>({ x: 450, y: 180 });
  rightProp = $state<Point2D>({ x: 460, y: 180 });
  bodyRotation = $state(0);
  bodyLocked = $state(false);
  showReachEnvelopes = $state(true);
  showArmLines = $state(true);
  showCrossingAlert = $state(true);

  private _targetRotation = 0;

  readonly bodyCenter = BODY_CENTER;
  readonly shoulderDist = SHOULDER_DIST;
  readonly maxReach = MAX_REACH;

  leftShoulder = $derived(
    getShoulderPosition("left", this.bodyRotation, BODY_CENTER, SHOULDER_DIST),
  );

  rightShoulder = $derived(
    getShoulderPosition("right", this.bodyRotation, BODY_CENTER, SHOULDER_DIST),
  );

  planeSplitActive = $derived(
    detectPlaneSplit(this.leftProp.y, this.rightProp.y, BODY_CENTER.y, BEHIND_THRESHOLD),
  );

  crossing = $derived(
    detectCrossing(this.leftShoulder, this.leftProp, this.rightShoulder, this.rightProp),
  );

  leftReachPct = $derived(
    computeReachPercentage(this.leftShoulder, this.leftProp, MAX_REACH),
  );

  rightReachPct = $derived(
    computeReachPercentage(this.rightShoulder, this.rightProp, MAX_REACH),
  );

  leftReachable = $derived(this.leftReachPct <= 100);
  rightReachable = $derived(this.rightReachPct <= 100);

  snapPoints = $derived(
    this.planeSplitActive
      ? [...GRID_POINTS_P1, ...GRID_POINTS_P2]
      : [...GRID_POINTS_P1],
  );

  toggleBodyLock(): void {
    this.bodyLocked = !this.bodyLocked;
  }

  applyPreset(preset: Preset): void {
    this.bodyLocked = false;
    this.leftProp = { ...preset.left };
    this.rightProp = { ...preset.right };
    this._targetRotation =
      computeTargetRotation(this.leftProp, this.rightProp, BODY_CENTER, BEHIND_THRESHOLD) ??
      this.bodyRotation;
    this.bodyRotation = this._targetRotation;
  }

  snapProp(side: "left" | "right"): void {
    const pos = side === "left" ? this.leftProp : this.rightProp;
    let best: Point2D | null = null;
    let bestDist = 45;
    for (const pt of this.snapPoints) {
      const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: pt.x, y: pt.y };
      }
    }
    if (best) {
      if (side === "left") this.leftProp = best;
      else this.rightProp = best;
    }
  }

  tick(): void {
    if (this.bodyLocked) return;

    const target = computeTargetRotation(
      this.leftProp,
      this.rightProp,
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

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/state/
git commit -m "feat(spatial-lab): add reactive state and constants"
```

---

### Task 3: SVG Canvas Components

**Files:**
- Create: `src/lib/features/lab/tabs/spatial-lab/components/canvas/PlaneLines.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/components/canvas/BodyDiagram.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/components/canvas/PropMarker.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/components/canvas/ArmLine.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/components/canvas/ReachEnvelope.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/components/canvas/CrossingIndicator.svelte`

All components are SVG fragments (`<svelte:options namespace="svg"/>`). They receive props from the parent canvas and render SVG elements.

- [ ] **Step 1: Create PlaneLines.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/canvas/PlaneLines.svelte -->
<svelte:options namespace="svg" />

<script lang="ts">
  import { PLANE_1_Y, PLANE_2_Y, GRID_POINTS_P1, GRID_POINTS_P2 } from "../../state/spatial-lab-constants";

  interface Props {
    planeSplitActive: boolean;
  }

  let { planeSplitActive }: Props = $props();
</script>

<!-- Plane 1 -->
<line
  x1={80} y1={PLANE_1_Y} x2={520} y2={PLANE_1_Y}
  stroke={planeSplitActive ? "#4a9eff" : "#ffcc00"}
  stroke-width="2"
  opacity="0.5"
/>
<text
  x={535} y={PLANE_1_Y + 4}
  fill={planeSplitActive ? "#4a9eff" : "#ffcc00"}
  font-size="10" opacity="0.5" font-family="system-ui"
>{planeSplitActive ? "plane 1" : "wall plane"}</text>

{#each GRID_POINTS_P1 as pt}
  <circle cx={pt.x} cy={pt.y} r={5} fill="#444" />
  <text x={pt.x} y={pt.y - 12} text-anchor="middle" fill="#555" font-size="10" font-family="system-ui">{pt.name}</text>
{/each}

<!-- Plane 2 -->
{#if planeSplitActive}
  <line
    x1={80} y1={PLANE_2_Y} x2={520} y2={PLANE_2_Y}
    stroke="#ff4a4a" stroke-width="2" opacity="0.5"
    style="transition: opacity 0.3s"
  />
  <text
    x={535} y={PLANE_2_Y + 4}
    fill="#ff4a4a" font-size="10" opacity="0.5" font-family="system-ui"
  >plane 2</text>
  {#each GRID_POINTS_P2 as pt}
    <circle cx={pt.x} cy={pt.y} r={5} fill="#443030" />
    <text x={pt.x} y={pt.y + 16} text-anchor="middle" fill="#664444" font-size="10" font-family="system-ui">{pt.name}</text>
  {/each}
{/if}
```

- [ ] **Step 2: Create BodyDiagram.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/canvas/BodyDiagram.svelte -->
<svelte:options namespace="svg" />

<script lang="ts">
  interface Props {
    cx: number;
    cy: number;
    rotation: number;
    locked: boolean;
    onclick: () => void;
  }

  let { cx, cy, rotation, locked, onclick }: Props = $props();
</script>

<g
  transform="translate({cx},{cy}) rotate({rotation.toFixed(1)})"
  cursor="pointer"
  style="transition: transform 0.08s ease-out"
  onclick={onclick}
  role="button"
  tabindex="0"
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onclick(); }}
>
  {#if locked}
    <circle cx={0} cy={0} r={38} fill="none" stroke="#ff8844" stroke-width="2" stroke-dasharray="6,4" opacity="0.6" />
  {/if}
  <ellipse cx={0} cy={0} rx={28} ry={20}
    fill="rgba(30,30,60,0.6)"
    stroke={locked ? "#ff8844" : "#888"}
    stroke-width="2"
  />
  <line x1={-34} y1={-4} x2={34} y2={-4} stroke="#888" stroke-width="1.5" opacity="0.5" />
  <circle cx={-34} cy={-4} r={6} fill="#4a9eff" opacity="0.35" />
  <circle cx={34} cy={-4} r={6} fill="#ff4a4a" opacity="0.35" />
  <line x1={0} y1={-20} x2={0} y2={-55}
    stroke={locked ? "#ff8844" : "#66ff66"}
    stroke-width="2"
    marker-end={locked ? "url(#arrowO)" : "url(#arrowG)"}
  />
  <text x={0} y={5} text-anchor="middle" fill="#777" font-size="9" font-family="system-ui">BODY</text>
</g>
```

- [ ] **Step 3: Create PropMarker.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/canvas/PropMarker.svelte -->
<svelte:options namespace="svg" />

<script lang="ts">
  interface Props {
    x: number;
    y: number;
    label: string;
    color: string;
  }

  let { x, y, label, color }: Props = $props();
</script>

<g cursor="grab">
  <circle cx={x} cy={y} r={15} fill={color} opacity="0.9" />
  <text
    {x} y={y + 5}
    text-anchor="middle" fill="#fff" font-size="12" font-weight="bold"
    font-family="system-ui" pointer-events="none"
  >{label}</text>
</g>
```

- [ ] **Step 4: Create ArmLine.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/canvas/ArmLine.svelte -->
<svelte:options namespace="svg" />

<script lang="ts">
  interface Props {
    shoulderX: number;
    shoulderY: number;
    propX: number;
    propY: number;
    color: string;
    visible: boolean;
  }

  let { shoulderX, shoulderY, propX, propY, color, visible }: Props = $props();
</script>

{#if visible}
  <line
    x1={shoulderX} y1={shoulderY}
    x2={propX} y2={propY}
    stroke={color} stroke-width="1.5" stroke-dasharray="6,4" opacity="0.5"
  />
{/if}
```

- [ ] **Step 5: Create ReachEnvelope.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/canvas/ReachEnvelope.svelte -->
<svelte:options namespace="svg" />

<script lang="ts">
  interface Props {
    cx: number;
    cy: number;
    radius: number;
    gradientId: string;
    color: string;
    visible: boolean;
  }

  let { cx, cy, radius, gradientId, color, visible }: Props = $props();
</script>

{#if visible}
  <circle {cx} {cy} r={radius} fill="url(#{gradientId})" />
  <circle {cx} {cy} r={radius} fill="none" stroke={color} stroke-width="1" stroke-dasharray="4,6" opacity="0.3" />
{/if}
```

- [ ] **Step 6: Create CrossingIndicator.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/canvas/CrossingIndicator.svelte -->
<svelte:options namespace="svg" />

<script lang="ts">
  import type { Point2D } from "../../services/body-rotation-solver";

  interface Props {
    crossing: Point2D | null;
    visible: boolean;
  }

  let { crossing, visible }: Props = $props();
</script>

{#if visible && crossing}
  <circle
    cx={crossing.x} cy={crossing.y} r={7}
    fill="#ffcc00" opacity="0.8" filter="url(#glow)"
  >
    <animate attributeName="r" values="5;9;5" dur="1.5s" repeatCount="indefinite" />
  </circle>
  <text
    x={crossing.x} y={crossing.y - 16}
    text-anchor="middle" fill="#ffcc00" font-size="9" font-family="system-ui" opacity="0.7"
  >CROSSING</text>
{/if}
```

- [ ] **Step 7: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "spatial-lab|Error"`
Expected: No errors in spatial-lab files

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/components/canvas/
git commit -m "feat(spatial-lab): add SVG canvas components

PlaneLines, BodyDiagram, PropMarker, ArmLine, ReachEnvelope, CrossingIndicator"
```

---

### Task 4: SpatialCanvas with Drag Handling

**Files:**
- Create: `src/lib/features/lab/tabs/spatial-lab/components/SpatialCanvas.svelte`

This is the main SVG viewport. It composes all canvas sub-components, defines SVG defs (gradients, markers, filters), handles mouse drag events for props, and runs the animation tick via `requestAnimationFrame`.

- [ ] **Step 1: Create SpatialCanvas.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/SpatialCanvas.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SpatialLabState } from "../state/spatial-lab-state.svelte";
  import { CANVAS_SIZE, BODY_CENTER } from "../state/spatial-lab-constants";
  import PlaneLines from "./canvas/PlaneLines.svelte";
  import BodyDiagram from "./canvas/BodyDiagram.svelte";
  import PropMarker from "./canvas/PropMarker.svelte";
  import ArmLine from "./canvas/ArmLine.svelte";
  import ReachEnvelope from "./canvas/ReachEnvelope.svelte";
  import CrossingIndicator from "./canvas/CrossingIndicator.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state }: Props = $props();
  let svgEl: SVGSVGElement;
  let dragging: "left" | "right" | null = null;
  let dragOffset = { x: 0, y: 0 };
  let rafId: number;

  function getMousePos(e: MouseEvent) {
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * CANVAS_SIZE / rect.width,
      y: (e.clientY - rect.top) * CANVAS_SIZE / rect.height,
    };
  }

  function startDrag(side: "left" | "right", e: MouseEvent) {
    dragging = side;
    const pos = getMousePos(e);
    const prop = side === "left" ? state.leftProp : state.rightProp;
    dragOffset = { x: prop.x - pos.x, y: prop.y - pos.y };
    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragging) return;
    const pos = getMousePos(e);
    const nx = Math.max(80, Math.min(520, pos.x + dragOffset.x));
    const ny = Math.max(60, Math.min(540, pos.y + dragOffset.y));
    if (dragging === "left") state.leftProp = { x: nx, y: ny };
    else state.rightProp = { x: nx, y: ny };
  }

  function handleMouseUp() {
    if (!dragging) return;
    state.snapProp(dragging);
    dragging = null;
  }

  function tick() {
    state.tick();
    rafId = requestAnimationFrame(tick);
  }

  onMount(() => { rafId = requestAnimationFrame(tick); });
  onDestroy(() => { cancelAnimationFrame(rafId); });
</script>

<div class="canvas-area">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {CANVAS_SIZE} {CANVAS_SIZE}"
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={handleMouseUp}
  >
    <defs>
      <radialGradient id="reachL" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#4a9eff" stop-opacity="0.06" />
        <stop offset="80%" stop-color="#4a9eff" stop-opacity="0.03" />
        <stop offset="100%" stop-color="#4a9eff" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="reachR" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff4a4a" stop-opacity="0.06" />
        <stop offset="80%" stop-color="#ff4a4a" stop-opacity="0.03" />
        <stop offset="100%" stop-color="#ff4a4a" stop-opacity="0" />
      </radialGradient>
      <marker id="arrowG" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <path d="M0,0 L8,3 L0,6" fill="#66ff66" />
      </marker>
      <marker id="arrowO" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <path d="M0,0 L8,3 L0,6" fill="#ff8844" />
      </marker>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>

    <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="#0a0a18" />

    <!-- Subtle radial grid -->
    {#each [60, 120, 180, 240] as r}
      <circle cx={BODY_CENTER.x} cy={BODY_CENTER.y} {r} fill="none" stroke="#151525" stroke-width="0.5" />
    {/each}

    <!-- Audience -->
    <line x1={120} y1={55} x2={480} y2={55} stroke="#333" stroke-width="1" />
    <text x={300} y={45} text-anchor="middle" fill="#555" font-size="12" font-family="system-ui">AUDIENCE</text>

    <PlaneLines planeSplitActive={state.planeSplitActive} />

    <ReachEnvelope
      cx={state.leftShoulder.x} cy={state.leftShoulder.y}
      radius={state.maxReach} gradientId="reachL" color="#4a9eff"
      visible={state.showReachEnvelopes}
    />
    <ReachEnvelope
      cx={state.rightShoulder.x} cy={state.rightShoulder.y}
      radius={state.maxReach} gradientId="reachR" color="#ff4a4a"
      visible={state.showReachEnvelopes}
    />

    <ArmLine
      shoulderX={state.leftShoulder.x} shoulderY={state.leftShoulder.y}
      propX={state.leftProp.x} propY={state.leftProp.y}
      color="#4a9eff" visible={state.showArmLines}
    />
    <ArmLine
      shoulderX={state.rightShoulder.x} shoulderY={state.rightShoulder.y}
      propX={state.rightProp.x} propY={state.rightProp.y}
      color="#ff4a4a" visible={state.showArmLines}
    />

    <CrossingIndicator crossing={state.crossing} visible={state.showCrossingAlert} />

    <BodyDiagram
      cx={BODY_CENTER.x} cy={BODY_CENTER.y}
      rotation={state.bodyRotation}
      locked={state.bodyLocked}
      onclick={() => state.toggleBodyLock()}
    />

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g onmousedown={(e) => startDrag("left", e)}>
      <PropMarker x={state.leftProp.x} y={state.leftProp.y} label="L" color="#4a9eff" />
    </g>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g onmousedown={(e) => startDrag("right", e)}>
      <PropMarker x={state.rightProp.x} y={state.rightProp.y} label="R" color="#ff4a4a" />
    </g>

    <text x={300} y={585} text-anchor="middle" fill="#444" font-size="11" font-family="system-ui">
      Floor View (Bird's Eye) — X and Z visible, Y hidden
    </text>
  </svg>
</div>

<style>
  .canvas-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a18;
    overflow: hidden;
  }
  .canvas-area svg {
    width: 100%;
    height: 100%;
    max-width: 700px;
    max-height: 700px;
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "spatial-lab|Error"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/components/SpatialCanvas.svelte
git commit -m "feat(spatial-lab): add SpatialCanvas with drag handling and animation loop"
```

---

### Task 5: Control Components

**Files:**
- Create: `src/lib/features/lab/tabs/spatial-lab/components/controls/ViewSwitcher.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/components/controls/VisualizationToggles.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/components/controls/InfoPanel.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/components/controls/PresetGrid.svelte`

- [ ] **Step 1: Create ViewSwitcher.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/controls/ViewSwitcher.svelte -->
<script lang="ts">
  type View = "wall" | "wheel" | "floor";

  interface Props {
    active: View;
    onchange: (view: View) => void;
  }

  let { active, onchange }: Props = $props();

  const views: { id: View; label: string; axes: string }[] = [
    { id: "wall", label: "Wall", axes: "X · Y" },
    { id: "wheel", label: "Wheel", axes: "Z · Y" },
    { id: "floor", label: "Floor", axes: "X · Z" },
  ];
</script>

<div class="panel-section">
  <span class="panel-label">Viewing Plane</span>
  <div class="view-switcher">
    {#each views as v}
      <button
        class="view-btn"
        class:active={active === v.id}
        aria-pressed={active === v.id}
        onclick={() => onchange(v.id)}
      >
        {v.label}
        <span class="view-axes">{v.axes}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .panel-section { display: flex; flex-direction: column; gap: 8px; }
  .panel-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px;
    color: #666; font-weight: 600;
  }
  .view-switcher { display: flex; gap: 4px; }
  .view-btn {
    flex: 1; padding: 8px 4px; border: 1px solid #2a2a4a; background: #1a1a35;
    color: #aaa; font-size: 11px; font-weight: 500; cursor: pointer; border-radius: 6px;
    transition: all 0.2s; text-align: center; display: flex; flex-direction: column;
  }
  .view-btn:hover { border-color: #4a4a6a; color: #ddd; }
  .view-btn.active {
    background: #2a2a5a; border-color: #6a6aff; color: #fff;
    box-shadow: 0 0 12px rgba(106,106,255,0.15);
  }
  .view-axes { font-size: 9px; color: #666; margin-top: 2px; }
  .view-btn.active .view-axes { color: #8888cc; }
</style>
```

- [ ] **Step 2: Create VisualizationToggles.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/controls/VisualizationToggles.svelte -->
<script lang="ts">
  import type { SpatialLabState } from "../../state/spatial-lab-state.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state }: Props = $props();

  const toggles = [
    { key: "showReachEnvelopes" as const, label: "Reach envelopes" },
    { key: "showArmLines" as const, label: "Arm lines" },
    { key: "showCrossingAlert" as const, label: "Crossing alert" },
  ];
</script>

<div class="panel-section">
  <span class="panel-label">Visualization</span>
  {#each toggles as t}
    <div class="toggle-row">
      <span class="toggle-label">{t.label}</span>
      <button
        class="toggle-btn"
        class:on={state[t.key]}
        aria-pressed={state[t.key]}
        onclick={() => { state[t.key] = !state[t.key]; }}
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

- [ ] **Step 3: Create InfoPanel.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/controls/InfoPanel.svelte -->
<script lang="ts">
  import type { SpatialLabState } from "../../state/spatial-lab-state.svelte";
  import { GRID_POINTS_P1, GRID_POINTS_P2, PLANE_1_Y, PLANE_2_Y } from "../../state/spatial-lab-constants";

  interface Props {
    state: SpatialLabState;
  }

  let { state }: Props = $props();

  function gridName(x: number, y: number): string {
    const plane = y < (PLANE_1_Y + PLANE_2_Y) / 2 ? 1 : 2;
    const pts = plane === 1 ? GRID_POINTS_P1 : GRID_POINTS_P2;
    let best = "?", bestD = 999;
    for (const p of pts) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bestD) { bestD = d; best = p.name; }
    }
    return `${best} · Plane ${plane}`;
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
    <span class="badge" class:locked={state.bodyLocked} class:auto={!state.bodyLocked}>
      {state.bodyLocked ? "locked" : "auto"}
    </span>
  </span>
  <div class="info-card">
    <div class="info-row">
      <span class="info-label">Rotation</span>
      <span class="info-value {rotClass(state.bodyRotation)}">{state.bodyRotation.toFixed(1)}°</span>
    </div>
    <div class="info-row">
      <span class="info-label">Mode</span>
      <span class="info-value {state.bodyLocked ? 'yellow' : 'green'}">
        {state.bodyLocked ? "Locked" : "Auto-tracking"}
      </span>
    </div>
    <div class="info-row">
      <span class="info-label">Plane split</span>
      <span class="info-value {state.planeSplitActive ? 'yellow' : 'green'}">
        {state.planeSplitActive ? "Yes" : "No"}
      </span>
    </div>
    <div class="info-row">
      <span class="info-label">Arms crossing</span>
      <span class="info-value {state.crossing ? 'warn' : 'green'}">
        {state.crossing ? "Yes!" : "No"}
      </span>
    </div>
  </div>
  <div class="hint">Click body to lock/unlock</div>
</div>

<div class="panel-section">
  <span class="panel-label">Props</span>
  <div class="info-card">
    <div class="info-row">
      <span class="info-label">Left</span>
      <span class="info-value blue">{gridName(state.leftProp.x, state.leftProp.y)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">L reach</span>
      <span class="info-value {reachClass(state.leftReachPct)}">{state.leftReachPct}%</span>
    </div>
    <div class="spacer"></div>
    <div class="info-row">
      <span class="info-label">Right</span>
      <span class="info-value red">{gridName(state.rightProp.x, state.rightProp.y)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">R reach</span>
      <span class="info-value {reachClass(state.rightReachPct)}">{state.rightReachPct}%</span>
    </div>
  </div>
</div>

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
  .hint { font-size: 10px; color: #555; text-align: center; margin-top: 2px; }
</style>
```

- [ ] **Step 4: Create PresetGrid.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/controls/PresetGrid.svelte -->
<script lang="ts">
  import type { SpatialLabState } from "../../state/spatial-lab-state.svelte";
  import { PRESETS } from "../../state/spatial-lab-constants";

  interface Props {
    state: SpatialLabState;
  }

  let { state }: Props = $props();
</script>

<div class="panel-section">
  <span class="panel-label">Presets</span>
  <div class="preset-grid">
    {#each PRESETS as preset}
      <button class="preset-btn" onclick={() => state.applyPreset(preset)}>
        {preset.name}
      </button>
    {/each}
  </div>
</div>

<style>
  .panel-section { display: flex; flex-direction: column; gap: 8px; }
  .panel-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px;
    color: #666; font-weight: 600;
  }
  .preset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .preset-btn {
    padding: 7px 8px; border: 1px solid #2a2a4a; background: #1a1a35;
    color: #aaa; font-size: 10px; cursor: pointer; border-radius: 5px;
    transition: all 0.15s; text-align: center;
  }
  .preset-btn:hover { border-color: #4a4a6a; color: #ddd; background: #222250; }
</style>
```

- [ ] **Step 5: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "spatial-lab|Error"`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/components/controls/
git commit -m "feat(spatial-lab): add control panel components

ViewSwitcher, VisualizationToggles, InfoPanel, PresetGrid"
```

---

### Task 6: Top-Level Assembly + Side Panel + Status Bar

**Files:**
- Create: `src/lib/features/lab/tabs/spatial-lab/components/SpatialControls.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/components/SpatialStatusBar.svelte`
- Create: `src/lib/features/lab/tabs/spatial-lab/SpatialLab.svelte`

- [ ] **Step 1: Create SpatialControls.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/SpatialControls.svelte -->
<script lang="ts">
  import type { SpatialLabState } from "../state/spatial-lab-state.svelte";
  import ViewSwitcher from "./controls/ViewSwitcher.svelte";
  import VisualizationToggles from "./controls/VisualizationToggles.svelte";
  import InfoPanel from "./controls/InfoPanel.svelte";
  import PresetGrid from "./controls/PresetGrid.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state }: Props = $props();
  let activeView: "wall" | "wheel" | "floor" = $state("floor");
</script>

<div class="side-panel">
  <ViewSwitcher active={activeView} onchange={(v) => activeView = v} />
  <VisualizationToggles {state} />
  <div class="divider"></div>
  <InfoPanel {state} />
  <div class="divider"></div>
  <PresetGrid {state} />
</div>

<style>
  .side-panel {
    width: 260px; background: #12122a; border-left: 1px solid #2a2a4a;
    padding: 16px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto;
  }
  .divider { height: 1px; background: #2a2a4a; margin: 2px 0; }
</style>
```

- [ ] **Step 2: Create SpatialStatusBar.svelte**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/components/SpatialStatusBar.svelte -->
<script lang="ts">
  import type { SpatialLabState } from "../state/spatial-lab-state.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state }: Props = $props();

  let statusColor = $derived.by(() => {
    if (!state.leftReachable || !state.rightReachable) return "red";
    if (state.crossing) return "yellow";
    return "green";
  });

  let statusText = $derived.by(() => {
    if (!state.leftReachable && !state.rightReachable) return "Both props out of reach";
    if (!state.leftReachable) return "Left prop out of reach";
    if (!state.rightReachable) return "Right prop out of reach";
    if (state.crossing) return "Arms crossing — body turn may help";
    return "Both props reachable";
  });
</script>

<div class="status-bar">
  <div class="status-item">
    <div class="status-dot {statusColor}"></div>
    <span>{statusText}</span>
  </div>
  <div class="flex-fill"></div>
  <span class="detail">
    L: {state.leftReachPct}% · R: {state.rightReachPct}%
    {#if state.bodyLocked} · LOCKED{/if}
  </span>
</div>

<style>
  .status-bar {
    display: flex; align-items: center; gap: 16px; padding: 8px 20px;
    background: #12122a; border-top: 1px solid #2a2a4a; font-size: 11px; color: #888;
  }
  .status-item { display: flex; align-items: center; gap: 5px; }
  .status-dot {
    width: 7px; height: 7px; border-radius: 50%; transition: background 0.3s;
  }
  .status-dot.green { background: #4aff8a; }
  .status-dot.yellow { background: #ffcc00; }
  .status-dot.red { background: #ff4a4a; }
  .flex-fill { flex: 1; }
  .detail { color: #555; font-size: 10px; }
</style>
```

- [ ] **Step 3: Create SpatialLab.svelte (top-level)**

```svelte
<!-- src/lib/features/lab/tabs/spatial-lab/SpatialLab.svelte -->
<script lang="ts">
  import { createSpatialLabState } from "./state/spatial-lab-state.svelte";
  import SpatialCanvas from "./components/SpatialCanvas.svelte";
  import SpatialControls from "./components/SpatialControls.svelte";
  import SpatialStatusBar from "./components/SpatialStatusBar.svelte";

  const state = createSpatialLabState();
</script>

<div class="spatial-lab">
  <div class="lab-header">
    <div class="header-left">
      <span class="lab-title">Spatial Lab</span>
      <span class="lab-subtitle">Bird's Eye Exploration</span>
    </div>
    <span class="header-hint">Drag props · Click body to lock/unlock rotation</span>
  </div>
  <div class="lab-body">
    <SpatialCanvas {state} />
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

- [ ] **Step 4: Run typecheck**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "spatial-lab|Error"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/spatial-lab/components/SpatialControls.svelte \
        src/lib/features/lab/tabs/spatial-lab/components/SpatialStatusBar.svelte \
        src/lib/features/lab/tabs/spatial-lab/SpatialLab.svelte
git commit -m "feat(spatial-lab): add top-level assembly, side panel, and status bar"
```

---

### Task 7: Tab Registration + Build Verification

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts` (add to LAB_TABS)
- Modify: `src/lib/features/lab/LabModule.svelte` (add dynamic import)

- [ ] **Step 1: Add tab definition**

In `src/lib/shared/navigation/config/tab-definitions.ts`, add to `LAB_TABS` array:

```typescript
{
  id: "spatial-lab",
  label: "Spatial Lab",
  icon: '<i class="fas fa-eye" style="color: #6a6aff;"></i>',
  description: "Bird's eye exploration of body rotation and arm reachability",
  color: "#6a6aff",
  gradient: "linear-gradient(135deg, #8888ff 0%, #6a6aff 100%)",
},
```

- [ ] **Step 2: Add dynamic import to LabModule.svelte**

In `src/lib/features/lab/LabModule.svelte`, add to the `tabComponents` record:

```typescript
"spatial-lab": () => import("./tabs/spatial-lab/SpatialLab.svelte"),
```

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass including new spatial-lab tests

- [ ] **Step 5: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts \
        src/lib/features/lab/LabModule.svelte
git commit -m "feat(spatial-lab): register tab in lab navigation

Spatial Lab now appears in the Lab module tab list."
```

---

### Post-Implementation Verification

After all 7 tasks:

1. Run `npm run build` — must succeed
2. Run `npm run check` — must pass
3. Run `npx vitest run` — all tests pass
4. Navigate to Lab → Spatial Lab tab in the app
5. Verify: dragging props, body auto-rotation, plane split, reach envelopes, crossing detection, presets, body lock/unlock all work
