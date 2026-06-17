# Prop-Dodge Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An avatar in alpha1 (LH wheel-plane, RH wall-plane) pre-steps and reorients to one balanced, collision-free stance so a wheel-plane staff that would otherwise impale its torso no longer does, while both hands stay gripped via arm IK.

**Architecture:** Sample the analytic prop path into a swept volume (set of staff segments), feed it + grip targets to the existing Collision Lab `StanceSimulator`/`StanceOptimizer` (extended to aggregate worst-case across the sweep), and drive the already-built `MmLocomotionController` (turn-in-place + foot-lock) to step+reorient to the solved stance. Deterministic, offline-solve, no mocap. Naturalness polish deferred.

**Tech Stack:** TypeScript, Three.js, Threlte, Svelte 5, vitest, Chrome DevTools MCP for runtime verification.

**Spec:** `docs/superpowers/specs/2026-06-17-prop-dodge-vertical-slice-design.md`

**Standing rules for every task:**
- Commit ONLY your own files with an explicit pathspec: `git commit -m "..." -- <files>`. The shared index holds other agents' work — never a bare `git commit`, never `git add -A`/`.`.
- Inner loop: `npm run check:watch` (warm) or `npm run check:fast`. Run ONE full `npm run check` before each commit. Never `npm run build` in the loop. Never run `npm run dev` / touch port 5173.
- Run tests with `npx vitest run <path>`.
- No `<input type="checkbox">` anywhere (use button + toggle-indicator).

---

## File Structure

- Create `src/lib/features/stage/locomotion/dodge/dodge-types.ts` — `SweepSample`, `SweptVolume`, `DodgeSolution`.
- Create `src/lib/features/stage/locomotion/dodge/swept-volume-builder.ts` — analytic prop path → `SimPropTarget[]` (the swept volume), reusing the interpolator + canonical staff geometry.
- Modify `src/lib/features/lab/tabs/collision-lab/services/stance-simulator.ts` — add `evaluateSweep`.
- Modify `src/lib/features/lab/tabs/collision-lab/services/stance-optimizer.ts` — add `optimizeSweep` (descend refactored to take an evaluator closure; existing `optimize` unchanged in behavior).
- Modify `src/lib/features/lab/tabs/collision-lab/services/types.ts` — add `OptimizerSweepInput`.
- Modify `src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts` — implement `setTargetPosition` (translational step).
- Create `src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts` — wires builder → optimizer → controller + per-frame arm IK / spine pitch / prop placement.
- Create `src/routes/test/mm-dodge/+page.svelte` + `src/routes/test/mm-dodge/DodgeDriver.svelte` — test harness (mirror `src/routes/test/mm-locomotion/`).
- Tests: `src/lib/features/stage/locomotion/dodge/*.test.ts`.

---

### Task 1: Swept-volume builder + frame reconciliation

Proves the two coordinate paths agree (interpolator's `plane-transforms` vs the Collision Lab mapper's `plane-coordinate-mapper`) and produces the swept volume the solver consumes.

**Files:**
- Create: `src/lib/features/stage/locomotion/dodge/dodge-types.ts`
- Create: `src/lib/features/stage/locomotion/dodge/swept-volume-builder.ts`
- Test: `src/lib/features/stage/locomotion/dodge/swept-volume-builder.test.ts`

- [ ] **Step 1: Confirm the MotionConfig3D field names**

Read `src/lib/shared/3d/domain/models/motion-data-3d.ts` and confirm the fields used below exist with these names: `startLocation`, `endLocation`, `plane`, `turns`, `startOrientation`, `motionType`, optional `rotationPlane`, optional `pathShape`. Read `@austencloud/scene-3d` `STAGE.AVATAR_GRID_OFFSET` (used by `pose-target-mapper.ts:54`). If any name differs, adjust the code in this task to match — do not invent fields.

- [ ] **Step 2: Define the dodge types**

```ts
// src/lib/features/stage/locomotion/dodge/dodge-types.ts
import type { Vector3 } from "three";
import type { SimPropTarget } from "$lib/features/lab/tabs/collision-lab/services/types";
import type { StancePose } from "$lib/features/lab/tabs/collision-lab/domain/types";

/** One sampled instant of a staff along its motion: the same SimPropTarget the
 *  StanceSimulator already understands (grip + shaft segment + radius). */
export type SweepSample = SimPropTarget;

/** A hand's whole motion sampled into N staff instants. */
export interface SweptVolume {
  samples: SweepSample[];
}

/** The solved dodge for one move. */
export interface DodgeSolution {
  stance: StancePose;
  feasible: boolean;
  loss: number;
  /** Worst (max) prop-through-torso/head penetration depth across the sweep at
   *  the chosen stance, in meters. <= ~0.01 means cleared. */
  worstBodyDepth: number;
}
```

- [ ] **Step 3: Write the failing reconciliation + intrusion test**

