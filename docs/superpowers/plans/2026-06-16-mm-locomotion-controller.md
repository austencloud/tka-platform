# Free-Running MM Locomotion Controller — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A free-running motion-matching locomotion controller that drives one performer to continuously reorient and step toward a live target (position + facing) with foot-lock and inertialization — a drop-in upgrade of the stage speed-blend `LocomotionController`.

**Architecture:** Four pure modules (feature extraction, KNN search, trajectory query, inertialization) + one stateful controller that orchestrates them per frame, samples clips via `AnimationMixer`, applies root motion, and runs a foot-lock pass reusing the local `solveLegIK` + `contact-curve-cache`. Verified on a real-component test page.

**Tech Stack:** TypeScript, Three.js (Vector3, Quaternion, AnimationMixer, Bone), Threlte `useTask`, Svelte 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-16-reorient-stepping-design.md`

**Test command (single file):**
`npx vitest run --config tests/config/vitest.config.ts <path>`
**Full suite:** `npm test`

**Reuse (do NOT reimplement):**
- `src/lib/shared/3d/services/hinge-constrained-leg-ik-solver.ts` → `solveLegIK(input: LegIKInput)` — foot-lock IK.
- `src/lib/shared/3d/services/knee-hinge-axis-calibrator.ts` → `computeKneeHingeAxis(upLegRestDir, legRestDir)`.
- `src/lib/shared/3d/services/contact-curve-cache.ts` → `createContactCurveCache`, `registerCurve`, `getContactAt`.
- `@austencloud/scene-3d` → `PerformerRig`, `RootMotionExtractor`, `LegIKInput` type.
- `src/lib/features/stage/locomotion/locomotion-controller.ts` → the `LocomotionState` shape + `update()` contract to mirror.
- `src/lib/shared/3d/components/controls/SegmentedControl.svelte` — test-page controls (per chip-primitives).

---

## File Structure

All new files under `src/lib/features/stage/locomotion/motion-matching/`:

| File | Responsibility |
|---|---|
| `feature-types.ts` | Shared types: `MotionFrame`, `MotionDatabase`, `FeatureWeights`, `PoseSample`, `FEATURE_STRIDE`. |
| `feature-extractor.ts` | Build the `MotionDatabase` from an injected pose sampler (pure). |
| `feature-extractor.test.ts` | Unit tests. |
| `search.ts` | `searchNearest(db, query)` weighted-L2 KNN (pure). |
| `search.test.ts` | Unit tests. |
| `trajectory.ts` | `buildTrajectoryQuery(current, target, horizons)` (pure). |
| `trajectory.test.ts` | Unit tests. |
| `inertialization.ts` | Per-quaternion inertializer (start/apply). |
| `inertialization.test.ts` | Unit tests. |
| `mm-locomotion-controller.ts` | Stateful per-frame orchestrator (drop-in for stage controller). |
| Test page: `src/routes/test/mm-locomotion/+page.svelte` | Real-component verification surface. |

---

## PHASE 1 — Pure MM Units (no external deps, fully testable)

### Task 1: Feature types

**Files:**
- Create: `src/lib/features/stage/locomotion/motion-matching/feature-types.ts`

Pure types + the layout constant. No tests (types only).

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/features/stage/locomotion/motion-matching/feature-types.ts

/** A frame in the motion database: which clip + sample time it came from. */
export interface MotionFrame {
  clipId: string;
  /** Seconds into the clip. */
  time: number;
}

/**
 * One sampled pose, in ROOT-LOCAL space (relative to the hips at this frame),
 * plus the clip's world facing and ground position. Produced by an injected
 * sampler so feature extraction stays pure + testable.
 */
export interface PoseSample {
  /** Left foot position relative to hips (x,y,z). */
  leftFoot: [number, number, number];
  /** Right foot position relative to hips. */
  rightFoot: [number, number, number];
  /** Hip world position (x,y,z) — used for hip velocity via finite difference. */
  hips: [number, number, number];
  /** Root facing in radians at this frame (clip-driven yaw). */
  facing: number;
  /** Root ground position (x,z) at this frame (clip-driven translation). */
  rootXZ: [number, number];
}

/** Per-group weights applied to the squared-L2 distance during search. */
export interface FeatureWeights {
  footPos: number;
  footVel: number;
  hipVel: number;
  trajPos: number;
  trajFacing: number;
}

export const DEFAULT_WEIGHTS: FeatureWeights = {
  footPos: 1.0,
  footVel: 0.3,
  hipVel: 0.5,
  trajPos: 1.5,
  trajFacing: 2.0,
};

/** Trajectory horizons in seconds. */
export const HORIZONS_SEC = [0.33, 0.66, 1.0] as const;

/**
 * Feature vector layout (stride = 24 floats):
 *  [0..2]   leftFoot pos (3)
 *  [3..5]   rightFoot pos (3)
 *  [6..8]   leftFoot vel (3)
 *  [9..11]  rightFoot vel (3)
 *  [12..14] hip vel (3)
 *  [15..20] traj pos: 3 horizons x (x,z) (6)
 *  [21..23] traj facing: 3 horizons x 1 (3)
 */
export const FEATURE_STRIDE = 24;

export interface MotionDatabase {
  /** frameCount * FEATURE_STRIDE floats. */
  features: Float32Array;
  /** length === frameCount. */
  frames: MotionFrame[];
  /** Per-column weight vector, length FEATURE_STRIDE. */
  columnWeights: Float32Array;
}

/** Expand group weights into a per-column weight vector of length FEATURE_STRIDE. */
export function buildColumnWeights(w: FeatureWeights): Float32Array {
  const cw = new Float32Array(FEATURE_STRIDE);
  const set = (start: number, count: number, v: number) => {
    for (let i = start; i < start + count; i++) cw[i] = v;
  };
  set(0, 6, w.footPos);   // foot positions
  set(6, 6, w.footVel);   // foot velocities
  set(12, 3, w.hipVel);   // hip velocity
  set(15, 6, w.trajPos);  // trajectory positions
  set(21, 3, w.trajFacing); // trajectory facings
  return cw;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/stage/locomotion/motion-matching/feature-types.ts
git commit -m "feat(mm-locomotion): feature vector types + layout" -- src/lib/features/stage/locomotion/motion-matching/feature-types.ts
```

