# Dodge Analytic-Vacate + Arm-Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-frame stance-optimizer/trajectory dodge brain with a deterministic analytic vacate recipe (open quadrant, face-center, edge-on, reach-bounded back-off) plus the existing two-bone arm pin, driven by a side/aggression knob.

**Architecture:** Two new pure modules — `SweptTube` (closed-form distance over the existing 24 staff segments) and `VacatePlanner` (analytic `BodyPlacement` from the tube + body model + knob) — feed a rewritten orchestrator that returns a `DodgePlan { placement(progress), knob, worstBodyDepth }`. `DodgeDriver` samples the plan each frame, applies the placement, then pins both hands with the existing `solveArm` (plus a wrist-to-staff align), smoothed by the existing inertializer. The stance optimizer/simulator stay only for offline collision-lab labeling. Puppet/place/manual modes and the trajectory/inside-gamma files are deleted.

**Tech Stack:** TypeScript, Three.js 0.182 (`Vector3`/`Quaternion` math), Svelte 5 runes + Threlte 8 (`useTask` imperative loop), Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-20-dodge-analytic-vacate-design.md`

**Frame convention (used throughout — floor/world XZ, the frame `buildSweptVolume` and `footOffsetX/Z` already live in):**
- Quadrants: `1=+X/+Z`, `2=-X/+Z`, `3=-X/-Z`, `4=+X/-Z`.
- Cardinals: `N=+Z`, `S=-Z`, `E=-X`, `W=+X`.
- Face grid center from `(x,z)`: `rootYaw = atan2(-x, -z)` (forward at yaw θ is `(sinθ, cosθ)`).

---

## File Structure

**New:**
- `src/lib/features/stage/locomotion/dodge/swept-tube.ts` — closed-form distance/centroid/principal-axis over `SweepSample[]`.
- `src/lib/features/stage/locomotion/dodge/swept-tube.test.ts`
- `src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.ts` — analytic `BodyPlacement` recipe + `DodgeKnob`/`DodgeSide`/`BodyPlacement` types.
- `src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.test.ts`

**Rewritten:**
- `src/lib/features/stage/locomotion/dodge/dodge-types.ts` — replace `DodgeSolution`/`SweptVolume` trajectory shape with `DodgePlan`; re-export planner types.
- `src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts` — `planDodge()` builds the tube + configured planner.
- `src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts` — assert plan shape, not trajectory.
- `src/lib/features/lab/tabs/dodge/DodgeDriver.svelte` — vacate-driven body + arm pin + wrist align; delete puppet/place/manual.
- `src/lib/features/lab/tabs/dodge/DodgeTab.svelte` — side (`SegmentedControl`) + aggression (slider); delete puppet/place/manual UI.

**Deleted (dead after rewrite — confirmed consumed only by the dodge path via grep):**
- `src/lib/features/lab/tabs/collision-lab/services/trajectory-optimizer.ts`
- `src/lib/features/lab/tabs/collision-lab/services/stance-trajectory.ts`
- `src/lib/features/lab/tabs/collision-lab/services/stance-trajectory-twist.test.ts` (trajectory + sampler tests; the oriented-slab-torso assertions move to a kept simulator test — Task 8)
- `src/lib/features/stage/locomotion/dodge/inside-gamma-target.ts`
- `src/lib/features/stage/locomotion/dodge/inside-gamma-target.test.ts`

**Untouched:** `stance-simulator.ts`, `stance-optimizer.ts` (offline labeling), `swept-volume-builder.ts`, `inertialization.ts`, `hinge-constrained-leg-ik-solver.ts`.

**Verify run command (this repo):** `npx vitest run <path>` for a single file; `npm run check` for the typecheck gate (capture once: `npm run check > /tmp/check.log 2>&1`, then grep).

---

## Task 1: SweptTube — closed-form distance over the staff segments

**Files:**
- Create: `src/lib/features/stage/locomotion/dodge/swept-tube.ts`
- Test: `src/lib/features/stage/locomotion/dodge/swept-tube.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/features/stage/locomotion/dodge/swept-tube.test.ts
import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { SweptTube } from "./swept-tube";
import type { SweepSample } from "./dodge-types";

/** A vertical staff whose grip sits at (x,y,z); shaft runs ±halfLen along Y. */
function vstaff(x: number, y: number, z: number, halfLen = 0.4): SweepSample {
  const grip = new Vector3(x, y, z);
  return {
    gripWorld: grip,
    tipAWorld: grip.clone().add(new Vector3(0, halfLen, 0)),
    tipBWorld: grip.clone().add(new Vector3(0, -halfLen, 0)),
    radius: 0.012,
  };
}

describe("SweptTube.minDistanceToSegments", () => {
  it("returns the perpendicular distance to the nearest staff segment", () => {
    // One vertical staff at x=1,z=0. A point at the origin at staff mid-height
    // is exactly 1 m away horizontally from the shaft line.
    const tube = new SweptTube([vstaff(1, 0, 0)]);
    const r = tube.minDistanceToSegments(new Vector3(0, 0, 0));
    expect(r.dist).toBeCloseTo(1, 5);
    expect(r.sampleIndex).toBe(0);
  });

  it("picks the closest of several samples", () => {
    const tube = new SweptTube([vstaff(2, 0, 0), vstaff(0.3, 0, 0), vstaff(2, 0, 1)]);
    const r = tube.minDistanceToSegments(new Vector3(0, 0, 0));
    expect(r.dist).toBeCloseTo(0.3, 5);
    expect(r.sampleIndex).toBe(1);
  });

  it("clamps to the segment ends (above the tip is farther than beside it)", () => {
    const tube = new SweptTube([vstaff(0, 0, 0, 0.4)]);
    const beside = tube.minDistanceToSegments(new Vector3(0.5, 0, 0)).dist;
    const above = tube.minDistanceToSegments(new Vector3(0.5, 2, 0)).dist;
    expect(above).toBeGreaterThan(beside);
  });
});