```ts
// src/lib/features/stage/locomotion/dodge/swept-volume-builder.test.ts
import { describe, it, expect } from "vitest";
import { Plane } from "@austencloud/scene-3d";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { buildSweptVolume } from "./swept-volume-builder";
import { handToPropTarget } from "$lib/features/lab/tabs/collision-lab/services/pose-target-mapper";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";

// LH wheel-plane spin held at south, "in", 2 turns — the impaling move.
const blueSpin: MotionConfig3D = {
  startLocation: GridLocation.SOUTH,
  endLocation: GridLocation.SOUTH,
  plane: Plane.WHEEL,
  turns: 2,
  startOrientation: "in",
  motionType: MotionType.STATIC,
} as MotionConfig3D;

describe("buildSweptVolume", () => {
  it("start sample matches the canonical Collision Lab mapper (frames agree)", () => {
    const vol = buildSweptVolume(blueSpin, 24);
    const start = vol.samples[0];
    const canonical = handToPropTarget(Plane.WHEEL, "S", "in");
    // Both coordinate paths must land the grip in the same frame within 1 mm.
    expect(start.gripWorld.distanceTo(canonical.gripWorld)).toBeLessThan(0.001);
    // And the shaft direction must agree (dot of normalized axes ~ ±1).
    const aStart = start.tipAWorld.clone().sub(start.gripWorld).normalize();
    const aCanon = canonical.tipAWorld.clone().sub(canonical.gripWorld).normalize();
    expect(Math.abs(aStart.dot(aCanon))).toBeGreaterThan(0.999);
  });

  it("produces the requested number of samples with finite endpoints", () => {
    const vol = buildSweptVolume(blueSpin, 24);
    expect(vol.samples.length).toBe(24);
    for (const s of vol.samples) {
      expect(Number.isFinite(s.tipAWorld.x)).toBe(true);
      expect(Number.isFinite(s.tipBWorld.y)).toBe(true);
      expect(s.radius).toBeGreaterThan(0);
    }
  });

  it("the wheel-plane sweep occupies a range of Z (sagittal sweep through body)", () => {
    const vol = buildSweptVolume(blueSpin, 24);
    const zs = vol.samples.flatMap((s) => [s.tipAWorld.z, s.tipBWorld.z]);
    const span = Math.max(...zs) - Math.min(...zs);
    // A wheel-plane spin sweeps front-to-back; span must be a sizeable fraction
    // of the staff length (0.86 m total), proving it crosses the torso depth.
    expect(span).toBeGreaterThan(0.3);
  });
});
```

- [ ] **Step 4: Run the test to confirm it fails**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/swept-volume-builder.test.ts`
Expected: FAIL with "buildSweptVolume is not a function" (module not yet created).

- [ ] **Step 5: Implement the builder**

Drive the sweep through `calculatePropState` (the SAME function the renderer uses) so the swept volume matches what's drawn, and build the staff segment with the canonical geometry constants from `pose-target-mapper.ts`.

```ts
// src/lib/features/stage/locomotion/dodge/swept-volume-builder.ts
import { Vector3, Quaternion, Euler } from "three";
import { STAGE } from "@austencloud/scene-3d";
import { calculatePropState } from "$lib/shared/3d/services/prop-state-interpolator";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";
import type { SweptVolume, SweepSample } from "./dodge-types";

// Canonical staff geometry — must match pose-target-mapper.ts so the solver and
// the live collision agree. (STAFF_HALF_LENGTH 0.43, STAFF_RADIUS 0.012 there.)
const STAFF_HALF_LENGTH = 0.43;
const STAFF_RADIUS = 0.012;
const STAFF_HORIZONTAL_QUAT = new Quaternion().setFromEuler(
  new Euler(0, 0, Math.PI / 2)
);
const UP = new Vector3(0, 1, 0);

/**
 * Sample a hand's motion into a swept volume: N staff instants, each a
 * SimPropTarget (grip + shaft segment) in the StanceSimulator's frame.
 *
 * The grip Z is shifted by STAGE.AVATAR_GRID_OFFSET to move from the grid's
 * center frame into the avatar's shoulder-centered frame, exactly as
 * pose-target-mapper.handToPropTarget does — that shift is what makes the
 * reconciliation test pass.
 */