---

### Task 2: Feature extractor

**Files:**
- Create: `src/lib/features/stage/locomotion/motion-matching/feature-extractor.ts`
- Test: `src/lib/features/stage/locomotion/motion-matching/feature-extractor.test.ts`

The extractor samples each clip at 30 fps via an **injected sampler**
`(clipId, time) => PoseSample`, computes velocities by finite difference, and
trajectory features by reading future root pos/facing. Pure: same sampler →
same DB.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/features/stage/locomotion/motion-matching/feature-extractor.test.ts
import { describe, expect, it } from "vitest";
import { buildMotionDatabase } from "./feature-extractor";
import { FEATURE_STRIDE, DEFAULT_WEIGHTS, type PoseSample } from "./feature-types";

// A stationary clip: feet fixed relative to hips, no root translation or turn.
function stationarySampler(_clipId: string, _time: number): PoseSample {
  return {
    leftFoot: [-0.1, 0, 0],
    rightFoot: [0.1, 0, 0],
    hips: [0, 1, 0],
    facing: 0,
    rootXZ: [0, 0],
  };
}

describe("buildMotionDatabase", () => {
  it("produces frameCount * stride features and a matching frame index", () => {
    const db = buildMotionDatabase(
      [{ clipId: "idle", durationSec: 1.0 }],
      stationarySampler,
      30,
      DEFAULT_WEIGHTS,
    );
    // 1.0s @ 30fps, minus the trailing horizon window that has no future = still
    // frames present; assert internal consistency rather than an exact count.
    expect(db.features.length).toBe(db.frames.length * FEATURE_STRIDE);
    expect(db.columnWeights.length).toBe(FEATURE_STRIDE);
    expect(db.frames.length).toBeGreaterThan(0);
  });

  it("yields ~zero velocities and ~zero trajectory deltas for a stationary clip", () => {
    const db = buildMotionDatabase(
      [{ clipId: "idle", durationSec: 1.5 }],
      stationarySampler,
      30,
      DEFAULT_WEIGHTS,
    );
    // Inspect the first frame's velocity + trajectory columns (indices 6..23).
    for (let c = 6; c < FEATURE_STRIDE; c++) {
      expect(Math.abs(db.features[c])).toBeLessThan(1e-4);
    }
    // Foot position columns (0..5) reflect the fixed sampler offsets.
    expect(db.features[0]).toBeCloseTo(-0.1, 4);
    expect(db.features[3]).toBeCloseTo(0.1, 4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/feature-extractor.test.ts`
Expected: FAIL — `buildMotionDatabase` is not defined.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/features/stage/locomotion/motion-matching/feature-extractor.ts
import {
  FEATURE_STRIDE,
  HORIZONS_SEC,
  buildColumnWeights,
  type FeatureWeights,
  type MotionDatabase,
  type MotionFrame,
  type PoseSample,
} from "./feature-types";

export interface ClipSpec {
  clipId: string;
  durationSec: number;
}

export type PoseSampler = (clipId: string, time: number) => PoseSample;

/** Shortest-arc difference a-b wrapped to [-PI, PI]. */
function angleDelta(a: number, b: number): number {
  let d = ((a - b + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Build the motion database. For each clip, sample at `fps`. Velocities use a
 * one-frame finite difference; trajectory features read the future sample at
 * each horizon, expressed in the CURRENT frame's root-local space.
 */
export function buildMotionDatabase(
  clips: ClipSpec[],
  sample: PoseSampler,
  fps: number,
  weights: FeatureWeights,
): MotionDatabase {
  const dt = 1 / fps;
  const frames: MotionFrame[] = [];
  const rows: number[] = [];

  for (const clip of clips) {
    const frameCount = Math.floor(clip.durationSec * fps);
    for (let f = 0; f < frameCount; f++) {
      const t = f * dt;
      const tNext = Math.min(clip.durationSec, t + dt);
      const cur = sample(clip.clipId, t);
      const nxt = sample(clip.clipId, tNext);

      const row = new Array<number>(FEATURE_STRIDE).fill(0);

      // [0..5] foot positions (root-local)
      row[0] = cur.leftFoot[0]; row[1] = cur.leftFoot[1]; row[2] = cur.leftFoot[2];
      row[3] = cur.rightFoot[0]; row[4] = cur.rightFoot[1]; row[5] = cur.rightFoot[2];

      // [6..11] foot velocities
      const inv = tNext > t ? 1 / (tNext - t) : 0;
      row[6] = (nxt.leftFoot[0] - cur.leftFoot[0]) * inv;
      row[7] = (nxt.leftFoot[1] - cur.leftFoot[1]) * inv;
      row[8] = (nxt.leftFoot[2] - cur.leftFoot[2]) * inv;
      row[9] = (nxt.rightFoot[0] - cur.rightFoot[0]) * inv;
      row[10] = (nxt.rightFoot[1] - cur.rightFoot[1]) * inv;
      row[11] = (nxt.rightFoot[2] - cur.rightFoot[2]) * inv;

      // [12..14] hip velocity (world)
      row[12] = (nxt.hips[0] - cur.hips[0]) * inv;
      row[13] = (nxt.hips[1] - cur.hips[1]) * inv;
      row[14] = (nxt.hips[2] - cur.hips[2]) * inv;

      // [15..23] trajectory: future root pos (root-local x,z) + facing delta
      const cosF = Math.cos(-cur.facing);
      const sinF = Math.sin(-cur.facing);
      for (let h = 0; h < HORIZONS_SEC.length; h++) {
        const th = Math.min(clip.durationSec, t + HORIZONS_SEC[h]);
        const fut = sample(clip.clipId, th);
        // world delta
        const dxw = fut.rootXZ[0] - cur.rootXZ[0];
        const dzw = fut.rootXZ[1] - cur.rootXZ[1];
        // rotate into current root-local frame
        const lx = dxw * cosF - dzw * sinF;
        const lz = dxw * sinF + dzw * cosF;
        row[15 + h * 2] = lx;
        row[16 + h * 2] = lz;
        row[21 + h] = angleDelta(fut.facing, cur.facing);
      }

      frames.push({ clipId: clip.clipId, time: t });
      for (let c = 0; c < FEATURE_STRIDE; c++) rows.push(row[c]);
    }
  }

  return {
    features: new Float32Array(rows),
    frames,
    columnWeights: buildColumnWeights(weights),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/feature-extractor.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/stage/locomotion/motion-matching/feature-extractor.ts src/lib/features/stage/locomotion/motion-matching/feature-extractor.test.ts
git commit -m "feat(mm-locomotion): motion database feature extractor" -- src/lib/features/stage/locomotion/motion-matching/feature-extractor.ts src/lib/features/stage/locomotion/motion-matching/feature-extractor.test.ts
```

---

### Task 3: Search

**Files:**
- Create: `src/lib/features/stage/locomotion/motion-matching/search.ts`
- Test: `src/lib/features/stage/locomotion/motion-matching/search.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/features/stage/locomotion/motion-matching/search.test.ts
import { describe, expect, it } from "vitest";
import { searchNearest } from "./search";
import { FEATURE_STRIDE, type MotionDatabase } from "./feature-types";

function dbOf(rows: number[][]): MotionDatabase {
  const features = new Float32Array(rows.length * FEATURE_STRIDE);
  rows.forEach((r, i) => features.set(r, i * FEATURE_STRIDE));
  return {
    features,
    frames: rows.map((_, i) => ({ clipId: "c", time: i })),
    columnWeights: new Float32Array(FEATURE_STRIDE).fill(1),
  };
}

describe("searchNearest", () => {
  it("returns the index of the exact-matching row", () => {
    const a = new Array(FEATURE_STRIDE).fill(0);
    const b = new Array(FEATURE_STRIDE).fill(0); b[0] = 5;
    const c = new Array(FEATURE_STRIDE).fill(0); c[0] = 10;
    const db = dbOf([a, b, c]);
    const query = new Float32Array(FEATURE_STRIDE); query[0] = 5.2;
    expect(searchNearest(db, query)).toBe(1);
  });

  it("respects column weights (a heavily-weighted column dominates)", () => {
    const a = new Array(FEATURE_STRIDE).fill(0); a[21] = 0;  // facing col
    const b = new Array(FEATURE_STRIDE).fill(0); b[21] = 1;
    const db = dbOf([a, b]);
    db.columnWeights[21] = 100;
    const query = new Float32Array(FEATURE_STRIDE); query[21] = 0.9;
    expect(searchNearest(db, query)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/search.test.ts`
Expected: FAIL — `searchNearest` not defined.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/features/stage/locomotion/motion-matching/search.ts
import { FEATURE_STRIDE, type MotionDatabase } from "./feature-types";

/**
 * Weighted squared-L2 nearest-neighbour over the database. Returns the frame
 * index of the closest row. Flat linear scan — the DB is small (thousands of
 * rows x 24 floats), trivially real-time.
 */
export function searchNearest(db: MotionDatabase, query: Float32Array): number {
  const { features, columnWeights } = db;
  const rowCount = features.length / FEATURE_STRIDE;
  let best = -1;
  let bestDist = Infinity;
  for (let r = 0; r < rowCount; r++) {
    const base = r * FEATURE_STRIDE;
    let dist = 0;
    for (let c = 0; c < FEATURE_STRIDE; c++) {
      const d = features[base + c] - query[c];
      dist += columnWeights[c] * d * d;
      if (dist >= bestDist) break; // early-out
    }
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/search.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/stage/locomotion/motion-matching/search.ts src/lib/features/stage/locomotion/motion-matching/search.test.ts
git commit -m "feat(mm-locomotion): weighted-L2 nearest-neighbour search" -- src/lib/features/stage/locomotion/motion-matching/search.ts src/lib/features/stage/locomotion/motion-matching/search.test.ts
```

---

### Task 4: Trajectory query

**Files:**
- Create: `src/lib/features/stage/locomotion/motion-matching/trajectory.ts`
- Test: `src/lib/features/stage/locomotion/motion-matching/trajectory.test.ts`

Produces the trajectory portion of the query vector from the live target. The
controller writes these into columns [15..23] of the query.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/features/stage/locomotion/motion-matching/trajectory.test.ts
import { describe, expect, it } from "vitest";
import { buildTrajectoryQuery } from "./trajectory";
import { HORIZONS_SEC } from "./feature-types";

describe("buildTrajectoryQuery", () => {
  it("ramps facing toward the target across horizons (root-local)", () => {
    const out = buildTrajectoryQuery(
      { position: { x: 0, z: 0 }, facing: 0 },
      { position: { x: 0, z: 0 }, facing: Math.PI / 2 },
      1.0, // reach in ~1s
    );
    // facing deltas increase with horizon, last ~= +PI/2
    expect(out.facing[0]).toBeGreaterThan(0);
    expect(out.facing[2]).toBeCloseTo(Math.PI / 2, 2);
    expect(out.facing[0]).toBeLessThan(out.facing[2]);
  });

  it("gives zero local position delta when already at target", () => {
    const out = buildTrajectoryQuery(
      { position: { x: 2, z: 3 }, facing: 0 },
      { position: { x: 2, z: 3 }, facing: 0 },
      1.0,
    );
    for (let h = 0; h < HORIZONS_SEC.length; h++) {
      expect(Math.abs(out.posXZ[h * 2])).toBeLessThan(1e-6);
      expect(Math.abs(out.posXZ[h * 2 + 1])).toBeLessThan(1e-6);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/trajectory.test.ts`
Expected: FAIL — `buildTrajectoryQuery` not defined.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/features/stage/locomotion/motion-matching/trajectory.ts
import { HORIZONS_SEC } from "./feature-types";

export interface LocomotionPose {
  position: { x: number; z: number };
  facing: number;
}

export interface TrajectoryQuery {
  /** 3 horizons x (x,z) in CURRENT root-local space — columns [15..20]. */
  posXZ: number[];
  /** 3 horizons x facing-delta (radians) — columns [21..23]. */
  facing: number[];
}

function angleDelta(a: number, b: number): number {
  let d = ((a - b + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Linear approach: assume the target is reached in `reachSec`. At each horizon h,
 * the expected pose is lerp(current, target, min(1, h/reachSec)). Position is
 * expressed in current root-local space; facing as a shortest-arc delta.
 */
export function buildTrajectoryQuery(
  current: LocomotionPose,
  target: LocomotionPose,
  reachSec: number,
): TrajectoryQuery {
  const cosF = Math.cos(-current.facing);
  const sinF = Math.sin(-current.facing);
  const fullFacingDelta = angleDelta(target.facing, current.facing);

  const posXZ: number[] = [];
  const facing: number[] = [];

  for (let h = 0; h < HORIZONS_SEC.length; h++) {
    const t = reachSec > 0 ? Math.min(1, HORIZONS_SEC[h] / reachSec) : 1;
    const wx = current.position.x + (target.position.x - current.position.x) * t;
    const wz = current.position.z + (target.position.z - current.position.z) * t;
    const dxw = wx - current.position.x;
    const dzw = wz - current.position.z;
    posXZ.push(dxw * cosF - dzw * sinF, dxw * sinF + dzw * cosF);
    facing.push(fullFacingDelta * t);
  }

  return { posXZ, facing };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/trajectory.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/stage/locomotion/motion-matching/trajectory.ts src/lib/features/stage/locomotion/motion-matching/trajectory.test.ts
git commit -m "feat(mm-locomotion): trajectory query builder" -- src/lib/features/stage/locomotion/motion-matching/trajectory.ts src/lib/features/stage/locomotion/motion-matching/trajectory.test.ts
```

---

### Task 5: Inertialization

**Files:**
- Create: `src/lib/features/stage/locomotion/motion-matching/inertialization.ts`
- Test: `src/lib/features/stage/locomotion/motion-matching/inertialization.test.ts`

Per-joint quaternion inertializer. On a switch, capture the offset between the
old pose and the new clip pose; decay it to zero over the blend duration so the
visible pose eases from old into new with no pop.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/features/stage/locomotion/motion-matching/inertialization.test.ts
import { describe, expect, it } from "vitest";
import { Quaternion } from "three";
import { startInertialize, applyInertialize } from "./inertialization";

function angleOf(q: Quaternion): number {
  return 2 * Math.acos(Math.min(1, Math.abs(q.w)));
}

describe("inertialization", () => {
  it("starts at the old pose and decays to the new pose by blend end", () => {
    const oldPose = new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as any, 1.0);
    const newPose = new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 } as any, 0.0);
    const inert = startInertialize(oldPose, newPose, 0.25);

    // at t=0 (dt=0) the output equals the old pose
    const atStart = applyInertialize(inert, newPose, 0);
    expect(angleOf(atStart)).toBeCloseTo(1.0, 2);

    // advance past the blend duration → output equals the new pose
    const atEnd = applyInertialize(inert, newPose, 0.3);
    expect(angleOf(atEnd)).toBeCloseTo(0.0, 2);
  });

  it("offset magnitude decreases monotonically", () => {
    const oldPose = new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 } as any, 1.2);
    const newPose = new Quaternion();
    const inert = startInertialize(oldPose, newPose, 0.5);
    let prev = Infinity;
    for (let i = 0; i <= 5; i++) {
      const out = applyInertialize(inert, newPose, 0.1);
      const a = angleOf(out);
      expect(a).toBeLessThanOrEqual(prev + 1e-6);
      prev = a;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/inertialization.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/features/stage/locomotion/motion-matching/inertialization.ts
import { Quaternion } from "three";

/**
 * Quaternion inertializer. Holds the offset between where the pose WAS and where
 * the new clip wants it, and decays that offset to identity over `duration`.
 * applyInertialize returns target * decayedOffset, so the output eases from the
 * old pose into the new clip pose.
 */
export interface Inertializer {
  /** offset = oldPose * newPose^-1 (the rotation from new back to old). */
  readonly offset: Quaternion;
  remaining: number;
  readonly duration: number;
}

const _invNew = new Quaternion();
const _decayed = new Quaternion();
const _identity = new Quaternion();

export function startInertialize(
  oldPose: Quaternion,
  newPose: Quaternion,
  duration: number,
): Inertializer {
  _invNew.copy(newPose).invert();
  const offset = oldPose.clone().multiply(_invNew); // oldPose * newPose^-1
  return { offset, remaining: duration, duration };
}

/**
 * Advance the blend by `dt` and return the visible pose: the new clip target
 * with the decaying offset applied. At remaining=duration → old pose; at
 * remaining<=0 → exactly the target.
 */
export function applyInertialize(
  inert: Inertializer,
  target: Quaternion,
  dt: number,
): Quaternion {
  inert.remaining = Math.max(0, inert.remaining - dt);
  const blend = inert.duration > 0 ? inert.remaining / inert.duration : 0; // 1→0
  // decayedOffset = slerp(identity, offset, blend)
  _decayed.copy(_identity).slerp(inert.offset, blend);
  return target.clone().premultiply(_decayed);
}
```

> Note on the test: `applyInertialize(inert, newPose, 0)` with `remaining===duration`
> gives `blend=1`, so `_decayed === offset` and the result is
> `newPose * (oldPose*newPose^-1)`... evaluate ordering: we want the result to
> equal `oldPose` at start. With premultiply, result = decayed * target =
> (oldPose*newPose^-1) * newPose = oldPose. Correct.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/inertialization.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/stage/locomotion/motion-matching/inertialization.ts src/lib/features/stage/locomotion/motion-matching/inertialization.test.ts
git commit -m "feat(mm-locomotion): quaternion inertialization blend" -- src/lib/features/stage/locomotion/motion-matching/inertialization.ts src/lib/features/stage/locomotion/motion-matching/inertialization.test.ts
```

---

### Phase 1 gate

- [ ] Run the four files together:
`npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/`
Expected: all PASS. Phase 1 is shippable, testable software with zero external deps.

---

## PHASE 2 — Controller + clip sampling + foot-lock

Phase 2 touches `@austencloud/scene-3d` (`PerformerRig`, `RootMotionExtractor`)
and the local `solveLegIK` / `contact-curve-cache`. Some accessors are not
visible from this repo, so Phase 2 begins with a confirmation task — these are
real read actions, not placeholders.

### Task 6: Confirm integration interfaces (read-only)

**Files (read):**
- `node_modules/@austencloud/scene-3d/dist/lib/components/PerformerRig.svelte.d.ts`
- `node_modules/@austencloud/scene-3d/dist/lib/services/contracts/IRootMotionExtractor.d.ts`
- `node_modules/@austencloud/scene-3d/dist/lib/services/implementations/RootMotionExtractor.js`
- `node_modules/@austencloud/scene-3d/dist/lib/services/contracts/ILegIKSolver.d.ts` (for `LegIKInput` / `BoneChain` shape)
- `src/lib/shared/3d/components/Viewer3DScene.svelte` (how the rig + mixer are exposed to a useTask consumer)

- [ ] **Step 1:** Read each file. Record, in a scratch comment block at the top of `mm-locomotion-controller.ts`, the exact signatures for:
  - How to obtain the performer's skeleton root `Object3D` and look up bones by canonical name (`Hips`, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, right equivalents).
  - The `RootMotionExtractor` constructor + per-frame call that yields `{ x, z, yawDelta }`.
  - The `BoneChain` shape required by `LegIKInput` (`root`, `middle`, `effector`, `upperLength`, `lowerLength`, plus rest-dir fields used by `computeKneeHingeAxis`).
- [ ] **Step 2:** If any accessor is missing (e.g. the rig does not expose bones), STOP and surface to the user with the exact gap. Do not fabricate an API.

### Task 7: Clip sampler (rig-backed `PoseSampler`)

**Files:**
- Create: `src/lib/features/stage/locomotion/motion-matching/clip-sampler.ts`

Wraps an `AnimationMixer` + a cloned skeleton to implement `PoseSampler`
(`(clipId, time) => PoseSample`) for use by `buildMotionDatabase` at load time,
and to sample the live pose each frame. Uses the bone accessors confirmed in
Task 6.

- [ ] **Step 1:** Implement `createClipSampler(rigRoot, clips)` that:
  - Loads each GLB via `GLTFLoader` (mirroring `LocomotionController.initialize`,
    `locomotion-controller.ts:34-54`), keyed by `clipId`.
  - Exposes `sample(clipId, time): PoseSample` by setting the action `.time`,
    calling `mixer.update(0)`, `rigRoot.updateMatrixWorld(true)`, then reading
    `Hips`, `LeftFoot`, `RightFoot` world positions and converting feet to
    hip-local; reads root facing from the `Hips` Y-rotation and `rootXZ` from
    `Hips` world X/Z.
  - Exposes `sampleClipMap(): ClipSpec[]` (clipId + durationSec) for the extractor.
- [ ] **Step 2:** Manual sanity: log the database size built from
  `[idle, walk-forward, turn-left, turn-right]`. Expected: a few hundred frames,
  `features.length === frames.length * 24`.
- [ ] **Step 3: Commit**

```bash
git add src/lib/features/stage/locomotion/motion-matching/clip-sampler.ts
git commit -m "feat(mm-locomotion): rig-backed clip sampler for feature extraction" -- src/lib/features/stage/locomotion/motion-matching/clip-sampler.ts
```

### Task 8: MM controller (search + inertialization, no foot-lock yet)

**Files:**
- Create: `src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts`

- [ ] **Step 1:** Implement `MmLocomotionController` with the drop-in surface:
  - `async initialize(rigRoot)` — build sampler + database (`buildMotionDatabase`).
  - `setTargetFacing(rad)`, `setTargetPosition(x, z)`, `stepBackToOrigin()`.
  - `update(dt)` — per frame:
    1. `buildTrajectoryQuery(current, target, 1.0)`.
    2. Assemble the full query `Float32Array(24)`: pose columns [0..14] from the
       current sampled pose; trajectory columns [15..23] from the query.
    3. Every 3rd frame, `searchNearest(db, query)` → `{ clipId, time }`. If it
       differs from the playing frame, `startInertialize` per tracked joint
       (Hips + legs + spine) capturing current vs new-clip quaternions.
    4. Advance the chosen clip; for each tracked joint apply `applyInertialize`.
    5. Apply `RootMotionExtractor` delta (x, z, yawDelta) to `current`.
  - `get state(): LocomotionState` (`{ position, facing, speed, isMoving }`,
    matching `locomotion-controller.ts:9-14`).
- [ ] **Step 2:** Manual: drive `setTargetFacing(Math.PI/2)` on the test page
  (Task 10) and confirm a smooth turn with NO pop. (Foot slide still expected —
  fixed in Task 9.)
- [ ] **Step 3: Commit** (pathspec: the controller file only).

### Task 9: Foot-lock pass

**Files:**
- Modify: `src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts`

- [ ] **Step 1:** At controller init, build a `ContactCurveCache`
  (`createContactCurveCache`) and `registerCurve` for any clip with a sidecar
  (none yet → velocity fallback). Compute `kneeHingeAxis` per leg once via
  `computeKneeHingeAxis(upLegRestDir, legRestDir)` using the rest-dir fields from
  Task 6.
- [ ] **Step 2:** In `update`, after pose application, per foot:
  - `getContactAt(cache, clipId, phase)`; if `!hasCurve`, derive contact from the
    sampled foot vertical velocity (planted when `|vy| < 0.05`).
  - On rising contact, freeze the foot's current world position as `footTarget`.
  - While planted, call `solveLegIK({ chain, footTarget, kneeHingeAxis, weight: contact, groundNormal: (0,1,0), footForward: current-forward, poleDirection: forward })`.
  - On falling contact, ramp `weight`→0.
- [ ] **Step 3: Verify (runtime, objective).** On the test page, via Chrome
  DevTools `evaluate_script`, capture the locked foot's world position across a
  90° turn and compute variance while contact=1.
  **Pass: variance < 1e-3 m².** Record the number in the commit message.
- [ ] **Step 4: Commit** (pathspec: controller file only).

---

## PHASE 3 — Test page + step-back + verification

### Task 10: Test page

**Files:**
- Create: `src/routes/test/mm-locomotion/+page.svelte`

- [ ] **Step 1:** Mount the real `Viewer3DScene` with one performer. Add a
  `SegmentedControl` (import from `src/lib/shared/3d/components/controls/SegmentedControl.svelte`)
  with options −90/−45/0/+45/+90 calling `controller.setTargetFacing(deg*PI/180)`,
  and a "Step back to origin" `<button>` calling `controller.stepBackToOrigin()`.
  Drive `controller.update(dt)` from the scene's `useTask` loop.
- [ ] **Step 2:** Confirm dev server serves it:
  `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/mm-locomotion` → `200`.
- [ ] **Step 3: Commit** (pathspec: the page file only).

### Task 11: Step-back + final verification

- [ ] **Step 1:** Verify `stepBackToOrigin()` returns the performer to start
  facing + position (the controller records origin at `initialize`).
- [ ] **Step 2:** Runtime proof via DevTools: screenshot a mid-turn pose; re-run
  the foot-variance eval after a full reorient + step-back cycle. Paste both into
  the final report.
- [ ] **Step 3:** Full gate before "done":
  - `npx vitest run --config tests/config/vitest.config.ts src/lib/features/stage/locomotion/motion-matching/` → all PASS.
  - `npm run check` (one cold run) → no new errors in the new files.
- [ ] **Step 4: Commit** any remaining changes (explicit pathspec).

---

## Known Gap (carried from spec)

Existing clips cover idle/walk + ±90° turns. In-between target angles → `search`
returns the nearest frame → residual slide until richer pivot vocab is captured
(FreeMoCap, $0). This slice proves the mechanism; angle coverage is a later
data-only fill, no controller code change.

## Self-Review Notes (author)

- Spec coverage: feature-extractor (Task 2), search (Task 3), trajectory (Task 4),
  inertialization (Task 5), controller (Task 8), foot-lock reuse (Task 9), test
  page (Task 10), step-back (Task 11), verification surface (Tasks 9/11). All spec
  sections mapped.
- Type consistency: `MotionDatabase`/`MotionFrame`/`FEATURE_STRIDE`/`PoseSample`
  defined in Task 1, used identically in Tasks 2–9. `LocomotionState` shape
  mirrors `locomotion-controller.ts`.
- Genuine unknowns (rig bone access, RootMotionExtractor call) are gated behind
  Task 6 read-and-confirm with an explicit STOP-if-missing — not faked.
