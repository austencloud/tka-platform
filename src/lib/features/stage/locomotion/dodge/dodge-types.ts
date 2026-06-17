// src/lib/features/stage/locomotion/dodge/dodge-types.ts

import type { SimPropTarget } from "$lib/features/lab/tabs/collision-lab/services/types";
import type { StancePose } from "$lib/features/lab/tabs/collision-lab/domain/types";

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
  stance: StancePose;
  feasible: boolean;
  loss: number;
  /**
   * Worst (max) prop-through-torso/head penetration depth across the sweep at
   * the chosen stance, in meters. <= ~0.01 means cleared.
   */
  worstBodyDepth: number;
}