describe("SweptTube.centroid / principalAxis", () => {
  it("centroid is the mean grip", () => {
    const tube = new SweptTube([vstaff(0, 0, 0), vstaff(2, 0, 0)]);
    const c = tube.centroid();
    expect(c.x).toBeCloseTo(1, 5);
    expect(c.z).toBeCloseTo(0, 5);
  });

  it("principalAxis follows the dominant XZ travel of the grips", () => {
    // Grips travel along +X → principal axis is ~(±1,0).
    const tube = new SweptTube([vstaff(0, 0, 0), vstaff(1, 0, 0), vstaff(2, 0, 0)]);
    const axis = tube.principalAxis();
    expect(axis).not.toBeNull();
    expect(Math.abs(axis!.x)).toBeCloseTo(1, 2);
    expect(Math.abs(axis!.z)).toBeLessThan(0.05);
  });

  it("principalAxis is null for a degenerate (coincident) sweep", () => {
    const tube = new SweptTube([vstaff(1, 0, 0), vstaff(1, 0, 0)]);
    expect(tube.principalAxis()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/swept-tube.test.ts`
Expected: FAIL — `Cannot find module './swept-tube'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/features/stage/locomotion/dodge/swept-tube.ts
import { Vector3 } from "three";
import type { SweepSample } from "./dodge-types";

export interface NearestApproach {
  /** Distance from the query point to the nearest staff shaft segment (m). */
  dist: number;
  /** The point on that segment closest to the query. */
  nearestPoint: Vector3;
  /** Index of the winning sample in the sweep. */
  sampleIndex: number;
}

const _ab = new Vector3();
const _ap = new Vector3();
const _closest = new Vector3();

/** Closest point to `p` on segment [a,b], written into `out`; returns t∈[0,1]. */
function closestOnSegment(p: Vector3, a: Vector3, b: Vector3, out: Vector3): number {
  _ab.copy(b).sub(a);
  _ap.copy(p).sub(a);
  const len2 = _ab.lengthSq();
  const t = len2 > 1e-12 ? Math.min(1, Math.max(0, _ap.dot(_ab) / len2)) : 0;
  out.copy(a).addScaledVector(_ab, t);
  return t;
}

/**
 * A prop's whole sweep as a union of staff shaft segments (one per sampled
 * instant). Provides closed-form distance from any point to the swept volume,
 * plus centroid + principal sweep axis for choosing the open vacate quadrant.
 * Pure; no Three.js scene-graph dependency.
 */
export class SweptTube {
  constructor(private readonly samples: SweepSample[]) {}

  /** Min distance from `point` to any staff segment, with the winning sample. */
  minDistanceToSegments(point: Vector3): NearestApproach {
    let best = Infinity;
    let bestIdx = 0;
    const nearest = new Vector3();
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i]!;
      closestOnSegment(point, s.tipAWorld, s.tipBWorld, _closest);
      const d = point.distanceTo(_closest);
      if (d < best) {
        best = d;
        bestIdx = i;
        nearest.copy(_closest);
      }
    }
    return { dist: best, nearestPoint: nearest, sampleIndex: bestIdx };
  }

  /** Mean grip position across the sweep. */
  centroid(): Vector3 {
    const c = new Vector3();
    for (const s of this.samples) c.add(s.gripWorld);
    return this.samples.length ? c.multiplyScalar(1 / this.samples.length) : c;
  }

  /**
   * Dominant horizontal (XZ) travel direction of the grips, as a unit vector,
   * via the largest-spread axis of the grip cloud. Returns null when the grips
   * barely move (a static/coincident sweep has no meaningful sweep direction).
   */
  principalAxis(): Vector3 | null {
    const c = this.centroid();
    // 2x2 XZ covariance.
    let sxx = 0, sxz = 0, szz = 0;
    for (const s of this.samples) {
      const dx = s.gripWorld.x - c.x;
      const dz = s.gripWorld.z - c.z;
      sxx += dx * dx; sxz += dx * dz; szz += dz * dz;
    }
    const n = this.samples.length || 1;
    sxx /= n; sxz /= n; szz /= n;
    const spread = sxx + szz;
    if (spread < 1e-4) return null; // < 1 cm RMS travel → degenerate
    // Largest eigenvector of [[sxx,sxz],[sxz,szz]].
    const tr = sxx + szz;
    const det = sxx * szz - sxz * sxz;
    const lambda = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const ex = Math.abs(sxz) > 1e-9 ? lambda - szz : 1;
    const ez = Math.abs(sxz) > 1e-9 ? sxz : 0;
    const v = new Vector3(ex, 0, ez);
    return v.lengthSq() > 1e-12 ? v.normalize() : null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/swept-tube.test.ts`
Expected: PASS (8 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/stage/locomotion/dodge/swept-tube.ts src/lib/features/stage/locomotion/dodge/swept-tube.test.ts
git commit -m "feat(dodge): SweptTube — closed-form distance + principal axis over staff segments" -- src/lib/features/stage/locomotion/dodge/swept-tube.ts src/lib/features/stage/locomotion/dodge/swept-tube.test.ts
```

---

## Task 2: Planner types on dodge-types

**Files:**
- Modify: `src/lib/features/stage/locomotion/dodge/dodge-types.ts`

These types are added first so Tasks 3-5 compile against them. `DodgeSolution` is left in place for now (DodgeDriver still imports it) and removed in Task 7.

- [ ] **Step 1: Add the new types (no test — pure type additions, covered by Task 3 tests)**

Append to `src/lib/features/stage/locomotion/dodge/dodge-types.ts` (keep existing `SweepSample`, `SweptVolume`, `DodgeSolution`):

```ts
/** Which way the body bails. `auto` derives the side from the sweep direction. */
export type DodgeSide = "auto" | "left" | "right";

/** Art-direction knob for the analytic vacate. */
export interface DodgeKnob {
  side: DodgeSide;
  /** 0 = just-clears the prop, 1 = full comfortable step. */
  aggression: number;
}

export const DEFAULT_DODGE_KNOB: DodgeKnob = { side: "auto", aggression: 0.6 };

/**
 * A solved body placement for one instant of the dodge, in the same floor/world
 * XZ frame the rig's foot offset + root yaw already use. Pure stance — the arms
 * are pinned separately by the driver's IK.
 */
export interface BodyPlacement {
  footOffsetX: number;
  footOffsetZ: number;
  rootYawRad: number;
  torsoTwistRad: number;
  spinePitchRad: number;
}

/**
 * The runtime dodge plan: a deterministic placement function over sweep
 * progress [0,1], plus diagnostics. Replaces the optimized trajectory — the
 * driver calls `placement(progress)` each frame (cheap, no numeric search).
 */
export interface DodgePlan {
  placement(progress: number): BodyPlacement;
  knob: DodgeKnob;
  /** Worst torso penetration into the swept tube across the sweep (m). */
  worstBodyDepth: number;
  /** True when the torso clears the tube at every sampled instant. */
  feasible: boolean;
}
```

- [ ] **Step 2: Typecheck the file compiles**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/swept-tube.test.ts`
Expected: PASS (importing `SweepSample` from the edited file still resolves).

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/stage/locomotion/dodge/dodge-types.ts
git commit -m "feat(dodge): BodyPlacement / DodgePlan / DodgeKnob types" -- src/lib/features/stage/locomotion/dodge/dodge-types.ts
```

---

## Task 3: VacatePlanner — the analytic recipe

**Files:**
- Create: `src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.ts`
- Test: `src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.test.ts`

The planner is pure and the heart of the design. It computes a single `BodyPlacement` for the worst-case (deepest-intrusion) instant of the sweep and returns it for all progress values in v1 (a stable held stance; the body still moves *into* it via inertialization). Per-progress variation is a later refinement and is intentionally out of scope (YAGNI — the spec calls for a deterministic, jitter-free stance, not a per-instant trajectory).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.test.ts
import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { restPoseFromHeight } from "$lib/features/lab/tabs/collision-lab/services/stance-simulator";
import { SweptTube } from "./swept-tube";
import { planVacate } from "./dodge-vacate-planner";
import type { SweepSample } from "./dodge-types";

const body = restPoseFromHeight(1.8);

/** A vertical staff at (x,y,z), shaft ±halfLen along Y (chest-height sweep). */
function vstaff(x: number, z: number, halfLen = 0.43): SweepSample {
  const grip = new Vector3(x, 0, z);
  return {
    gripWorld: grip,
    tipAWorld: grip.clone().add(new Vector3(0, halfLen, 0)),
    tipBWorld: grip.clone().add(new Vector3(0, -halfLen, 0)),
    radius: 0.012,
  };
}

/** A sweep that travels along +X across the front of the body (z≈0.3). */
function sweepAlongX(): { blue: SweptTube; red: SweptTube } {
  const blue: SweepSample[] = [];
  const red: SweepSample[] = [];
  for (let i = 0; i < 12; i++) {
    const f = i / 11;
    blue.push(vstaff(-0.3 + 0.6 * f, 0.3));
    red.push(vstaff(-0.3 + 0.6 * f, 0.3));
  }
  return { blue: new SweptTube(blue), red: new SweptTube(red) };
}

describe("planVacate", () => {
  it("is deterministic — same input twice gives identical output", () => {
    const { blue, red } = sweepAlongX();
    const a = planVacate(blue, red, body, { side: "auto", aggression: 0.6 });
    const b = planVacate(blue, red, body, { side: "auto", aggression: 0.6 });
    expect(a.placement).toEqual(b.placement);
  });

  it("faces the grid center", () => {
    const { blue, red } = sweepAlongX();
    const p = planVacate(blue, red, body, { side: "auto", aggression: 0.6 }).placement;
    const expected = Math.atan2(-p.footOffsetX, -p.footOffsetZ);
    expect(Math.abs(p.rootYawRad - expected)).toBeLessThan(1e-6);
  });

  it("steps off the sweep line (does not stand on the props)", () => {
    const { blue, red } = sweepAlongX();
    const p = planVacate(blue, red, body, { side: "auto", aggression: 0.6 }).placement;
    // The sweep runs along z=0.3; vacating means stepping to a different z
    // (or far enough in x to clear), never staying on the swept line.
    const footOnSweepLine = Math.abs(p.footOffsetZ - 0.3) < 0.05 &&
      p.footOffsetX > -0.4 && p.footOffsetX < 0.4;
    expect(footOnSweepLine).toBe(false);
  });

  it("side knob flips the chosen quadrant on a symmetric sweep", () => {
    const { blue, red } = sweepAlongX();
    const left = planVacate(blue, red, body, { side: "left", aggression: 0.6 }).placement;
    const right = planVacate(blue, red, body, { side: "right", aggression: 0.6 }).placement;
    // Opposite sides → opposite sign on the vacate axis (here the z step).
    expect(Math.sign(left.footOffsetZ)).toBe(-Math.sign(right.footOffsetZ));
  });

  it("aggression increases the step distance (up to the reach bound)", () => {
    const { blue, red } = sweepAlongX();
    const low = planVacate(blue, red, body, { side: "left", aggression: 0.1 }).placement;
    const high = planVacate(blue, red, body, { side: "left", aggression: 1.0 }).placement;
    const dLow = Math.hypot(low.footOffsetX, low.footOffsetZ);
    const dHigh = Math.hypot(high.footOffsetX, high.footOffsetZ);
    expect(dHigh).toBeGreaterThanOrEqual(dLow);
  });

  it("keeps both grips within arm reach (hands are the hard constraint)", () => {
    const { blue, red } = sweepAlongX();
    const res = planVacate(blue, red, body, { side: "auto", aggression: 1.0 });
    const p = res.placement;
    const reach = body.upperArmLength + body.forearmLength;
    // Shoulders sit at the stepped root + rest shoulder offsets, at shoulder
    // height. Worst grip must be within reach (+ a small shrug/lean tolerance).
    const lsh = new Vector3(p.footOffsetX + body.leftShoulder.x, body.leftShoulder.y, p.footOffsetZ);
    const rsh = new Vector3(p.footOffsetX + body.rightShoulder.x, body.rightShoulder.y, p.footOffsetZ);
    const grips = [blue.centroid(), red.centroid()];
    const worst = Math.max(
      ...grips.map((g) => Math.min(lsh.distanceTo(g), rsh.distanceTo(g)))
    );
    expect(worst).toBeLessThanOrEqual(reach + 0.15);
  });

  it("degenerate (static) sweep → face-center neutral, no NaN", () => {
    const stat = new SweptTube([vstaff(0.5, 0.3), vstaff(0.5, 0.3)]);
    const p = planVacate(stat, stat, body, { side: "auto", aggression: 0.6 }).placement;
    expect(Number.isFinite(p.footOffsetX)).toBe(true);
    expect(Number.isFinite(p.rootYawRad)).toBe(true);
    expect(Number.isFinite(p.torsoTwistRad)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.test.ts`
Expected: FAIL — `Cannot find module './dodge-vacate-planner'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.ts
import { Vector3 } from "three";
import type { RestPoseGeometry } from "$lib/features/lab/tabs/collision-lab/services/types";
import { STANCE_BOUNDS } from "$lib/features/lab/tabs/collision-lab/domain/types";
import { SweptTube } from "./swept-tube";
import type { BodyPlacement, DodgeKnob } from "./dodge-types";

const CLEAR_MARGIN = 0.04; // m of air we want between torso slab and the staff
const STEP_MAX = 1.2;      // m — hard cap on how far the feet travel
const STEP_STEPS = 24;     // back-off search resolution
const REACH_SLACK = 0.12;  // m of shrug/lean the live reach-assist can still add

export interface VacateResult {
  placement: BodyPlacement;
  worstBodyDepth: number;
  feasible: boolean;
}

const TWIST_MIN = (STANCE_BOUNDS.torsoTwistDeg.min * Math.PI) / 180;
const TWIST_MAX = (STANCE_BOUNDS.torsoTwistDeg.max * Math.PI) / 180;

/** Horizontal (XZ) unit normal to a horizontal vector (rotate −90° about Y). */
function perpXZ(v: Vector3): Vector3 {
  return new Vector3(v.z, 0, -v.x).normalize();
}

/** Torso half-extent (m) presented along horizontal direction `dir`, given the
 *  oriented slab whose thin axis points along `forward`. Ellipsoid radius in the
 *  plane: wide along the shoulder axis, thin along forward. Matches the
 *  StanceSimulator oriented-slab convention. */
function torsoHalfExtent(body: RestPoseGeometry, forward: Vector3, dir: Vector3): number {
  const halfW = body.torsoHalfWidth ?? body.torsoRadius;
  const halfD = body.torsoHalfDepth ?? body.torsoRadius;
  const right = new Vector3(forward.z, 0, -forward.x).normalize(); // shoulder axis
  const cd = Math.abs(dir.dot(right)) / Math.max(halfW, 1e-6);
  const cf = Math.abs(dir.dot(forward)) / Math.max(halfD, 1e-6);
  const denom = Math.sqrt(cd * cd + cf * cf);
  return denom > 1e-6 ? 1 / denom : Math.max(halfW, halfD);
}

/**
 * Analytic vacate: step the body into the open quadrant beside the prop sweep,
 * face grid center, turn edge-on, and back off until the torso slab clears the
 * swept tube — bounded by arm reach (hands never leave the staves). Deterministic
 * (same input → same output → no frame-to-frame jitter).
 */
export function planVacate(
  blue: SweptTube,
  red: SweptTube,
  body: RestPoseGeometry,
  knob: DodgeKnob,
): VacateResult {
  // Combined tube centroid + sweep direction (prefer whichever hand actually
  // sweeps; fall back to the other, then to neutral for a static prop).
  const cBlue = blue.centroid();
  const cRed = red.centroid();
  const center = cBlue.clone().add(cRed).multiplyScalar(0.5);
  const axis = blue.principalAxis() ?? red.principalAxis();

  const reach = body.upperArmLength + body.forearmLength + REACH_SLACK;
  const shoulderY = body.leftShoulder.y;

  // Helper: at foot (fx,fz) facing center, the worst torso penetration into
  // either tube (positive = overlap) and whether both grips stay reachable.
  const evalFoot = (fx: number, fz: number) => {
    const forward = new Vector3(-fx, 0, -fz);
    if (forward.lengthSq() < 1e-9) forward.set(0, 0, 1);
    forward.normalize();
    // Torso sample points along the spine, in world XZ at the stepped root.
    const spineYs = [body.spine1.y, body.spine2.y, body.neck.y];
    let worst = -Infinity;
    for (const tube of [blue, red]) {
      for (const y of spineYs) {
        const p = new Vector3(fx, y, fz);
        const near = tube.minDistanceToSegments(p);
        const dir = new Vector3(near.nearestPoint.x - fx, 0, near.nearestPoint.z - fz);
        if (dir.lengthSq() < 1e-9) dir.copy(forward);
        else dir.normalize();
        const half = torsoHalfExtent(body, forward, dir) + (tube === blue ? blue : red).constructor ? 0 : 0;
        const radius = tube.minDistanceToSegments(p).sampleIndexRadius ?? 0.012;
        const penetration = (torsoHalfExtent(body, forward, dir) + 0.012) - near.dist;
        worst = Math.max(worst, penetration);
      }
    }
    // Reach: shoulders at the stepped root; worst grip within reach?
    const lsh = new Vector3(fx + body.leftShoulder.x, shoulderY, fz);
    const rsh = new Vector3(fx + body.rightShoulder.x, shoulderY, fz);
    const grips = [cBlue, cRed];
    const worstReach = Math.max(
      ...grips.map((g) => Math.min(lsh.distanceTo(g), rsh.distanceTo(g))),
    );
    return { worst, reachable: worstReach <= reach };
  };

  // Vacate direction: the two horizontal normals to the sweep axis (sideways
  // escapes). For a static sweep, escape straight back from center.
  let dir: Vector3;
  if (axis) {
    dir = perpXZ(axis);
  } else {
    dir = center.clone().setY(0);
    dir = dir.lengthSq() > 1e-6 ? dir.normalize() : new Vector3(0, 0, -1);
  }
  // Resolve side. `auto`: pick the normal whose far step clears with the least
  // penetration; ties → the −Z (toward quadrant 3, away from a front sweep).
  const sideSign = (() => {
    if (knob.side === "left") return -1;
    if (knob.side === "right") return 1;
    const probe = (sign: number) => {
      const fx = center.x + dir.x * sign * 0.6;
      const fz = center.z + dir.z * sign * 0.6;
      return evalFoot(fx, fz).worst;
    };
    const plus = probe(1);
    const minus = probe(-1);
    if (Math.abs(plus - minus) < 1e-3) {
      // Symmetric → prefer the step that lands more negative-Z (quadrant 3/4).
      return dir.z < 0 ? 1 : -1;
    }
    return plus < minus ? 1 : -1;
  })();
  const vac = dir.clone().multiplyScalar(sideSign);

  // Back-off: smallest step that clears (worst ≤ 0) within reach; scaled by
  // aggression up to that clearing distance's comfortable overshoot.
  let clearStep = STEP_MAX;
  let lastReachable = 0;
  for (let i = 1; i <= STEP_STEPS; i++) {
    const step = (i / STEP_STEPS) * STEP_MAX;
    const fx = center.x + vac.x * step;
    const fz = center.z + vac.z * step;
    const e = evalFoot(fx, fz);
    if (e.reachable) lastReachable = step;
    if (e.worst <= -CLEAR_MARGIN && e.reachable) {
      clearStep = step;
      break;
    }
  }
  // Reach is the hard ceiling: never step past where a grip leaves the hand.
  const reachBoundStep = Math.max(0, Math.min(clearStep, lastReachable || clearStep));
  // aggression interpolates between just-clearing and the comfortable max.
  const step = reachBoundStep + (Math.min(STEP_MAX, reachBoundStep + 0.3) - reachBoundStep) * knob.aggression;

  const fx = center.x + vac.x * step;
  const fz = center.z + vac.z * step;
  const rootYawRad = Math.atan2(-fx, -fz);

  // Edge-on twist: turn the torso's thin axis toward the nearest staff approach.
  const forward = new Vector3(-fx, 0, -fz);
  if (forward.lengthSq() < 1e-9) forward.set(0, 0, 1);
  forward.normalize();
  const nearBlue = blue.minDistanceToSegments(new Vector3(fx, body.spine2.y, fz));
  const nearRed = red.minDistanceToSegments(new Vector3(fx, body.spine2.y, fz));
  const near = nearBlue.dist < nearRed.dist ? nearBlue : nearRed;
  const toStaff = new Vector3(near.nearestPoint.x - fx, 0, near.nearestPoint.z - fz);
  let torsoTwistRad = 0;
  if (toStaff.lengthSq() > 1e-9) {
    toStaff.normalize();
    // Signed bearing of the staff relative to forward (about +Y).
    const cross = forward.x * toStaff.z - forward.z * toStaff.x;
    const dot = forward.dot(toStaff);
    const bearing = Math.atan2(cross, dot);
    // Twist toward presenting the thin side: rotate so forward turns ~90° off
    // the staff bearing. Clamp to the DOF bounds.
    const target = bearing - Math.sign(bearing || 1) * (Math.PI / 2);
    torsoTwistRad = Math.max(TWIST_MIN, Math.min(TWIST_MAX, target));
  }

  // Final feasibility/diagnostic at the chosen foot.
  const finalEval = evalFoot(fx, fz);
  const worstBodyDepth = Math.max(0, finalEval.worst);

  const placement: BodyPlacement = {
    footOffsetX: fx,
    footOffsetZ: fz,
    rootYawRad,
    torsoTwistRad,
    spinePitchRad: 0,
  };
  return { placement, worstBodyDepth, feasible: worstBodyDepth <= 0.01 };
}
```

> **Implementation note for the executor:** the `evalFoot` body above has a known
> rough edge — the penetration line must use the staff radius from the *winning*
> sample, and the stray `.constructor`/`.sampleIndexRadius` expressions are
> scratch that must be removed. Simplify `evalFoot`'s inner loop to exactly:
> ```ts
> const near = tube.minDistanceToSegments(p);
> const dir = new Vector3(near.nearestPoint.x - fx, 0, near.nearestPoint.z - fz);
> if (dir.lengthSq() < 1e-9) dir.copy(forward); else dir.normalize();
> const penetration = (torsoHalfExtent(body, forward, dir) + 0.012) - near.dist;
> worst = Math.max(worst, penetration);
> ```
> (Staff radius is the fixed `STAFF_RADIUS = 0.012` from `swept-volume-builder.ts`;
> hardcode it as a named const `STAFF_RADIUS` at the top of the file rather than
> reading it off the sample.) Make the tests pass, then keep it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.test.ts`
Expected: PASS (7 assertions). If the back-off or twist assertions fail, adjust `CLEAR_MARGIN`/`STEP_MAX` and the twist sign until green — the assertions encode the required qualitative behavior; tune the constants to satisfy them, do not weaken the assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.ts src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.test.ts
git commit -m "feat(dodge): VacatePlanner — analytic open-quadrant/edge-on/reach-bounded stance" -- src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.ts src/lib/features/stage/locomotion/dodge/dodge-vacate-planner.test.ts
```

---

## Task 4: Orchestrator — planDodge()

**Files:**
- Modify: `src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts`
- Test: `src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts`

Add `planDodge` as a new export next to the existing `solveDodge` (removed in Task 7). It builds the swept tubes and returns a `DodgePlan`.

- [ ] **Step 1: Write the failing test (replace the file body, keep any preset imports it already uses)**

```ts
// src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts
import { describe, it, expect } from "vitest";
import { Plane } from "@austencloud/scene-3d";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";
import { planDodge } from "./dodge-orchestrator";
import { DEFAULT_DODGE_KNOB } from "./dodge-types";

const blue: MotionConfig3D = {
  plane: Plane.WHEEL, startLocation: GridLocation.SOUTH, endLocation: GridLocation.WEST,
  motionType: MotionType.PRO, rotationDirection: RotationDirection.CLOCKWISE, turns: 0,
  startOrientation: Orientation.IN, endOrientation: Orientation.IN, pathShape: "arc",
};
const red: MotionConfig3D = {
  plane: Plane.WALL, startLocation: GridLocation.NORTH, endLocation: GridLocation.EAST,
  motionType: MotionType.PRO, rotationDirection: RotationDirection.CLOCKWISE, turns: 0,
  startOrientation: Orientation.IN, endOrientation: Orientation.IN, pathShape: "arc",
};

describe("planDodge", () => {
  it("returns a DodgePlan with a deterministic placement function", () => {
    const plan = planDodge(blue, red, 1.8, 24, undefined, DEFAULT_DODGE_KNOB);
    const a = plan.placement(0.5);
    const b = plan.placement(0.5);
    expect(a).toEqual(b);
    expect(Number.isFinite(a.footOffsetX)).toBe(true);
    expect(Number.isFinite(a.rootYawRad)).toBe(true);
    expect(typeof plan.worstBodyDepth).toBe("number");
    expect(typeof plan.feasible).toBe("boolean");
  });

  it("faces grid center", () => {
    const plan = planDodge(blue, red, 1.8, 24, undefined, DEFAULT_DODGE_KNOB);
    const p = plan.placement(0.5);
    expect(Math.abs(p.rootYawRad - Math.atan2(-p.footOffsetX, -p.footOffsetZ))).toBeLessThan(1e-6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts`
Expected: FAIL — `planDodge` is not exported.

- [ ] **Step 3: Add `planDodge` to the orchestrator (above the existing `solveDodge`; leave `solveDodge` untouched for now)**

```ts
import { buildSweptVolume } from "./swept-volume-builder";
import { SweptTube } from "./swept-tube";
import { planVacate } from "./dodge-vacate-planner";
import { restPoseFromHeight } from "$lib/features/lab/tabs/collision-lab/services/stance-simulator";
import type { RestPoseGeometry } from "$lib/features/lab/tabs/collision-lab/services/types";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";
import { DEFAULT_DODGE_KNOB, type DodgeKnob, type DodgePlan } from "./dodge-types";

/**
 * Plan the dodge analytically: sample both hands' swept tubes, then run the
 * VacatePlanner to a single deterministic clearing stance. No StanceOptimizer,
 * no trajectory search — the returned `placement` is a pure function of sweep
 * progress (held stance in v1), so the live rig never jitters.
 */
export function planDodge(
  blueConfig: MotionConfig3D,
  redConfig: MotionConfig3D,
  heightMeters = 1.8,
  sampleCount = 24,
  restPoseOverride?: RestPoseGeometry,
  knob: DodgeKnob = DEFAULT_DODGE_KNOB,
): DodgePlan {
  const blueTube = new SweptTube(buildSweptVolume(blueConfig, sampleCount).samples);
  const redTube = new SweptTube(buildSweptVolume(redConfig, sampleCount).samples);
  const body = restPoseOverride ?? restPoseFromHeight(heightMeters);
  const res = planVacate(blueTube, redTube, body, knob);
  return {
    placement: () => res.placement,
    knob,
    worstBodyDepth: res.worstBodyDepth,
    feasible: res.feasible,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts
git commit -m "feat(dodge): planDodge — DodgePlan from analytic vacate, alongside legacy solveDodge" -- src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts
```

---

## Task 5: DodgeDriver — drive the body from the plan, pin the hands

**Files:**
- Modify: `src/lib/features/lab/tabs/dodge/DodgeDriver.svelte`

This is a Svelte/Threlte component with an imperative `useTask` loop; it cannot be meaningfully unit-tested, so its verification is the typecheck gate (Task 9) + the visual harness (Task 10). Keep the render-loop reactivity ban: **no `$state`/`$effect`/`$derived` touched per-frame.**

- [ ] **Step 1: Replace the prop surface**

In the `let { ... } = $props()` block (DodgeDriver.svelte:51-87), remove `manualMode`, `manualX`, `manualZ`, `manualYawDeg`, `puppetMode`, `puppetProgress`, `puppetPart`, `puppetGizmoMode`, `onGizmoDrag`, `placeMode`, `onPlace`. Add `knob`. Result:

```ts
let {
  controller,
  rig,
  blueConfig,
  redConfig,
  dodgeOn,
  knob,
  onClearance,
}: {
  controller: MmLocomotionController | null;
  rig: RigBinding | null;
  blueConfig: MotionConfig3D;
  redConfig: MotionConfig3D;
  dodgeOn: boolean;
  knob: DodgeKnob;
  onClearance: (clearanceM: number, plan: DodgePlan | null) => void;
} = $props();
```

- [ ] **Step 2: Swap imports + delete the place-click + gizmo machinery**

- Replace `import { solveDodge } ...` with `import { planDodge } from "$lib/features/stage/locomotion/dodge/dodge-orchestrator";`.
- Remove `import { sampleTrajectory } ...`.
- Replace `import type { DodgeSolution } ...` with `import type { DodgePlan, DodgeKnob, BodyPlacement } from "$lib/features/stage/locomotion/dodge/dodge-types";`.
- Delete the click-to-place block (DodgeDriver.svelte:89-142: `useThrelte` raycast state, `onPlacePointerDown`, `attachPlaceListener`, the `onMount`/`onDestroy` for it) — Place mode is gone. Keep `useThrelte` only if still needed elsewhere (it is not after this; remove the import of `useThrelte`, `Raycaster`, `Vector2`, `Plane as ThreePlane` if now unused).
- Delete `gizmoTarget`, `gizmoModeResolved`, the foot-handle meshes/`makeFootHandle`, the puppet leg-IK (`solveFoot`, leg chains), and `TransformControls` usage in the template. Remove the `TransformControls` import.

- [ ] **Step 3: Replace the solve with a plan, applied each frame**

Where the component currently computes `solveDodge(...)` and samples a trajectory, store a `DodgePlan` instead. The solve runs once (behind the existing boolean guard) when `dodgeOn` turns on and the rig is ready:

```ts
let plan: DodgePlan | null = null;
let planKnobKey = ""; // re-solve only when the knob changes (selection-time)

function ensurePlan(): void {
  if (!rig) { plan = null; return; }
  const key = `${knob.side}:${knob.aggression}`;
  if (plan && key === planKnobKey) return;
  const body = measureRigBody(rig) ?? undefined;
  plan = planDodge(blueConfig, redConfig, 1.8, 24, body, knob);
  planKnobKey = key;
}
```

In the per-frame `useTask`, when `dodgeOn`:

```ts
ensurePlan();
const placement: BodyPlacement | null = plan ? plan.placement(progress) : null;
if (placement) {
  // Apply body: step the root to (footOffsetX, footOffsetZ), face center,
  // pitch the spine, twist the chest edge-on. Inertialize the root yaw so the
  // body turns INTO the stance instead of snapping (uses the existing
  // startInertialize/applyInertialize on the root quaternion).
  applyBodyPlacement(placement);
  // Pin both hands to the (now world-positioned) staves; align wrist in Task 6.
  if (leftArm && leftElbowHinge) solveArm(leftArm, leftElbowHinge, blueStaff, true);
  if (rightArm && rightElbowHinge) solveArm(rightArm, rightElbowHinge, redStaff, false);
}
```

Implement `applyBodyPlacement` from the existing root/spine application the driver already had for the trajectory stance (`bx/bz/byaw/btwist`): set the root XZ to the foot offset, set root yaw to `placement.rootYawRad` (through the inertializer), apply `placement.spinePitchRad` to the spine bone and `placement.torsoTwistRad` to the upper spine (`Spine2`) — the same bones the prior twist application used. Keep the reach-assist step (`computeReach`) bounded as before so a near-max grip is closed by a small lean, not by leaving the stance.

- [ ] **Step 4: Recompute clearance from the plan diagnostics**

Replace the prior `onClearance(clearance, solution)` call. Clearance = `-worstBodyDepth` (cleared when ≥ −0.01, matching the readout). Report the plan:

```ts
onClearance(plan ? -plan.worstBodyDepth : 0, plan);
```

- [ ] **Step 5: Typecheck the component in isolation**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "DodgeDriver" /tmp/check.log`
Expected: no errors referencing `DodgeDriver.svelte` (other files still referencing removed props are fixed in Task 6).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/lab/tabs/dodge/DodgeDriver.svelte
git commit -m "refactor(dodge): drive body from analytic DodgePlan + arm pin; remove puppet/place/manual" -- src/lib/features/lab/tabs/dodge/DodgeDriver.svelte
```

---

## Task 6: Wrist-to-staff alignment

**Files:**
- Modify: `src/lib/features/lab/tabs/dodge/DodgeDriver.svelte` (the `solveArm` function, DodgeDriver.svelte:371-399)

Today `solveArm` pins hand *position* then restores the natural clip wrist orientation, so the grip never aligns to the staff (looks detached). Align the hand so its grip-reference axis follows the staff axis.

- [ ] **Step 1: Replace the orientation-restore block with a staff-axis align**

```ts
// After the position pin, align the hand's grip axis to the staff axis instead
// of restoring the clip orientation. HAND_GRIP_LOCAL_AXIS is the hand bone's
// local axis that runs along a held staff (Mixamo hands grip along local +Y;
// calibrate visually in the test page and adjust this constant if the grip
// reads rolled).
const HAND_GRIP_LOCAL_AXIS = new Vector3(0, 1, 0);
// World-space staff axis already computed above as _staffAxis.
hand.getWorldQuaternion(_qHandBefore);              // current world orient
const localAxisWorld = HAND_GRIP_LOCAL_AXIS.clone().applyQuaternion(_qHandBefore).normalize();
const align = new Quaternion().setFromUnitVectors(localAxisWorld, _staffAxis);
const targetWorld = align.multiply(_qHandBefore);   // rotate grip axis onto staff
if (hand.parent) {
  hand.parent.getWorldQuaternion(_qHandParent);
  hand.quaternion.copy(_qHandParent.invert()).multiply(targetWorld);
} else {
  hand.quaternion.copy(targetWorld);
}
hand.updateMatrixWorld(true);
```

- [ ] **Step 2: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "DodgeDriver" /tmp/check.log`
Expected: no `DodgeDriver.svelte` errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/lab/tabs/dodge/DodgeDriver.svelte
git commit -m "feat(dodge): align wrist to staff axis so the grip reads attached" -- src/lib/features/lab/tabs/dodge/DodgeDriver.svelte
```

> Final roll calibration of `HAND_GRIP_LOCAL_AXIS` happens in the Task 10 visual pass — if the staff reads rolled in the palm, try `(0,1,0)`→`(0,0,1)` etc. and re-verify in the viewport.

---

## Task 7: DodgeTab — side + aggression knob, remove puppet/place/manual

**Files:**
- Modify: `src/lib/features/lab/tabs/dodge/DodgeTab.svelte`

- [ ] **Step 1: Replace the mode state with the knob**

Remove `manualMode`/`manualX`/`manualZ`/`manualYawDeg`, the whole `puppetMode`/`puppetProgress`/`gizmoMode`/`puppetPart`/`gizmoDragging`/`camRef` puppet block, `placeMode`, `togglePlace`, `onPlace`, `faceCenterDeg`, `togglePuppet`, `PUPPET_PARTS`, and the camera-remap `$effect` (DodgeTab.svelte:84-172, 111-124). Add:

```ts
import type { DodgeKnob, DodgeSide } from "$lib/features/stage/locomotion/dodge/dodge-types";
import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";

let knob = $state<DodgeKnob>({ side: "auto", aggression: 0.6 });
```

(`OrbitControls`/`camRef` stays only if still used by the camera; the camera no longer needs the puppet remap, so remove `bind:ref={camRef}` and `enabled={!gizmoDragging}` → `enabled` can be the default `true`.)

- [ ] **Step 2: Replace the toggle row + slider panels in the template**

Remove the Manual/Puppet/Place `<button>`s and their `{#if manualMode}` / `{#if puppetMode}` / `{#if placeMode}` slider/hint panels (DodgeTab.svelte:362-472). Keep the Dodge ON/OFF toggle (drop its `|| manualMode || puppetMode` from `disabled`). Add the knob UI below it:

```svelte
{#if dodgeOn}
  <div class="knob">
    <span class="slabel">Dodge side</span>
    <SegmentedControl
      options={[
        { value: "auto", label: "Auto" },
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ]}
      value={knob.side}
      size="sm"
      onChange={(v) => (knob = { ...knob, side: v as DodgeSide })}
    />
    <label class="slider">
      <span class="slabel">Aggression <b>{(knob.aggression * 100).toFixed(0)}%</b></span>
      <input
        type="range" min="0" max="1" step="0.05"
        value={knob.aggression}
        oninput={(e) => (knob = { ...knob, aggression: +e.currentTarget.value })}
      />
    </label>
  </div>
{/if}
```

> Confirm `SegmentedControl`'s prop names by reading `src/lib/shared/3d/components/controls/SegmentedControl.svelte` before wiring — use its actual `options`/`value`/`onChange` (or `selected`/`onSelect`) signature; the chip-primitives rule mandates this control for a single-select group, do not hand-roll segmented buttons.

- [ ] **Step 3: Update the DodgeDriver invocation**

Replace the `<DodgeDriver .../>` props (DodgeTab.svelte:325-343) with:

```svelte
<DodgeDriver {controller} {rig} {blueConfig} {redConfig} {dodgeOn} {knob} {onClearance} />
```

Update `onClearance`'s signature to `(c: number, plan: DodgePlan | null)` and the `solution` state to `plan` (rename; the readout `{#if solution}` block now reads `plan.worstBodyDepth`/`plan.knob` — update the `step (...)` line to show `plan` foot offset from `plan.placement(0.5)` or drop the per-stance line in favor of the clearance readout). Update `copyDiagnostic` payload `solution` → `plan` serialized via `plan && { knob: plan.knob, worstBodyDepth: plan.worstBodyDepth, feasible: plan.feasible, placement: plan.placement(0.5) }`.

- [ ] **Step 4: Typecheck**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "DodgeTab|DodgeDriver" /tmp/check.log`
Expected: no errors for either file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/lab/tabs/dodge/DodgeTab.svelte
git commit -m "feat(dodge): side (SegmentedControl) + aggression knob; remove puppet/place/manual UI" -- src/lib/features/lab/tabs/dodge/DodgeTab.svelte
```

---

## Task 8: Delete dead trajectory + inside-gamma code

**Files:**
- Delete: `trajectory-optimizer.ts`, `stance-trajectory.ts`, `stance-trajectory-twist.test.ts`, `inside-gamma-target.ts`, `inside-gamma-target.test.ts`
- Modify: `dodge-orchestrator.ts` (remove legacy `solveDodge` + its imports), `dodge-types.ts` (remove `DodgeSolution` + `StanceTrajectory` import), keep `SweepSample`/`SweptVolume`.

- [ ] **Step 1: Preserve the oriented-slab-torso assertions**

`stance-trajectory-twist.test.ts` holds the only tests for the oriented-slab torso (`prop-through-torso` depth: face-on clips, edge-on clears). Those assert `StanceSimulator` behavior that STAYS. Move the three `describe("oriented-slab torso + twist", ...)` `it` blocks into a new `src/lib/features/lab/tabs/collision-lab/services/stance-simulator-torso.test.ts` (same imports minus `sampleTrajectory`/`TrajectoryOptimizer`). Drop the `sampleTrajectory` and `TrajectoryOptimizer` describes.

```bash
# after creating stance-simulator-torso.test.ts with the slab assertions:
npx vitest run src/lib/features/lab/tabs/collision-lab/services/stance-simulator-torso.test.ts
```
Expected: PASS (3 slab assertions).

- [ ] **Step 2: Delete the dead files**

```bash
git rm src/lib/features/lab/tabs/collision-lab/services/trajectory-optimizer.ts \
       src/lib/features/lab/tabs/collision-lab/services/stance-trajectory.ts \
       src/lib/features/lab/tabs/collision-lab/services/stance-trajectory-twist.test.ts \
       src/lib/features/stage/locomotion/dodge/inside-gamma-target.ts \
       src/lib/features/stage/locomotion/dodge/inside-gamma-target.test.ts
```

- [ ] **Step 3: Remove legacy `solveDodge` + `DodgeSolution`**

- In `dodge-orchestrator.ts`: delete the entire `solveDodge` function and its now-unused imports (`StanceSimulator`/`StanceOptimizer`/`TrajectoryOptimizer`/`sampleTrajectory`/`OPTIMIZER_BOUNDS`/`computeInsideGammaTarget`/`buildSweptVolume` is still used by `planDodge` — keep that one). Keep only what `planDodge` needs.
- In `dodge-types.ts`: delete `DodgeSolution` and the `StanceTrajectory` import. Keep `SweepSample`, `SweptVolume`, and all the planner types from Task 2.

- [ ] **Step 4: Grep for stragglers**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/ src/lib/features/lab/tabs/collision-lab/`
Expected: PASS; no import errors for the deleted modules. If anything still imports `solveDodge`/`DodgeSolution`/`sampleTrajectory`/`computeInsideGammaTarget`/`TrajectoryOptimizer`, fix it (should be none outside the dodge tab after Tasks 5/7).

- [ ] **Step 5: Commit**

```bash
git add -- src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts \
           src/lib/features/stage/locomotion/dodge/dodge-types.ts \
           src/lib/features/lab/tabs/collision-lab/services/stance-simulator-torso.test.ts
git commit -m "chore(dodge): remove dead trajectory/inside-gamma path; keep slab-torso tests" -- \
  src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts \
  src/lib/features/stage/locomotion/dodge/dodge-types.ts \
  src/lib/features/lab/tabs/collision-lab/services/trajectory-optimizer.ts \
  src/lib/features/lab/tabs/collision-lab/services/stance-trajectory.ts \
  src/lib/features/lab/tabs/collision-lab/services/stance-trajectory-twist.test.ts \
  src/lib/features/stage/locomotion/dodge/inside-gamma-target.ts \
  src/lib/features/stage/locomotion/dodge/inside-gamma-target.test.ts \
  src/lib/features/lab/tabs/collision-lab/services/stance-simulator-torso.test.ts
```

---

## Task 9: Full typecheck gate

**Files:** none (gate only)

- [ ] **Step 1: One full check (capture once, grep many)**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error|dodge" /tmp/check.log | head -50`
Expected: zero errors. Fix any reported, re-grep the same log; only re-run `check` after edits.

- [ ] **Step 2: Run the full dodge + collision-lab test suites**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/ src/lib/features/lab/tabs/collision-lab/ tests/unit/collision-lab/`
Expected: all PASS.

- [ ] **Step 3: Commit any fixes**

```bash
git add -- <only the files you fixed>
git commit -m "fix(dodge): typecheck gate after analytic-vacate cutover" -- <files>
```

---

## Task 10: Visual verification (DodgeTab test page)

**Files:** none (verification only). Requires the dev server on :5173 (the user's) — use it read-only, or `vite --port 5174` for an own server. Browser interaction needs the user's explicit OK per project rules; otherwise hand the user the steps.

- [ ] **Step 1: Load the page and turn Dodge ON**

Open [localhost:5173 dodge lab route](http://localhost:5173) (the mm-dodge / Dodge Lab tab). Toggle **Dodge ON**.

- [ ] **Step 2: Verify the four properties across the sweep (screenshot or DevTools)**

Confirm, with a screenshot or `evaluate_script` reading the rig transform:
1. Body steps into an **open quadrant** (off the prop sweep line), not the crossing.
2. Avatar **faces grid center** (chest toward origin).
3. Torso goes **edge-on** (shoulders rotated, thin side to the nearest staff).
4. **Both hands stay gripped** to the staves across the whole loop, and there is **no frame-to-frame jitter**.

- [ ] **Step 3: Exercise the knob**

Flip **side** Auto/Left/Right (body bails to the opposite quadrant) and drag **aggression** 0→1 (step distance grows, hands stay pinned). Capture before/after.

- [ ] **Step 4: Report evidence**

Paste the screenshot(s)/transform output. If the grip reads rolled, calibrate `HAND_GRIP_LOCAL_AXIS` (Task 6 note) and re-verify. Per the verification protocol, do not claim "works" without the image/output in the same message.

---

## Self-Review

**Spec coverage:**
- Analytic vacate recipe (open quadrant / face-center / edge-on / reach-bounded back-off) → Task 3. ✓
- SweptTube closed-form distance → Task 1. ✓
- BodyPlacement/DodgePlan/knob types → Task 2. ✓
- Orchestrator returns DodgePlan, optimizer off runtime path → Tasks 4, 8. ✓
- Arm pin reused + wrist-to-staff align → Tasks 5, 6. ✓
- Side/aggression knob via SegmentedControl + slider → Task 7. ✓
- Remove puppet/place/manual → Tasks 5, 7. ✓
- Delete trajectory/inside-gamma; keep StanceOptimizer/Simulator for labeling; preserve slab-torso tests → Task 8. ✓
- Soft-feasibility (never throw, degenerate sweep) → Task 3 test + planner fallbacks. ✓
- Inertialization for smoothness, no Catmull-Rom → Task 5 (root-yaw inertialize). ✓
- Deferred bake-at-export + closed-chain coupling → not in plan (correct; YAGNI). ✓

**Placeholder scan:** Task 3 carries an explicit "scratch to remove" note with the exact corrected code — that's a known rough-edge call-out with the fix inline, not a placeholder. `HAND_GRIP_LOCAL_AXIS` roll calibration is a real visual step (Task 6/10), not a TODO. No "TBD"/"implement later" remain.

**Type consistency:** `BodyPlacement` fields (`footOffsetX/Z`, `rootYawRad`, `torsoTwistRad`, `spinePitchRad`) are identical across Tasks 2/3/4/5. `DodgePlan.placement(progress)` returns `BodyPlacement` in Tasks 2/4/5. `DodgeKnob {side, aggression}` consistent across Tasks 2/3/4/7. `planVacate` signature `(blue, red, body, knob)` matches between Task 3 def and its tests. `planDodge` signature `(blueConfig, redConfig, height, sampleCount, restPoseOverride?, knob?)` matches Task 4 def + test + Task 5 call. `onClearance(c, plan)` consistent across Tasks 5/7.
