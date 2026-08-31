/**
 * StanceOptimizer
 *
 * Finds a stance (footX, footZ, yaw, pitch) that minimizes reachability
 * shortfall + collision depth + imbalance + joint strain for a given
 * pair of prop targets.
 *
 * ## Why multi-start
 *
 * The search space is 4-dimensional, but the YAW axis is special: full
 * ±180° rotation is available, and the loss landscape is strongly
 * non-convex around it. A cross-plane pose (e.g., blue on the wheel +
 * red on the floor) may require the performer to stand behind the grid
 * and turn 180° so the left arm can reach what the neutral stance put
 * on the wrong side of the body.
 *
 * Coordinate descent from a single start point at yaw=0 cannot find
 * that solution because no incremental 11° step improves the loss -
 * the optimizer is stuck in a flat region where nothing reaches. So we
 * seed FOUR starting stances at yaws (0°, 90°, 180°, 270°) and descend
 * each one. The best of the four is the result. This is cheap and
 * guarantees that every "reachable in principle" pose gets discovered.
 *
 * ## Algorithm
 *
 *   1. Build 4 seed stances at yaws 0°, 90°, 180°, 270° from the given
 *      initial stance. Everything else held fixed.
 *   2. For each seed:
 *      a. Run coordinate descent with adaptive step size.
 *      b. Track the best result across all seeds.
 *      c. Early-exit if the current best is feasible with very low loss
 *         - no point spending more eval budget on a pose we've solved.
 *   3. If the best result is still infeasible after all seeds, fall
 *      back to random restarts within the full bounds.
 *
 * ## Loss weights
 *
 * Tuned so an unreachable pose is strictly worse than a clear-but-
 * imbalanced pose, which is worse than a clear-but-strained pose:
 *
 *   reach shortfall     × 1000   (absolute disqualifier)
 *   collision depth     ×  100   (strong penalty per meter)
 *   balance violation   ×   10   (moderate - physical but ugly)
 *   joint comfort       ×    1   (mild - prefers natural arms)
 *   max extension       ×  0.5   (trivial - avoid locked-out arms)
 *
 * Domain: Collision Lab - automated stance search
 */

import type { OptimizerBounds, OptimizerInput, OptimizerResult, OptimizerSweepInput } from "./types";
import type { SimResult } from "./types";
import type { StancePose } from "../domain/types";
import type { StanceSimulator } from "./stance-simulator";
// Loss function weights. Tuned so that "unreachable by 1 cm" produces a
// larger loss than "clear but slightly imbalanced", which is the right
// priority ordering for a reviewer.
const W_REACH_SHORTFALL = 1000; // absolute disqualifier
const W_BALANCE = 10;           // moderate penalty for imbalance
const W_JOINT = 1;              // mild penalty for joint strain
const W_STRETCH = 0.5;          // very mild penalty for near-max extension

// Per-zone collision weights in units of "loss per meter of penetration".
// Head/torso/face violations are roughly half the reach weight - strongly
// avoided but not absolute disqualifiers. Arm-on-arm and prop-on-prop are
// milder because those are expected in some configurations (beta at a
// shared grip, for instance).
const W_ZONE: Record<string, number> = {
  "prop-through-head": 500,
  "prop-through-torso": 400,
  "arm-through-face": 500,
  "arm-through-neck": 500,
  "arm-through-torso": 400,
  "prop-through-arm": 60,
  "arms-through-each-other": 40,
  "prop-through-prop": 30,
};
const W_ZONE_DEFAULT = 50;

// Step sizes. Initial steps are coarse so the optimizer can move quickly;
// the halving schedule then refines toward the minimum.
const INITIAL_STEPS = {
  footOffsetX: 0.1,
  footOffsetZ: 0.1,
  rootYawRad: 0.25,
  spinePitchRad: 0.1,
  torsoTwistRad: 0.2,
};
const MIN_STEPS = {
  footOffsetX: 0.01,
  footOffsetZ: 0.01,
  rootYawRad: 0.015,
  spinePitchRad: 0.015,
  torsoTwistRad: 0.015,
};

// Yaw seed angles (radians). Every seed starts a fresh coordinate descent.
// 4 seeds at 90° intervals is a good balance between coverage and speed.
const YAW_SEEDS_RAD: number[] = [
  0,
  Math.PI / 2,
  Math.PI,
  -Math.PI / 2,
];

// Per-seed descent budget. Each seed gets its own budget; the best result
// across all seeds wins.
const MAX_EVALS_PER_DESCENT = 120;

// Total evaluation budget across all seeds + restarts. ~50 µs per eval
// means 700 evals ≈ 35 ms, which stays interactive when scrubbing poses.
const MAX_TOTAL_EVALS = 700;
const MAX_RANDOM_RESTARTS = 2;

