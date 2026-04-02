/**
 * ISpineTwister
 *
 * Computes how much the spine and head should rotate when the hands
 * are in cross-body positions. When you reach across your body, your
 * torso and head naturally turn toward the reaching direction. This
 * reframes the coordinate system so a cross-body reach becomes more
 * like a front-body reach from the spine's perspective.
 *
 * The twist is distributed anatomically: lower back barely moves,
 * upper back rotates moderately, head rotates the most.
 *
 * Pure function. No state. Each call is independent.
 */

import type { Vector3, Quaternion } from "three";

export interface SpineTwistResult {
  spine1: Quaternion;
  spine2: Quaternion;
  neck: Quaternion;
  head: Quaternion;
}

export interface ISpineTwister {
  /**
   * Compute distributed twist rotations for the spine chain.
   *
   * @param leftHandTarget - Left hand position (world space)
   * @param rightHandTarget - Right hand position (world space)
   * @param bodyCenter - Avatar's torso center (world space)
   * @returns Four quaternions to apply to Spine1, Spine2, Neck, Head
   */
  computeSpineTwist(
    leftHandTarget: Vector3,
    rightHandTarget: Vector3,
    bodyCenter: Vector3
  ): SpineTwistResult;
}
