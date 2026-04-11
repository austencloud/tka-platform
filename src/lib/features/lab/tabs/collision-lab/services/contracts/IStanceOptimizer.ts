/**
 * IStanceOptimizer
 *
 * Given a pose (which says where the hands need to go) and access to a
 * simulator, find the stance parameters (foot offset, root yaw, spine
 * pitch) that minimize a loss function combining reachability, collision
 * depth, balance, and joint comfort.
 *
 * The optimizer is gradient-free — it uses coordinate descent with an
 * adaptive step size, which works well for the 4-dimensional search
 * space and doesn't need differentiable physics.
 *
 * Domain: Collision Lab — automated stance search
 */

import type { Vector3 } from "three";
import type { StancePose } from "../../domain/types";
import type { IStanceSimulator, SimPropTarget, SimResult } from "./IStanceSimulator";

/**
 * The pose targets the optimizer is trying to satisfy. This is a subset
 * of the full PoseDefinition — the optimizer only needs to know where the
 * hands must land, not which enum values represent them.
 */
export interface OptimizerInput {
  blue: SimPropTarget;
  red: SimPropTarget;
}

/** Hard bounds on each stance parameter. */
export interface OptimizerBounds {
  footOffsetX: { min: number; max: number };
  footOffsetZ: { min: number; max: number };
  rootYawRad: { min: number; max: number };
  spinePitchRad: { min: number; max: number };
}

/** Result of a full optimization run. */
export interface OptimizerResult {
  /** The best stance found. */
  stance: StancePose;
  /** Scalar loss of that stance (lower is better). */
  loss: number;
  /** The raw sim result for the best stance — lets the UI show
   *  reachability / collision details without re-running the sim. */
  simResult: SimResult;
  /** Number of evaluations actually performed. Useful for perf tuning. */
  evaluations: number;
  /** Whether the best stance is considered feasible by the simulator
   *  (reachable + clear + balanced + comfortable). */
  feasible: boolean;
}

export interface IStanceOptimizer {
  /**
   * Find the best stance for the given pose, starting from an initial
   * guess (usually the neutral rest stance). Internally runs multi-start
   * coordinate descent from a fixed ring of yaw seeds and picks the best.
   * Used by the CLI scanner and the first-auto-seed pathway.
   */
  optimize(
    input: OptimizerInput,
    initial: StancePose,
    bounds: OptimizerBounds
  ): OptimizerResult;

  /**
   * Run a single coordinate-descent pass from exactly one seed stance.
   * Unlike `optimize`, this does NOT do multi-start — it honors the seed
   * literally and refines from there. The multiple-choice candidate
   * generator uses this to build N visually-distinct solutions, one per
   * hand-chosen seed, each stuck in its own basin of the loss surface.
   *
   * @param input   Prop targets (same as `optimize`).
   * @param seed    The starting stance. Clamped to bounds before descent.
   * @param bounds  Search bounds.
   * @param budget  Maximum simulator evaluations before the descent stops.
   *                Defaults to a small budget (150) since callers typically
   *                run this many times in quick succession.
   */
  optimizeFromSeed(
    input: OptimizerInput,
    seed: StancePose,
    bounds: OptimizerBounds,
    budget?: number
  ): OptimizerResult;

  /** The simulator this optimizer uses. Exposed so the state factory
   *  can run single-stance evaluations for UI feedback without
   *  re-plumbing a second dependency. */
  readonly simulator: IStanceSimulator;
}
