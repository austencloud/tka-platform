/**
 * TrajectoryOptimizer
 *
 * Searches for a stance TRAJECTORY — a small set of control keyframes that
 * Catmull-Rom interpolate into a continuous body motion — that clears a staff
 * sweep instant-by-instant while staying reachable, balanced, and comfortable.
 *
 * Where {@link StanceOptimizer} finds ONE fixed stance for the worst instant of
 * the whole sweep (which forces near-max arm extension on a big arc), this lets
 * the body move through the dodge as the prop passes, so each moment gets its
 * own stance. Pairs naturally with the torso-twist DOF: the optimizer can turn
 * the chest edge-on at the instant the staff would otherwise clip it.
 *
 * Algorithm: warm-start every control keyframe at the fixed-stance solution
 * (so the result is never worse than today's answer), then coordinate-descend
 * the K×5 keyframe parameters with adaptive step halving. Each trajectory
 * evaluation samples N dense instants and scores them with the SAME per-instant
 * loss the Collision Lab uses ({@link computeStanceLoss}), plus a light
 * smoothness term on keyframe acceleration.
 *
 * Domain: Stage / dodge — anticipatory collision avoidance
 */

import type { OptimizerBounds, SimPropTarget } from "./types";
import type { StancePose } from "../domain/types";
import type { StanceSimulator } from "./stance-simulator";
import { computeStanceLoss } from "./stance-optimizer";
import {
  sampleTrajectory,
  type StanceTrajectory,
} from "./stance-trajectory";

/** Parametric times of the control keyframes across the sweep. */
const KEY_TIMES = [0, 0.5, 1] as const;

const CHANNELS = [
  "footOffsetX",
  "footOffsetZ",
  "rootYawRad",
  "spinePitchRad",
  "torsoTwistRad",
] as const;
type Channel = (typeof CHANNELS)[number];

const POSITION_CHANNELS: ReadonlySet<Channel> = new Set([
  "footOffsetX",
  "footOffsetZ",
]);

const INIT_STEP: Record<Channel, number> = {
  footOffsetX: 0.08,
  footOffsetZ: 0.08,
  rootYawRad: 0.2,
  spinePitchRad: 0.08,
  torsoTwistRad: 0.2,
};
const MIN_STEP: Record<Channel, number> = {
  footOffsetX: 0.01,
  footOffsetZ: 0.01,
  rootYawRad: 0.02,
  spinePitchRad: 0.02,
  torsoTwistRad: 0.02,
};

// Smoothness weights on keyframe 2nd-difference (acceleration). Light — the
// spline is already C1; this just discourages the optimizer parking adjacent
// keyframes at wildly opposite values.
const W_SMOOTH_POS = 1.5; // per m² of foot-offset acceleration
const W_SMOOTH_ANG = 0.4; // per rad² of yaw/twist/pitch acceleration

// One "trajectory eval" costs N sim evals; keep the product interactive (a
// one-time solve on preset change, cached afterward).
const MAX_TRAJ_EVALS = 400;

export interface TrajectoryOptimizerInput {
  blue: SimPropTarget[];
  red: SimPropTarget[];
}

export interface TrajectoryOptimizerOpts {
  /** Forgive sub-cm reach shortfall the live body closes via shrug/lean. */
  reachTolerance?: number;
  /**
   * Optional soft, stance-dependent bias added per dense sample (e.g. pull the
   * body toward the inside-gamma corner). Sees the sim result so it can gate
   * itself on feasibility and never trade clearance/reach for position.
   */
  stancePenalty?: (stance: StancePose, sim: ReturnType<StanceSimulator["evaluate"]>) => number;
}

export interface TrajectoryResult {
  trajectory: StanceTrajectory;
  /** True only if EVERY dense sample is feasible. */
  feasible: boolean;
  /** Max torso/head/face penetration depth across the sweep (m). */
  worstBodyDepth: number;
  /** Mean arm reachStretch across the sweep (1.0 = locked out). */
  meanStretch: number;
  /** Scalar loss of the trajectory (lower better). */
  loss: number;
  /** Per-dense-sample feasibility, for diagnostics. */
  feasiblePerSample: boolean[];
}

export class TrajectoryOptimizer {
  readonly simulator: StanceSimulator;

  constructor(simulator: StanceSimulator) {
    this.simulator = simulator;
  }

