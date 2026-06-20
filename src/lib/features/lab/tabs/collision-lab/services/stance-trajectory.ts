/**
 * StanceTrajectory
 *
 * A dodge stance that VARIES across the staff sweep, expressed as a few control
 * keyframes (pose at parametric time t ∈ [0,1]) that are Catmull-Rom
 * interpolated into a continuous stance(progress). The performer does not hold
 * one frozen stance through a dodge — they move through it as the prop passes —
 * so the solver optimizes a handful of control poses and this module turns them
 * into the smooth in-between motion the live rig plays back.
 *
 * Pure math over plain StancePose objects — no three.js, no side effects — so it
 * runs both in the headless optimizer (scoring dense samples) and per-frame in
 * the live DodgeDriver.
 *
 * Domain: Stage / dodge — anticipatory collision avoidance
 */

import type { StancePose } from "../domain/types";

export interface TrajectoryKeyframe {
  /** Parametric time along the sweep, 0 = start … 1 = end. */
  t: number;
  pose: StancePose;
}

export interface StanceTrajectory {
  /** Control keyframes, ascending in `t`. At least one. */
  keyframes: TrajectoryKeyframe[];
}

const ZERO_STANCE: StancePose = {
  footOffsetX: 0,
  footOffsetZ: 0,
  rootYawRad: 0,
  spinePitchRad: 0,
  torsoTwistRad: 0,
};

/** The scalar channels a stance interpolates over. */
const SCALAR_KEYS = [
  "footOffsetX",
  "footOffsetZ",
  "rootYawRad",
  "spinePitchRad",
  "torsoTwistRad",
] as const;
type ScalarKey = (typeof SCALAR_KEYS)[number];

/** Channels that are angles and must be unwrapped before interpolation. */
const ANGLE_KEYS: ReadonlySet<ScalarKey> = new Set(["rootYawRad", "torsoTwistRad"]);

/** Build a flat (constant) trajectory holding one stance for the whole sweep. */
export function flatTrajectory(pose: StancePose): StanceTrajectory {
  return { keyframes: [{ t: 0, pose: { ...ZERO_STANCE, ...pose } }] };
}

function chan(pose: StancePose, key: ScalarKey): number {
  return pose[key] ?? 0;
}

/** Shift `a` by ±2π to lie within π of `ref` (shortest-path unwrap). */
function unwrapNear(ref: number, a: number): number {
  let x = a;
  while (x - ref > Math.PI) x -= 2 * Math.PI;
  while (x - ref < -Math.PI) x += 2 * Math.PI;
  return x;
}

/** Uniform Catmull-Rom basis at parameter u ∈ [0,1] over four control values. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

/**
 * Sample the trajectory at `progress` ∈ [0,1]. Uniform Catmull-Rom per channel
 * with endpoint duplication, so it is C1-continuous and never jerks at a
 * keyframe. Angle channels (rootYaw, torsoTwist) are unwrapped relative to k1
 * before interpolation so a wrap across ±π does not spin the body the long way.
 */
export function sampleTrajectory(
  traj: StanceTrajectory,
  progress: number
): StancePose {
  const kf = traj.keyframes;
  if (kf.length === 0) return { ...ZERO_STANCE };
  if (kf.length === 1) return { ...ZERO_STANCE, ...kf[0]!.pose };

  const p = Math.max(0, Math.min(1, progress));

  // Locate the segment [i, i+1] containing p, then the 4-point CR window.
  let i = 0;
  while (i < kf.length - 2 && p > kf[i + 1]!.t) i++;
  const k0 = kf[Math.max(0, i - 1)]!.pose;
  const k1 = kf[i]!.pose;
  const k2 = kf[i + 1]!.pose;
  const k3 = kf[Math.min(kf.length - 1, i + 2)]!.pose;

  const span = kf[i + 1]!.t - kf[i]!.t;
  const u = span > 1e-6 ? (p - kf[i]!.t) / span : 0;

  const out: StancePose = { ...ZERO_STANCE };
  for (const key of SCALAR_KEYS) {
    const isAngle = ANGLE_KEYS.has(key);
    const v1 = chan(k1, key);
    const v0 = isAngle ? unwrapNear(v1, chan(k0, key)) : chan(k0, key);
    const v2 = isAngle ? unwrapNear(v1, chan(k2, key)) : chan(k2, key);
    const v3 = isAngle ? unwrapNear(v2, chan(k3, key)) : chan(k3, key);
    out[key] = catmullRom(v0, v1, v2, v3, u);
  }
  return out;
}
