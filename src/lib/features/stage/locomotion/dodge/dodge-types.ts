// src/lib/features/stage/locomotion/dodge/dodge-types.ts

import type { SimPropTarget } from "$lib/features/lab/tabs/collision-lab/services/types";
import type { StancePose } from "$lib/features/lab/tabs/collision-lab/domain/types";
import type { StanceTrajectory } from "$lib/features/lab/tabs/collision-lab/services/stance-trajectory";

/**
 * One sampled instant of a staff along its motion: the same SimPropTarget the
 * StanceSimulator already understands (grip + shaft segment + radius).
 */
export type SweepSample = SimPropTarget;

/** A hand's whole motion sampled into N staff instants. */
export interface SweptVolume {
  samples: SweepSample[];
}

/** The solved dodge for one move. */
export interface DodgeSolution {
  /**
   * Representative single stance (the trajectory sampled at its midpoint) for
   * consumers that still want one pose. The live rig should play `trajectory`.
   */
  stance: StancePose;
  /**
   * The solved stance trajectory — control keyframes the rig samples by sweep
   * progress so the body moves through the dodge instead of holding one pose.
   */
  trajectory: StanceTrajectory;
  /** True only if EVERY sampled instant of the trajectory is feasible. */
  feasible: boolean;
  loss: number;
  /**
   * Worst (max) prop-through-torso/head/face penetration depth across the sweep
   * along the trajectory, in meters. <= ~0.01 means cleared.
   */
  worstBodyDepth: number;
  /** Mean arm reachStretch across the sweep (1.0 = locked out). Diagnostic. */
  meanStretch?: number;
}
