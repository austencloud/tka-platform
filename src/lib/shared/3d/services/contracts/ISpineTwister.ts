/**
 * ISpineTwister
 *
 * Computes how much the spine, head, and hips should rotate when the
 * hands are in cross-body positions. When you reach across your body,
 * your torso and head naturally turn toward the reaching direction,
 * and your hips counter-rotate slightly to maintain balance.
 *
 * The twist is distributed anatomically: lower back barely moves,
 * upper back rotates moderately, head rotates the most.
 * Hips rotate opposite to the upper body at a fraction of the twist.
 *
 * Pure function. No state. Each call is independent.
 */

import type { Vector3, Quaternion } from "three";

export interface SpineTwistResult {
  spine1: Quaternion;
  spine2: Quaternion;
  neck: Quaternion;
  head: Quaternion;
  hips: Quaternion;
}

export interface ISpineTwister {
  /**
   * Compute distributed twist rotations for the spine chain.
   *
   * Three modes by nullability of the hand targets:
   *
   * - **Both present** — cross-body reach. Torso leans toward the reaching
   *   direction with hip counter-rotation; head rotates most, lower back least.
   * - **One present, one null** — single-hand gaze. Torso and head orient
   *   gently toward the present hand. No hip counter-rotation (gazing at a
   *   held prop doesn't need a counter-balanced stance).
   * - **Both null** — no prop in either hand. Identity (no twist).
   *
   * @param leftHandTarget - Left hand position (world space), or null if absent
   * @param rightHandTarget - Right hand position (world space), or null if absent
   * @param bodyCenter - Avatar's torso center (world space)
   * @param availableBones - Which bones the model actually has (for weight redistribution)
   * @returns Quaternions to apply to Spine1, Spine2, Neck, Head, and Hips
   */
  computeSpineTwist(
    leftHandTarget: Vector3 | null,
    rightHandTarget: Vector3 | null,
    bodyCenter: Vector3,
    availableBones?: Set<string>
  ): SpineTwistResult;
}
