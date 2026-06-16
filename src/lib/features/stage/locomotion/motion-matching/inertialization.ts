import { Quaternion } from "three";

/**
 * Quaternion inertializer. Holds the offset between where the pose WAS and where
 * the new clip wants it, and decays that offset to identity over `duration`.
 * applyInertialize returns target * decayedOffset, so the output eases from the
 * old pose into the new clip pose.
 */
export interface Inertializer {
  /** offset = oldPose * newPose^-1 (the rotation from new back to old). */
  readonly offset: Quaternion;
  remaining: number;
  readonly duration: number;
}

const _invNew = new Quaternion();
const _decayed = new Quaternion();
const _identity = new Quaternion();

export function startInertialize(
  oldPose: Quaternion,
  newPose: Quaternion,
  duration: number,
): Inertializer {
  _invNew.copy(newPose).invert();
  const offset = oldPose.clone().multiply(_invNew); // oldPose * newPose^-1
  return { offset, remaining: duration, duration };
}

/**
 * Advance the blend by `dt` and return the visible pose: the new clip target
 * with the decaying offset applied. At remaining=duration → old pose; at
 * remaining<=0 → exactly the target.
 */
export function applyInertialize(
  inert: Inertializer,
  target: Quaternion,
  dt: number,
): Quaternion {
  inert.remaining = Math.max(0, inert.remaining - dt);
  const blend = inert.duration > 0 ? inert.remaining / inert.duration : 0; // 1→0
  _decayed.copy(_identity).slerp(inert.offset, blend);
  return target.clone().premultiply(_decayed);
}
