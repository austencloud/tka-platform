// src/lib/features/stage/locomotion/dodge/dodge-types.ts

import type { SimPropTarget } from "$lib/features/lab/tabs/collision-lab/services/types";

/**
 * One sampled instant of a staff along its motion: the same SimPropTarget the
 * StanceSimulator already understands (grip + shaft segment + radius).
 */
export type SweepSample = SimPropTarget;

/** A hand's whole motion sampled into N staff instants. */
export interface SweptVolume {
  samples: SweepSample[];
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