export function buildSweptVolume(
  config: MotionConfig3D,
  sampleCount = 24
): SweptVolume {
  const samples: SweepSample[] = [];
  const n = Math.max(2, sampleCount);
  for (let i = 0; i < n; i++) {
    const progress = i / (n - 1);
    const state = calculatePropState(config, progress);

    const grip = new Vector3(
      state.worldPosition.x,
      state.worldPosition.y,
      state.worldPosition.z + STAGE.AVATAR_GRID_OFFSET
    );

    const axis = UP.clone()
      .applyQuaternion(STAFF_HORIZONTAL_QUAT)
      .applyQuaternion(state.worldRotation)
      .multiplyScalar(STAFF_HALF_LENGTH);

    samples.push({
      gripWorld: grip,
      tipAWorld: grip.clone().add(axis),
      tipBWorld: grip.clone().sub(axis),
      radius: STAFF_RADIUS,
    });
  }
  return { samples };
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/swept-volume-builder.test.ts`
Expected: PASS (3 tests). If the reconciliation test fails, the two coordinate paths disagree: the renderer's path (`calculatePropState`) is authoritative because it is what's drawn; document the discrepancy at the top of `swept-volume-builder.ts` and adjust only the canonical comparison expectation, NOT the builder. Then re-run.

- [ ] **Step 7: Full check + commit**

Run: `npm run check`
Expected: 0 errors, 0 warnings.
```bash
git add src/lib/features/stage/locomotion/dodge/dodge-types.ts src/lib/features/stage/locomotion/dodge/swept-volume-builder.ts src/lib/features/stage/locomotion/dodge/swept-volume-builder.test.ts
git commit -m "feat(dodge): swept-volume builder + frame reconciliation test" -- src/lib/features/stage/locomotion/dodge/dodge-types.ts src/lib/features/stage/locomotion/dodge/swept-volume-builder.ts src/lib/features/stage/locomotion/dodge/swept-volume-builder.test.ts
```

---

### Task 2: `evaluateSweep` on StanceSimulator

Aggregate the existing per-instant `evaluate` across the sweep into one worst-case `SimResult`, so the optimizer's loss function is reused unchanged.

**Files:**
- Modify: `src/lib/features/lab/tabs/collision-lab/services/stance-simulator.ts`
- Test: `src/lib/features/lab/tabs/collision-lab/services/stance-simulator-sweep.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/features/lab/tabs/collision-lab/services/stance-simulator-sweep.test.ts
import { describe, it, expect } from "vitest";
import { StanceSimulator, restPoseFromHeight } from "./stance-simulator";
import type { SimPropTarget } from "./types";
import type { StancePose } from "../domain/types";
import { Vector3 } from "three";

function staffAt(z: number): SimPropTarget {
  // A horizontal staff centered on the body centerline at depth z, at chest
  // height (shoulder-centered frame: y=0 at shoulders, torso spheres below).
  return {
    gripWorld: new Vector3(0, -0.2, z),
    tipAWorld: new Vector3(0.43, -0.2, z),
    tipBWorld: new Vector3(-0.43, -0.2, z),
    radius: 0.012,
  };
}

const NEUTRAL: StancePose = { footOffsetX: 0, footOffsetZ: 0, rootYawRad: 0, spinePitchRad: 0 };
// A far-away grip the hands don't need to reach for this collision-only test.
const farTarget: SimPropTarget = staffAt(2);

describe("StanceSimulator.evaluateSweep", () => {
  it("reports the WORST torso intrusion across the sweep", () => {
    const sim = new StanceSimulator(restPoseFromHeight(1.8));
    // One sample passes through the body (z=0), others are clear (z far).
    const blueSweep = [staffAt(2), staffAt(0), staffAt(2)];
    const redSweep = [farTarget, farTarget, farTarget];
    const swept = sim.evaluateSweep(NEUTRAL, blueSweep, redSweep);
    const single = sim.evaluate(NEUTRAL, staffAt(0), farTarget);
    const sweptTorso = swept.collisions.find((c) => c.zone === "prop-through-torso");
    const singleTorso = single.collisions.find((c) => c.zone === "prop-through-torso");
    expect(sweptTorso).toBeDefined();
    // Worst-of-sweep depth equals the single worst instant's depth.
    expect(sweptTorso!.depth).toBeCloseTo(singleTorso!.depth, 5);
  });

  it("is clear when no sample intrudes", () => {
    const sim = new StanceSimulator(restPoseFromHeight(1.8));
    const clear = [staffAt(2), staffAt(2)];
    const swept = sim.evaluateSweep(NEUTRAL, clear, clear);
    const torso = swept.collisions.find((c) => c.zone === "prop-through-torso");
    expect(torso).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run src/lib/features/lab/tabs/collision-lab/services/stance-simulator-sweep.test.ts`
Expected: FAIL with "evaluateSweep is not a function".

- [ ] **Step 3: Implement `evaluateSweep`**

Add this public method to the `StanceSimulator` class (after `evaluate`, before `applyStance`). It calls the existing `evaluate` per paired sample and merges — zero duplicated collision math.

```ts
  /**
   * Evaluate a FIXED stance against a swept volume: arrays of paired staff
   * instants for each hand. Returns one SimResult whose collision/reach fields
   * are the worst (max) across all instants, so a stance is "clear" only if it
   * clears EVERY instant. Balance is stance-only, so it's taken from the first
   * sample. Reuses evaluate() per instant — no duplicated primitives.
   */
  evaluateSweep(
    stance: StancePose,
    blueSweep: SimPropTarget[],
    redSweep: SimPropTarget[]
  ): SimResult {
    const n = Math.min(blueSweep.length, redSweep.length);
    if (n === 0) {
      // Degenerate: nothing to hit. Evaluate balance/joints at the stance with
      // an unreachable dummy so reach doesn't false-pass.
      return this.evaluate(stance, blueSweep[0] ?? redSweep[0]!, redSweep[0] ?? blueSweep[0]!);
    }

    let merged: SimResult | null = null;
    const worstByZone = new Map<SimCollision["zone"], SimCollision>();

    for (let i = 0; i < n; i++) {
      const r = this.evaluate(stance, blueSweep[i]!, redSweep[i]!);
      if (!merged) {
        merged = {
          reachShortfall: { ...r.reachShortfall },
          reachStretch: { ...r.reachStretch },
          collisions: [],
          balanceMargin: r.balanceMargin, // stance-only — constant across sweep
          jointViolationRad: r.jointViolationRad,
          feasible: true,
          totalCollisionDepth: 0,
        };
      } else {
        merged.reachShortfall.blue = Math.max(merged.reachShortfall.blue, r.reachShortfall.blue);
        merged.reachShortfall.red = Math.max(merged.reachShortfall.red, r.reachShortfall.red);
        merged.reachStretch.blue = Math.max(merged.reachStretch.blue, r.reachStretch.blue);
        merged.reachStretch.red = Math.max(merged.reachStretch.red, r.reachStretch.red);
        merged.jointViolationRad = Math.max(merged.jointViolationRad, r.jointViolationRad);
      }
      for (const c of r.collisions) {
        const prev = worstByZone.get(c.zone);
        if (!prev || c.depth > prev.depth) worstByZone.set(c.zone, { ...c });
      }
    }

    const result = merged!;
    result.collisions = [...worstByZone.values()];
    let total = 0;
    let hardBodyDepth = 0;
    for (const c of result.collisions) {
      total += c.depth;
      if (
        c.zone === "prop-through-head" ||
        c.zone === "prop-through-torso" ||
        c.zone === "arm-through-face"
      ) {
        if (c.depth > hardBodyDepth) hardBodyDepth = c.depth;
      }
    }
    result.totalCollisionDepth = total;
    result.feasible =
      result.reachShortfall.blue <= REACH_FEASIBILITY_TOLERANCE &&
      result.reachShortfall.red <= REACH_FEASIBILITY_TOLERANCE &&
      result.balanceMargin > -0.005 &&
      hardBodyDepth <= 0.01;
    return result;
  }
```

Add `SimCollision` to the existing type import at the top of the file:
`import type { RestPoseGeometry, SimPropTarget, SimResult, SimCollision } from "./types";`

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/features/lab/tabs/collision-lab/services/stance-simulator-sweep.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Full check + commit**

Run: `npm run check` → 0/0.
```bash
git add src/lib/features/lab/tabs/collision-lab/services/stance-simulator.ts src/lib/features/lab/tabs/collision-lab/services/stance-simulator-sweep.test.ts
git commit -m "feat(collision-lab): evaluateSweep — worst-case stance eval across a swept volume" -- src/lib/features/lab/tabs/collision-lab/services/stance-simulator.ts src/lib/features/lab/tabs/collision-lab/services/stance-simulator-sweep.test.ts
```

---

### Task 3: `optimizeSweep` on StanceOptimizer

Reuse the descent + loss machinery to search a stance against the sweep. Refactor `descend` to accept an evaluator closure so neither the descent nor the loss is duplicated; existing `optimize` keeps its exact behavior.

**Files:**
- Modify: `src/lib/features/lab/tabs/collision-lab/services/types.ts`
- Modify: `src/lib/features/lab/tabs/collision-lab/services/stance-optimizer.ts`
- Test: `src/lib/features/lab/tabs/collision-lab/services/stance-optimizer-sweep.test.ts`

- [ ] **Step 1: Add the sweep input type**

In `types.ts`, after `OptimizerInput`:
```ts
/** Sweep variant of OptimizerInput: each hand is a sequence of staff instants. */
export interface OptimizerSweepInput {
  blue: SimPropTarget[];
  red: SimPropTarget[];
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/features/lab/tabs/collision-lab/services/stance-optimizer-sweep.test.ts
import { describe, it, expect } from "vitest";
import { StanceSimulator, restPoseFromHeight } from "./stance-simulator";
import { StanceOptimizer } from "./stance-optimizer";
import { OPTIMIZER_BOUNDS, handToPropTarget } from "./pose-target-mapper";
import type { SimPropTarget } from "./types";
import type { StancePose } from "../domain/types";
import { Vector3 } from "three";

const NEUTRAL: StancePose = { footOffsetX: 0, footOffsetZ: 0, rootYawRad: 0, spinePitchRad: 0 };

// Wheel-plane staff swinging through the centerline at several depths — the
// neutral stance is impaled; the optimizer must step/turn clear.
function wheelSpinSweep(): SimPropTarget[] {
  const out: SimPropTarget[] = [];
  for (let i = 0; i < 12; i++) {
    const t = (i / 11) * Math.PI; // half-disc sweep in the YZ plane
    const z = Math.cos(t) * 0.43;
    const y = -0.2 + Math.sin(t) * 0.43;
    out.push({
      gripWorld: new Vector3(0, -0.2, 0),
      tipAWorld: new Vector3(0, y, z),
      tipBWorld: new Vector3(0, -0.4 - Math.sin(t) * 0.43, -z),
      radius: 0.012,
    });
  }
  return out;
}

describe("StanceOptimizer.optimizeSweep", () => {
  it("finds a stance that clears the whole sweep where neutral does not", () => {
    const sim = new StanceSimulator(restPoseFromHeight(1.8));
    const opt = new StanceOptimizer(sim);
    const blue = wheelSpinSweep();
    const red = blue.map(() => handToPropTarget("WALL" as never, "N", "in")); // RH wall, out of the way

    const neutral = sim.evaluateSweep(NEUTRAL, blue, red);
    const neutralTorso = neutral.collisions.find((c) => c.zone === "prop-through-torso");
    expect(neutralTorso && neutralTorso.depth > 0.01).toBe(true); // impaled at neutral

    const result = opt.optimizeSweep({ blue, red }, NEUTRAL, OPTIMIZER_BOUNDS);
    const solvedTorso = result.simResult.collisions.find((c) => c.zone === "prop-through-torso");
    const solvedDepth = solvedTorso ? solvedTorso.depth : 0;
    expect(solvedDepth).toBeLessThan(0.01); // cleared after solve
    expect(result.simResult.balanceMargin).toBeGreaterThan(-0.005); // balanced
  });

  it("existing instantaneous optimize() still works (no regression)", () => {
    const sim = new StanceSimulator(restPoseFromHeight(1.8));
    const opt = new StanceOptimizer(sim);
    const blue = handToPropTarget("WALL" as never, "N", "in");
    const red = handToPropTarget("WALL" as never, "S", "in");
    const r = opt.optimize({ blue, red }, NEUTRAL, OPTIMIZER_BOUNDS);
    expect(r.stance).toBeDefined();
    expect(Number.isFinite(r.loss)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx vitest run src/lib/features/lab/tabs/collision-lab/services/stance-optimizer-sweep.test.ts`
Expected: FAIL with "optimizeSweep is not a function".

- [ ] **Step 4: Refactor descend to a closure + add optimizeSweep**

In `stance-optimizer.ts`:

(a) Change `descend` to take an evaluator instead of reading `input` directly. Replace its signature and the two `this.simulator.evaluate(...)` calls:

```ts
  private descend(
    evaluate: (s: StancePose) => SimResult,
    start: StancePose,
    bounds: OptimizerBounds,
    budget: number
  ): DescentResult {
    let best: StancePose = { ...start };
    this.clampInPlace(best, bounds);
    let bestSim = evaluate(best);
    let bestLoss = this.lossFrom(bestSim);
    let evals = 1;

    const step = { ...INITIAL_STEPS };

    while (evals < budget) {
      let improved = false;
      for (const key of STANCE_KEYS) {
        for (const dir of [-1, 1] as const) {
          if (evals >= budget) break;
          const candidate: StancePose = { ...best };
          candidate[key] = best[key] + dir * step[key];
          this.clampInPlace(candidate, bounds);
          const sim = evaluate(candidate);
          evals++;
          const loss = this.lossFrom(sim);
          if (loss < bestLoss - 1e-6) {
            best = candidate;
            bestLoss = loss;
            bestSim = sim;
            improved = true;
          }
        }
      }
      if (!improved) {
        let allMin = true;
        for (const key of STANCE_KEYS) {
          step[key] *= 0.5;
          if (step[key] > MIN_STEPS[key]) allMin = false;
        }
        if (allMin) break;
      }
    }

    return { stance: best, loss: bestLoss, simResult: bestSim, feasible: bestSim.feasible, evaluations: evals };
  }
```

(b) Update the two existing callers of `descend` inside `optimize` and `optimizeFromSeed` to pass a closure built from the instantaneous input:

In `optimize`, replace `const result = this.descend(input, seedStance, bounds, budget);` with:
```ts
      const evaluate = (s: StancePose) => this.simulator.evaluate(s, input.blue, input.red);
      const result = this.descend(evaluate, seedStance, bounds, budget);
```
and replace the random-restart `const attempt = this.descend(input, start, bounds, budget);` with:
```ts
      const evaluate = (s: StancePose) => this.simulator.evaluate(s, input.blue, input.red);
      const attempt = this.descend(evaluate, start, bounds, budget);
```

In `optimizeFromSeed`, replace `const result = this.descend(input, seedStance, bounds, budget);` with:
```ts
    const evaluate = (s: StancePose) => this.simulator.evaluate(s, input.blue, input.red);
    const result = this.descend(evaluate, seedStance, bounds, budget);
```

(c) Add the public `optimizeSweep` mirroring `optimize` but with a sweep closure. Add `OptimizerSweepInput` to the type import. Place after `optimize`:

```ts
  /**
   * Sweep variant of {@link optimize}: searches for one fixed stance that
   * minimizes worst-case loss across a swept volume (the prop's whole motion).
   * Same multi-start descent + loss as optimize(); only the evaluator differs.
   */
  optimizeSweep(
    input: OptimizerSweepInput,
    initial: StancePose,
    bounds: OptimizerBounds
  ): OptimizerResult {
    const evaluate = (s: StancePose) => this.simulator.evaluateSweep(s, input.blue, input.red);
    let totalEvals = 0;
    let best: DescentResult | null = null;

    for (const yawSeed of YAW_SEEDS_RAD) {
      if (totalEvals >= MAX_TOTAL_EVALS) break;
      const seedStance: StancePose = { ...initial, rootYawRad: this.wrapAngle(initial.rootYawRad + yawSeed) };
      this.clampInPlace(seedStance, bounds);
      const remaining = MAX_TOTAL_EVALS - totalEvals;
      const budget = Math.min(MAX_EVALS_PER_DESCENT, remaining);
      const result = this.descend(evaluate, seedStance, bounds, budget);
      totalEvals += result.evaluations;
      if (!best || result.loss < best.loss) best = result;
      if (best.feasible && best.loss < EARLY_EXIT_LOSS) break;
    }

    let restarts = 0;
    while (best && !best.feasible && restarts < MAX_RANDOM_RESTARTS && totalEvals < MAX_TOTAL_EVALS) {
      const remaining = MAX_TOTAL_EVALS - totalEvals;
      const budget = Math.min(MAX_EVALS_PER_DESCENT, remaining);
      const start = this.randomStance(bounds, restarts);
      const attempt = this.descend(evaluate, start, bounds, budget);
      totalEvals += attempt.evaluations;
      if (attempt.loss < best.loss) best = attempt;
      restarts++;
    }

    const resolved = best!;
    return {
      stance: resolved.stance,
      loss: resolved.loss,
      simResult: resolved.simResult,
      evaluations: totalEvals,
      feasible: resolved.feasible,
    };
  }
```

Update the import line:
`import type { OptimizerBounds, OptimizerInput, OptimizerResult, OptimizerSweepInput } from "./types";`

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run src/lib/features/lab/tabs/collision-lab/services/stance-optimizer-sweep.test.ts`
Expected: PASS (2 tests). Also run the existing Collision Lab tests to confirm no regression:
Run: `npx vitest run src/lib/features/lab/tabs/collision-lab`
Expected: all PASS.

- [ ] **Step 6: Full check + commit**

Run: `npm run check` → 0/0.
```bash
git add src/lib/features/lab/tabs/collision-lab/services/types.ts src/lib/features/lab/tabs/collision-lab/services/stance-optimizer.ts src/lib/features/lab/tabs/collision-lab/services/stance-optimizer-sweep.test.ts
git commit -m "feat(collision-lab): optimizeSweep — solve one stance clearing a swept volume" -- src/lib/features/lab/tabs/collision-lab/services/types.ts src/lib/features/lab/tabs/collision-lab/services/stance-optimizer.ts src/lib/features/lab/tabs/collision-lab/services/stance-optimizer-sweep.test.ts
```

---

### Task 4: Dodge orchestrator (solve step)

Pure logic that turns two move configs into a `DodgeSolution`. No Three.js scene mutation here — it composes the builder + optimizer. This is the unit-testable brain of the slice.

**Files:**
- Create: `src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts`
- Test: `src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts
import { describe, it, expect } from "vitest";
import { Plane } from "@austencloud/scene-3d";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { solveDodge } from "./dodge-orchestrator";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";

const blue: MotionConfig3D = {
  startLocation: GridLocation.SOUTH, endLocation: GridLocation.SOUTH,
  plane: Plane.WHEEL, turns: 2, startOrientation: "in", motionType: MotionType.STATIC,
} as MotionConfig3D;
const red: MotionConfig3D = {
  startLocation: GridLocation.NORTH, endLocation: GridLocation.NORTH,
  plane: Plane.WALL, turns: 2, startOrientation: "in", motionType: MotionType.STATIC,
} as MotionConfig3D;

describe("solveDodge", () => {
  it("returns a stance that reduces worst body intrusion below the neutral one", () => {
    const sol = solveDodge(blue, red, 1.8);
    expect(sol.worstBodyDepth).toBeLessThan(0.01);
    expect(Number.isFinite(sol.stance.footOffsetX)).toBe(true);
    expect(Number.isFinite(sol.stance.rootYawRad)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts`
Expected: FAIL with "solveDodge is not a function".

- [ ] **Step 3: Implement the solver**

```ts
// src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts
import { StanceSimulator, restPoseFromHeight } from "$lib/features/lab/tabs/collision-lab/services/stance-simulator";
import { StanceOptimizer } from "$lib/features/lab/tabs/collision-lab/services/stance-optimizer";
import { OPTIMIZER_BOUNDS } from "$lib/features/lab/tabs/collision-lab/services/pose-target-mapper";
import type { StancePose } from "$lib/features/lab/tabs/collision-lab/domain/types";
import type { MotionConfig3D } from "$lib/shared/3d/domain/models/motion-data-3d";
import { buildSweptVolume } from "./swept-volume-builder";
import type { DodgeSolution } from "./dodge-types";

const NEUTRAL: StancePose = { footOffsetX: 0, footOffsetZ: 0, rootYawRad: 0, spinePitchRad: 0 };

/**
 * Solve the anticipatory dodge for one move: sample both hands' swept volumes,
 * search for a single fixed stance that clears the worst-case prop position
 * while staying balanced and keeping both hands reachable across the sweep.
 *
 * Per the project's soft-feasibility rule: this NEVER throws on infeasible — it
 * returns the least-collision best-effort stance plus the worst depth so the
 * caller can surface a diagnostic.
 */
export function solveDodge(
  blueConfig: MotionConfig3D,
  redConfig: MotionConfig3D,
  heightMeters = 1.8,
  sampleCount = 24
): DodgeSolution {
  const blue = buildSweptVolume(blueConfig, sampleCount).samples;
  const red = buildSweptVolume(redConfig, sampleCount).samples;

  const sim = new StanceSimulator(restPoseFromHeight(heightMeters));
  const opt = new StanceOptimizer(sim);
  const result = opt.optimizeSweep({ blue, red }, NEUTRAL, OPTIMIZER_BOUNDS);

  const torso = result.simResult.collisions.find((c) => c.zone === "prop-through-torso");
  const head = result.simResult.collisions.find((c) => c.zone === "prop-through-head");
  const worstBodyDepth = Math.max(torso?.depth ?? 0, head?.depth ?? 0);

  return { stance: result.stance, feasible: result.feasible, loss: result.loss, worstBodyDepth };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts`
Expected: PASS.

- [ ] **Step 5: Full check + commit**

Run: `npm run check` → 0/0.
```bash
git add src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts
git commit -m "feat(dodge): solveDodge orchestrator — swept volume to clearing stance" -- src/lib/features/stage/locomotion/dodge/dodge-orchestrator.ts src/lib/features/stage/locomotion/dodge/dodge-orchestrator.test.ts
```

---

### Task 5: Translational step in the locomotion controller

Implement the `setTargetPosition` stub so the controller steps the root toward a target XZ while the existing world-space foot-lock keeps planted feet put. Must NOT regress verified turn-in-place/foot-lock behavior.

**Files:**
- Modify: `src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts`
- Test: `src/lib/features/stage/locomotion/motion-matching/mm-step-to-xz.test.ts`

- [ ] **Step 1: Read the controller's update loop**

Read `mm-locomotion-controller.ts` lines 220–348. Note: `setTargetPosition` is a stub (line 221); the hips horizontal translation is stripped to rest each frame (lines 330–333); `applyFootLock` pins planted feet to world positions (so when the root translates, planted feet stay and the leg steps). The new translation drives `root.position`, which is independent of the stripped hips offset.

- [ ] **Step 2: Write the failing test (logic-level, no GLB)**

The controller needs a rig; the existing test suite has a fake rig. Reuse it. Read `mm-locomotion-controller` existing tests under the same folder to find the fake `RigBinding` factory; if none exists, this test constructs a minimal stub rig. The assertion: after setting a target position and ticking, the root position moves toward the target and stops within tolerance.

```ts
// src/lib/features/stage/locomotion/motion-matching/mm-step-to-xz.test.ts
import { describe, it, expect } from "vitest";
import { MmLocomotionController } from "./mm-locomotion-controller";
import { makeFakeRig } from "./test-support/fake-rig"; // see Step 3

describe("MmLocomotionController step-to-XZ", () => {
  it("moves the root toward the target position and settles", async () => {
    const rig = makeFakeRig();
    const c = new MmLocomotionController(rig);
    await c.initialize();
    c.setTargetPosition(0.3, 0.0);
    for (let i = 0; i < 240; i++) c.update(1 / 60); // 4 s
    expect(Math.abs(rig.root.position.x - 0.3)).toBeLessThan(0.02);
    expect(Math.abs(rig.root.position.z - 0.0)).toBeLessThan(0.02);
  });

  it("with no target, the root stays at origin (no regression)", async () => {
    const rig = makeFakeRig();
    const c = new MmLocomotionController(rig);
    await c.initialize();
    for (let i = 0; i < 120; i++) c.update(1 / 60);
    expect(Math.abs(rig.root.position.x)).toBeLessThan(1e-6);
    expect(Math.abs(rig.root.position.z)).toBeLessThan(1e-6);
  });
});
```

- [ ] **Step 3: Provide a fake rig if one does not already exist**

Search for an existing fake/stub `RigBinding` used by the controller's other tests (`grep -rl "RigBinding" src/lib/features/stage/locomotion`). If one exists, import it and delete the `makeFakeRig` import above in favor of it. If none exists, create `src/lib/features/stage/locomotion/motion-matching/test-support/fake-rig.ts`:

```ts
// src/lib/features/stage/locomotion/motion-matching/test-support/fake-rig.ts
import { Bone, Object3D, Vector3 } from "three";
import type { RigBinding, LegChain } from "../rig-binding";
import type { PoseSample } from "../feature-types";

/** Minimal RigBinding for controller logic tests: a root + hips + two leg
 *  chains, all static. applyClip is a no-op (poses don't matter for the
 *  translation/settle logic under test). */
export function makeFakeRig(): RigBinding {
  const root = new Object3D();
  const hips = new Bone();
  hips.position.set(0, 0.9, 0);
  root.add(hips);

  const mkChain = (sign: number): LegChain => {
    const up = new Bone(); up.position.set(sign * 0.1, -0.1, 0);
    const lo = new Bone(); lo.position.set(0, -0.4, 0);
    const foot = new Bone(); foot.position.set(0, -0.4, 0);
    up.add(lo); lo.add(foot); hips.add(up);
    return {
      root: up, middle: lo, effector: foot,
      totalLength: 0.8, upperLength: 0.4, lowerLength: 0.4,
      rootRestDir: new Vector3(0, -1, 0), middleRestDir: new Vector3(0, -1, 0),
    };
  };
  const left = mkChain(-1);
  const right = mkChain(1);
  root.updateMatrixWorld(true);

  const blank: PoseSample = {
    hips: [0, 0.9, 0], leftFoot: [-0.1, -0.9, 0], rightFoot: [0.1, -0.9, 0],
    facing: 0, rootXZ: [0, 0],
  };

  return {
    root,
    getBone: (n) => (n === "Hips" ? hips : null),
    getLeftLegChain: () => left,
    getRightLegChain: () => right,
    clipSpecs: () => [
      { clipId: "idle", durationSec: 1 },
      { clipId: "turn-left", durationSec: 0.9 },
      { clipId: "turn-right", durationSec: 0.9 },
    ],
    samplePose: () => blank,
    readLivePose: () => blank,
    applyClip: () => { root.updateMatrixWorld(true); },
    rootMotionDelta: () => ({ x: 0, forward: 0, yawDelta: 0 }),
    resetRootMotion: () => {},
  };
}
```

- [ ] **Step 4: Run the test to confirm it fails**

Run: `npx vitest run src/lib/features/stage/locomotion/motion-matching/mm-step-to-xz.test.ts`
Expected: FAIL — root does not move (setTargetPosition is a stub).

- [ ] **Step 5: Implement the translational step**

In `mm-locomotion-controller.ts`:

(a) Add state + constant. Near the other constants (after `FOOT_LOCK_RELEASE_SEC`):
```ts
/** Max root translation speed (m/s) while stepping to a target position. */
const STEP_SPEED = 0.6;
/** Arrived-at-position tolerance (m). */
const POS_TOL = 0.01;
```

(b) Add fields near `targetFacing`:
```ts
  /** World XZ the root steps toward; null = stay in place (pure reorient). */
  private targetPos: { x: number; z: number } | null = null;
```

(c) Replace the stub `setTargetPosition`:
```ts
  /** Request a step so the avatar's root reaches world (x, z). */
  setTargetPosition(x: number, z: number): void {
    this.targetPos = { x, z };
  }
```

(d) In `update`, after the `root.updateMatrixWorld(true);` on line 335 (the one right before `applyFootLock`), insert the translation BEFORE `applyFootLock` so the foot-lock pins feet against the new root position in the same frame:
```ts
    // Translational step: move the root toward the target XZ at a capped speed.
    // The world-space foot-lock below keeps planted feet put, so the body steps
    // over them; lifted feet (during the pivot) re-plant at the new location.
    if (this.targetPos) {
      const dx = this.targetPos.x - root.position.x;
      const dz = this.targetPos.z - root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= POS_TOL) {
        root.position.x = this.targetPos.x;
        root.position.z = this.targetPos.z;
      } else {
        const stepLen = Math.min(dist, STEP_SPEED * dt);
        root.position.x += (dx / dist) * stepLen;
        root.position.z += (dz / dist) * stepLen;
      }
      root.updateMatrixWorld(true);
    }
```

(e) Update `_state.isMoving`/`speed` to also reflect translation. Replace lines 343–344:
```ts
    const stepping = !!this.targetPos &&
      Math.hypot(this.targetPos.x - root.position.x, this.targetPos.z - root.position.z) > POS_TOL;
    this._state.speed = turning || stepping ? 1 : 0;
    this._state.isMoving = turning || stepping;
    this._state.position.copy(root.position);
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npx vitest run src/lib/features/stage/locomotion/motion-matching/mm-step-to-xz.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Full check + commit**

Run: `npm run check` → 0/0.
```bash
git add src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts src/lib/features/stage/locomotion/motion-matching/mm-step-to-xz.test.ts src/lib/features/stage/locomotion/motion-matching/test-support/fake-rig.ts
git commit -m "feat(mm-locomotion): translational step-to-XZ via setTargetPosition" -- src/lib/features/stage/locomotion/motion-matching/mm-locomotion-controller.ts src/lib/features/stage/locomotion/motion-matching/mm-step-to-xz.test.ts src/lib/features/stage/locomotion/motion-matching/test-support/fake-rig.ts
```
(If you reused an existing fake rig instead of creating one, drop `test-support/fake-rig.ts` from both the `git add` and the pathspec.)

---

### Task 6: Test page `/test/mm-dodge`

Visual harness: avatar + both staves swinging, dodge ON/OFF toggle, debug gizmos, clearance readout, Copy Diagnostic, and `window.__*` hooks. Mirror `src/routes/test/mm-locomotion/` for the canvas/rig-load wiring — do not hand-roll a new Threlte setup.

**Files:**
- Create: `src/routes/test/mm-dodge/+page.svelte`
- Create: `src/routes/test/mm-dodge/DodgeDriver.svelte`

- [ ] **Step 1: Read the reference harness**

Read `src/routes/test/mm-locomotion/+page.svelte` and `src/routes/test/mm-locomotion/MmDriver.svelte` fully. Reuse their Threlte `<Canvas>` setup, GLB/clip loading via `createSelfLoadedRigBinding`, the `MmLocomotionController` construction + per-frame `update(dt)` via `useTask`, and the `window.__mm*` exposure pattern. The dodge page is that harness plus: prop rendering, the solved-stance drive, arm IK, and the toggle/gizmos.

- [ ] **Step 2: Build `DodgeDriver.svelte`**

Inside the Threlte canvas. Responsibilities:
1. Load the avatar rig + locomotion clips exactly as `MmDriver.svelte` does; construct `MmLocomotionController`; `await initialize()`.
2. Define the two move configs (alpha1): blue = wheel/SOUTH/in/2 turns, red = wall/NORTH/in/2 turns (the `MotionConfig3D` objects from Task 4's test).
3. Call `solveDodge(blue, red)` once on mount; store `DodgeSolution`.
4. A `dodgeOn` prop (bound to the page toggle). When ON: `controller.setTargetFacing(solution.stance.rootYawRad)` and `controller.setTargetPosition(solution.stance.footOffsetX, solution.stance.footOffsetZ)`. When OFF: `setTargetFacing(0)` and `setTargetPosition(0, 0)` (return to neutral).
5. Per frame (`useTask`): advance a `progress` clock `0→1` looping over the move duration; `controller.update(dt)`; compute live `blueState = calculatePropState(blue, progress)` and `redState = calculatePropState(red, progress)`; render each staff at its `worldPosition`/`worldRotation` (reuse the existing 3D staff/prop component — grep `Staff3D`/prop mesh under `src/lib/shared/3d`; do NOT model a new staff). Apply spine pitch from the solution to the spine bone when ON (grep how `mm-locomotion`/avatar applies an external spine pitch; reuse it). Drive each hand onto its live grip target with the analytic arm IK — call `StanceSimulator.solveArmIK` via a thin shared wrapper, OR (preferred if the live rig already exposes arm IK) the existing live arm-IK path; pick one source of truth, do not add a second arm-IK implementation.
6. Expose `window.__dodgeController = controller`, `window.__dodgeRig = rig`, `window.__dodgeSolution = solution`, and `window.__dodgeClearance = () => number` returning the current min distance from the torso/head spheres to the nearest live staff sample (reuse `StanceSimulator` geometry or a small inline point-to-segment helper). These power DevTools verification in Task 7.
7. Gizmos (toggle-able via a `showGizmos` prop): draw the swept-volume staff samples as faint line segments, and a marker at the solved foot target. Use Threlte `<T.Line>`/`<T.Mesh>` primitives.

- [ ] **Step 3: Build `+page.svelte`**

Outside the canvas: title, the `<DodgeDriver>` in a `<Canvas>`, and the controls row:
- A dodge ON/OFF toggle as a `<button>` with an explicit toggle-indicator (NO checkbox — follow the `aria-pressed` button pattern; grep an existing toggle primitive under `src/lib/components`/`src/lib/ui` and reuse it).
- A "Copy Diagnostic" `<button>` that copies JSON of `{ blueConfig, redConfig, solution, liveClearance }` to the clipboard (mirror the Collision Lab diagnostic pattern — grep `collision-lab-diagnostic`).
- A live clearance readout (use `font-variant-numeric: tabular-nums`; reserve width so the value flipping sign doesn't shift the row — see `no-layout-shift` rule).

- [ ] **Step 4: Verify it loads**

Run: `npm run check` → 0/0.
Then confirm the route serves (dev server is the user's on :5173):
Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test/mm-dodge`
Expected: `200`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/test/mm-dodge/+page.svelte src/routes/test/mm-dodge/DodgeDriver.svelte
git commit -m "feat(dodge): /test/mm-dodge harness — props, toggle, gizmos, diagnostic" -- src/routes/test/mm-dodge/+page.svelte src/routes/test/mm-dodge/DodgeDriver.svelte
```

---

### Task 7: Runtime verification + final gate

Prove the dodge works with objective evidence (per verification-protocol). No "should work."

**Files:** none (verification only).

- [ ] **Step 1: Ask the user for browser-control permission**

Interactive DevTools (navigate/evaluate) needs explicit verbal permission in this conversation. Ask: "May I drive Chrome DevTools to verify `/test/mm-dodge`?" Wait for yes. (Read-only screenshot/snapshot does not, but evaluating the controller does.)

- [ ] **Step 2: Capture the OFF (impaled) baseline**

Via Chrome DevTools MCP `evaluate_script` on `http://localhost:5173/test/mm-dodge` with the toggle OFF: sample `window.__dodgeClearance()` across a full move loop (e.g. 60 samples). Record the minimum. Expected: negative (staff penetrates the torso) — this proves the bug exists and the readout is real.

- [ ] **Step 3: Capture the ON (cleared) result**

Toggle dodge ON. Re-sample `window.__dodgeClearance()` across a full loop. Expected: minimum ≥ 0 (a small positive margin). Also read `window.__dodgeSolution` and assert `worstBodyDepth < 0.01` and `simResult.balanceMargin > -0.005`.

- [ ] **Step 4: Confirm the step actually happened**

Read `window.__dodgeController.state.position` (or `window.__dodgeRig.root.position`) ON vs OFF. Expected: ON differs from OFF by ≈ the solved `footOffset` — proves a real step, not just a torso lean.

- [ ] **Step 5: Report evidence to the user**

Post the OFF-min vs ON-min clearance numbers, the solved stance, and `worstBodyDepth`. Ask the user to eyeball the dodge on `/test/mm-dodge` for naturalness (correctness-first; stiffness is acceptable this slice). Per project rules, a user "yes it works" is the cheapest confirmation; offer a screenshot only if they want one.

- [ ] **Step 6: Final full-suite gate**

Run: `npx vitest run src/lib/features/stage/locomotion/dodge src/lib/features/lab/tabs/collision-lab src/lib/features/stage/locomotion/motion-matching`
Expected: all PASS.
Run: `npm run check`
Expected: 0 errors, 0 warnings.

---

## Notes for the executor

- **Soft feasibility:** never hard-fail on an infeasible solve. `solveDodge` returns best-effort + `worstBodyDepth`; the page surfaces it. Two props are always reachable — an infeasible result means inputs/solver are suspect, not that the move is impossible.
- **One arm-IK source of truth:** if the live rig already drives arms via IK, use it. Only if it does not, wrap `StanceSimulator.solveArmIK` into a shared Three.js-free helper both call. Do not create a second arm-IK math path.
- **Don't regress the verified controller:** the turn-in-place + foot-lock behavior is confirmed good. Task 5 only adds translation; re-run the motion-matching tests after.
- **Perf:** `optimizeSweep` runs ~700 descent evals × ~24 samples once per move (~sub-second). It's an offline-style solve, not per-frame — acceptable. If it ever feels slow in the harness, lower `sampleCount`, and `log()` that you did (never silently cap).