// Loss threshold for early-exit. If the best result so far is feasible
// AND below this loss, we stop seeding more starting points.
const EARLY_EXIT_LOSS = 0.5;

type StanceKey = keyof StancePose;
const STANCE_KEYS: StanceKey[] = [
  "footOffsetX",
  "footOffsetZ",
  "rootYawRad",
  "spinePitchRad",
  "torsoTwistRad",
];

/** Internal result of a single coordinate-descent run from one seed. */
interface DescentResult {
  stance: StancePose;
  loss: number;
  simResult: SimResult;
  feasible: boolean;
  evaluations: number;
}

export class StanceOptimizer {
  readonly simulator: StanceSimulator;

  constructor(simulator: StanceSimulator) {
    this.simulator = simulator;
  }

  optimize(
    input: OptimizerInput,
    initial: StancePose,
    bounds: OptimizerBounds
  ): OptimizerResult {
    let totalEvals = 0;
    let best: DescentResult | null = null;

    // Multi-start descent across the 4 yaw seeds. Each seed starts from
    // the initial stance but with its own yaw; the other parameters are
    // free to move during the descent.
    for (const yawSeed of YAW_SEEDS_RAD) {
      if (totalEvals >= MAX_TOTAL_EVALS) break;

      // Rotate relative to the initial yaw so a caller that passes a
      // non-zero starting yaw still gets symmetric coverage.
      const seedStance: StancePose = {
        ...initial,
        rootYawRad: this.wrapAngle(initial.rootYawRad + yawSeed),
      };
      this.clampInPlace(seedStance, bounds);

      const remaining = MAX_TOTAL_EVALS - totalEvals;
      const budget = Math.min(MAX_EVALS_PER_DESCENT, remaining);
      const evaluate = (s: StancePose) => this.simulator.evaluate(s, input.blue, input.red);
      const result = this.descend(evaluate, seedStance, bounds, budget);
      totalEvals += result.evaluations;

      if (!best || result.loss < best.loss) best = result;

      // Early exit: if we've already found a clearly-clean stance, don't
      // waste budget refining more seeds.
      if (best.feasible && best.loss < EARLY_EXIT_LOSS) break;
    }

    // If still infeasible, random restarts sample the full bounds with
    // no yaw bias, catching cases where the answer is at an intermediate
    // yaw (e.g., 45° or 135°) that the 4-seed grid missed.
    let restarts = 0;
    while (
      best &&
      !best.feasible &&
      restarts < MAX_RANDOM_RESTARTS &&
      totalEvals < MAX_TOTAL_EVALS
    ) {
      const remaining = MAX_TOTAL_EVALS - totalEvals;
      const budget = Math.min(MAX_EVALS_PER_DESCENT, remaining);
      const start = this.randomStance(bounds, restarts);
      const evaluate = (s: StancePose) => this.simulator.evaluate(s, input.blue, input.red);
      const attempt = this.descend(evaluate, start, bounds, budget);
      totalEvals += attempt.evaluations;
      if (attempt.loss < best.loss) best = attempt;
      restarts++;
    }

    // `best` is always set because YAW_SEEDS_RAD is non-empty and the
    // first iteration always runs. The non-null check satisfies TS.
    const resolved = best!;
    return {
      stance: resolved.stance,
      loss: resolved.loss,
      simResult: resolved.simResult,
      evaluations: totalEvals,
      feasible: resolved.feasible,
    };
  }

