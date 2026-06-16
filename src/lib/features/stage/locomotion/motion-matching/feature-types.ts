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