  optimize(
    input: TrajectoryOptimizerInput,
    seed: StancePose,
    bounds: OptimizerBounds,
    opts?: TrajectoryOptimizerOpts
  ): TrajectoryResult {
    const reachTol = opts?.reachTolerance ?? 0;
    const penalty = opts?.stancePenalty;

    // Warm start: every control keyframe = the fixed-stance solution.
    let poses: StancePose[] = KEY_TIMES.map(() =>
      clampStance({ ...seed }, bounds)
    );
    let best = this.score(poses, input, reachTol, penalty);
    let evals = 1;

    const step: Record<Channel, number> = { ...INIT_STEP };

    while (evals < MAX_TRAJ_EVALS) {
      let improved = false;

      for (let k = 0; k < poses.length; k++) {
        for (const ch of CHANNELS) {
          for (const dir of [-1, 1] as const) {
            if (evals >= MAX_TRAJ_EVALS) break;
            const trial = poses.map((p) => ({ ...p }));
            trial[k]![ch] = (trial[k]![ch] ?? 0) + dir * step[ch];
            clampStance(trial[k]!, bounds);
            const s = this.score(trial, input, reachTol, penalty);
            evals++;
            if (s.loss < best.loss - 1e-6) {
              poses = trial;
              best = s;
              improved = true;
            }
          }
        }
      }

      if (!improved) {
        let allMin = true;
        for (const ch of CHANNELS) {
          step[ch] *= 0.5;
          if (step[ch] > MIN_STEP[ch]) allMin = false;
        }
        if (allMin) break;
      }
    }

    return best;
  }

  /** Score one candidate keyframe set: dense per-instant loss + smoothness. */
  private score(
    poses: StancePose[],
    input: TrajectoryOptimizerInput,
    reachTol: number,
    penalty?: TrajectoryOptimizerOpts["stancePenalty"]
  ): TrajectoryResult {
    const trajectory: StanceTrajectory = {
      keyframes: KEY_TIMES.map((t, idx) => ({ t, pose: poses[idx]! })),
    };
    const n = Math.min(input.blue.length, input.red.length);

    let lossSum = 0;
    let stretchSum = 0;
    let worstBodyDepth = 0;
    let allFeasible = true;
    const feasiblePerSample: boolean[] = [];

    for (let i = 0; i < n; i++) {
      const progress = n > 1 ? i / (n - 1) : 0;
      const stance = sampleTrajectory(trajectory, progress);
      const sim = this.simulator.evaluate(stance, input.blue[i]!, input.red[i]!);

      let l = computeStanceLoss(sim, reachTol);
      if (penalty) l += penalty(stance, sim);
      lossSum += l;
      stretchSum += (sim.reachStretch.blue + sim.reachStretch.red) / 2;
      feasiblePerSample.push(sim.feasible);
      if (!sim.feasible) allFeasible = false;

      for (const c of sim.collisions) {
        if (
          (c.zone === "prop-through-head" ||
            c.zone === "prop-through-torso" ||
            c.zone === "arm-through-face") &&
          c.depth > worstBodyDepth
        ) {
          worstBodyDepth = c.depth;
        }
      }
    }

    const meanLoss = lossSum / Math.max(1, n);
    const loss = meanLoss + smoothness(poses);

    return {
      trajectory,
      feasible: allFeasible,
      worstBodyDepth,
      meanStretch: stretchSum / Math.max(1, n),
      loss,
      feasiblePerSample,
    };
  }
}

/** Light penalty on keyframe acceleration (2nd difference), angles unwrapped. */
function smoothness(poses: StancePose[]): number {
  if (poses.length < 3) return 0;
  let s = 0;
  for (const ch of CHANNELS) {
    const v0 = poses[0]![ch] ?? 0;
    let v1 = poses[1]![ch] ?? 0;
    let v2 = poses[2]![ch] ?? 0;
    if (ch === "rootYawRad" || ch === "torsoTwistRad") {
      v1 = unwrapNear(v0, v1);
      v2 = unwrapNear(v1, v2);
    }
    const accel = v0 - 2 * v1 + v2;
    s += (POSITION_CHANNELS.has(ch) ? W_SMOOTH_POS : W_SMOOTH_ANG) * accel * accel;
  }
  return s;
}

function unwrapNear(ref: number, a: number): number {
  let x = a;
  while (x - ref > Math.PI) x -= 2 * Math.PI;
  while (x - ref < -Math.PI) x += 2 * Math.PI;
  return x;
}

function clampStance(stance: StancePose, bounds: OptimizerBounds): StancePose {
  stance.footOffsetX = clamp(stance.footOffsetX, bounds.footOffsetX.min, bounds.footOffsetX.max);
  stance.footOffsetZ = clamp(stance.footOffsetZ, bounds.footOffsetZ.min, bounds.footOffsetZ.max);
  stance.rootYawRad = clamp(stance.rootYawRad, bounds.rootYawRad.min, bounds.rootYawRad.max);
  stance.spinePitchRad = clamp(stance.spinePitchRad, bounds.spinePitchRad.min, bounds.spinePitchRad.max);
  stance.torsoTwistRad = clamp(stance.torsoTwistRad ?? 0, bounds.torsoTwistRad.min, bounds.torsoTwistRad.max);
  return stance;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