  /**
   * Sweep variant of {@link optimize}: searches for one fixed stance that
   * minimizes worst-case loss across a swept volume (the prop's whole motion).
   * Same multi-start descent + loss as optimize(); only the evaluator differs.
   *
   * `opts` is OPT-IN and defaults to plain behaviour:
   *   - `stancePenalty(stance)` adds a soft, stance-dependent term to the loss
   *     (e.g. bias toward a preferred standing point + facing). It NEVER sees
   *     the sim result, so it cannot relax feasibility — reach/collision still
   *     dominate. Used by the dodge orchestrator to pull the solve into the
   *     inside-gamma corner. Collision Lab passes nothing and is unaffected.
   *   - `extraSeeds` are additional descent start points (tried FIRST), so a
   *     known-good basin (the inside-gamma apex) is always explored.
   */
  optimizeSweep(
    input: OptimizerSweepInput,
    initial: StancePose,
    bounds: OptimizerBounds,
    opts?: {
      stancePenalty?: (stance: StancePose, sim: SimResult) => number;
      extraSeeds?: StancePose[];
      reachTolerance?: number;
    }
  ): OptimizerResult {
    const evaluate = (s: StancePose) => this.simulator.evaluateSweep(s, input.blue, input.red);
    const penalty = opts?.stancePenalty;
    const reachTol = opts?.reachTolerance ?? 0;
    let totalEvals = 0;
    let best: DescentResult | null = null;

    // Extra (caller-supplied) seeds first, then the symmetric 4-yaw grid.
    const seeds: StancePose[] = [
      ...(opts?.extraSeeds ?? []).map((s) => ({ ...s })),
      ...YAW_SEEDS_RAD.map((yawSeed) => ({
        ...initial,
        rootYawRad: this.wrapAngle(initial.rootYawRad + yawSeed),
      })),
    ];

    for (const seedStance of seeds) {
      if (totalEvals >= MAX_TOTAL_EVALS) break;
      this.clampInPlace(seedStance, bounds);
      const remaining = MAX_TOTAL_EVALS - totalEvals;
      const budget = Math.min(MAX_EVALS_PER_DESCENT, remaining);
      const result = this.descend(evaluate, seedStance, bounds, budget, penalty, reachTol);
      totalEvals += result.evaluations;
      if (!best || result.loss < best.loss) best = result;
      if (best.feasible && best.loss < EARLY_EXIT_LOSS) break;
    }

    let restarts = 0;
    while (
      best &&
      !best.feasible &&
      restarts < MAX_RANDOM_RESTARTS &&
      totalEvals < MAX_TOTAL_EVALS
    ) {
      const remaining = MAX_TOTAL_EVALS - totalEvals;
      const budget = Math.min(MAX_EVALS_PER_DESCENT, remaining);
      const start = this.randomStance(bounds, restarts);
      const attempt = this.descend(evaluate, start, bounds, budget, penalty, reachTol);
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

  /**
   * Run exactly one coordinate descent from the given seed - no internal
   * multi-start, no random restarts. Used by the candidate generator
   * which wants N distinct seeds × N independent descents, not the
   * merged best-across-seeds result of `optimize()`.
   *
   * The default budget (150 evals) is roughly a third of `optimize`'s
   * per-seed budget because the candidate generator typically calls this
   * 6 times in quick succession - we'd rather spend the total budget
   * spreading across many starting points than polishing one.
   */
  optimizeFromSeed(
    input: OptimizerInput,
    seed: StancePose,
    bounds: OptimizerBounds,
    budget: number = 150
  ): OptimizerResult {
    const seedStance: StancePose = { ...seed };
    seedStance.rootYawRad = this.wrapAngle(seedStance.rootYawRad);
    this.clampInPlace(seedStance, bounds);
    const evaluate = (s: StancePose) => this.simulator.evaluate(s, input.blue, input.red);
    const result = this.descend(evaluate, seedStance, bounds, budget);
    return {
      stance: result.stance,
      loss: result.loss,
      simResult: result.simResult,
      evaluations: result.evaluations,
      feasible: result.feasible,
    };
  }

  /**
   * Normalize an angle to (−π, π]. Prevents the descent from being
   * confused by equivalent angles at +π and −π, and keeps seed stances
   * inside the optimizer bounds.
   */
  private wrapAngle(angle: number): number {
    let a = angle;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
  }

  // Single coordinate-descent pass from a starting point. Returns the best
  // stance found and the loss/sim result for it.

  private descend(
    evaluate: (s: StancePose) => SimResult,
    start: StancePose,
    bounds: OptimizerBounds,
    budget: number,
    penalty?: (stance: StancePose, sim: SimResult) => number,
    reachTol = 0
  ): DescentResult {
    // Score = pure sim loss + optional stance penalty. With no penalty and
    // reachTol=0 this is exactly lossFrom(sim), so the Collision Lab path is
    // unchanged. The penalty sees the sim result so it can gate itself (e.g.
    // only bias FEASIBLE stances, never trading clearance/reach for position).
    const score = (stance: StancePose, sim: SimResult) =>
      this.lossFrom(sim, reachTol) + (penalty ? penalty(stance, sim) : 0);

    let best: StancePose = { ...start };
    this.clampInPlace(best, bounds);
    let bestSim = evaluate(best);
    let bestLoss = score(best, bestSim);
    let evals = 1;

    const step = { ...INITIAL_STEPS };

    while (evals < budget) {
      let improved = false;

      for (const key of STANCE_KEYS) {
        for (const dir of [-1, 1] as const) {
          if (evals >= budget) break;
          const candidate: StancePose = { ...best };
          // `?? 0` defaults torsoTwistRad on seeds that predate the 5th DOF
          // (e.g. legacy labels) so the arithmetic never hits undefined.
          candidate[key] = (best[key] ?? 0) + dir * step[key];
          this.clampInPlace(candidate, bounds);
          const sim = evaluate(candidate);
          evals++;
          const loss = score(candidate, sim);
          if (loss < bestLoss - 1e-6) {
            best = candidate;
            bestLoss = loss;
            bestSim = sim;
            improved = true;
          }
        }
      }

      if (!improved) {
        // Shrink step sizes. If all are already at minimum, we're done.
        let allMin = true;
        for (const key of STANCE_KEYS) {
          step[key] *= 0.5;
          if (step[key] > MIN_STEPS[key]) allMin = false;
        }
        if (allMin) break;
      }
    }

    return {
      stance: best,
      loss: bestLoss,
      simResult: bestSim,
      feasible: bestSim.feasible,
      evaluations: evals,
    };
  }

  // Loss function - combines simulator outputs into a single scalar that
  // the optimizer minimizes. The weights are the heart of the "what is a
  // good stance" judgment.

  private lossFrom(sim: SimResult, reachTol = 0): number {
    return computeStanceLoss(sim, reachTol);
  }

  // Helpers

  private clampInPlace(stance: StancePose, bounds: OptimizerBounds): void {
    stance.footOffsetX = clamp(
      stance.footOffsetX,
      bounds.footOffsetX.min,
      bounds.footOffsetX.max
    );
    stance.footOffsetZ = clamp(
      stance.footOffsetZ,
      bounds.footOffsetZ.min,
      bounds.footOffsetZ.max
    );
    stance.rootYawRad = clamp(
      stance.rootYawRad,
      bounds.rootYawRad.min,
      bounds.rootYawRad.max
    );
    stance.spinePitchRad = clamp(
      stance.spinePitchRad,
      bounds.spinePitchRad.min,
      bounds.spinePitchRad.max
    );
    stance.torsoTwistRad = clamp(
      stance.torsoTwistRad ?? 0,
      bounds.torsoTwistRad.min,
      bounds.torsoTwistRad.max
    );
  }

  /**
   * Sample a random stance within bounds. Uses a simple LCG seeded by
   * the restart index so repeat runs are deterministic (important for
   * tests and for reproducible labeling sessions).
   */
  private randomStance(bounds: OptimizerBounds, seed: number): StancePose {
    const rng = mulberry32(0xb5297a4d ^ (seed + 1));
    return {
      footOffsetX: lerp(bounds.footOffsetX.min, bounds.footOffsetX.max, rng()),
      footOffsetZ: lerp(bounds.footOffsetZ.min, bounds.footOffsetZ.max, rng()),
      rootYawRad: lerp(bounds.rootYawRad.min, bounds.rootYawRad.max, rng()),
      spinePitchRad: lerp(
        bounds.spinePitchRad.min,
        bounds.spinePitchRad.max,
        rng()
      ),
      torsoTwistRad: lerp(
        bounds.torsoTwistRad.min,
        bounds.torsoTwistRad.max,
        rng()
      ),
    };
  }
}

/**
 * Per-instant stance loss — the single source of truth for "how good is this
 * stance against one prop configuration". Exported so the trajectory optimizer
 * scores each dense sample with the exact same weights the Collision Lab /
 * dodge fixed-stance solve uses (no duplicated tuning).
 *
 * `reachTol` (opt-in) forgives the sub-cm shortfall the live body can close via
 * shrug / clavicle / lean, matching the simulator's feasibility slack.
 */
export function computeStanceLoss(sim: SimResult, reachTol = 0): number {
  let loss = 0;

  // Reach shortfall: both hands must touch the props. A shortfall of even 1 cm
  // produces a huge loss that dwarfs any other term.
  const sf =
    Math.max(0, sim.reachShortfall.blue - reachTol) +
    Math.max(0, sim.reachShortfall.red - reachTol);
  loss += W_REACH_SHORTFALL * sf;

  // Per-zone collision penalties. Face / head / torso zones are weighted much
  // more heavily than arm-arm or prop-prop overlaps.
  for (const c of sim.collisions) {
    const w = W_ZONE[c.zone] ?? W_ZONE_DEFAULT;
    loss += w * c.depth;
  }

  // Balance: only negative margin (CoM outside feet) is penalized.
  loss += W_BALANCE * Math.max(0, -sim.balanceMargin);

  // Joint strain.
  loss += W_JOINT * sim.jointViolationRad;

  // Comfort: near-max extension is mildly discouraged so slightly-bent arms
  // beat locked-out arms when both are clear. Only the part above 85% of max.
  const avgStretch = (sim.reachStretch.blue + sim.reachStretch.red) / 2;
  loss += W_STRETCH * Math.max(0, avgStretch - 0.85);

  return loss;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
