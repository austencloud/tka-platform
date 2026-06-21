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
