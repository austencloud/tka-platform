/**
 * SpineTwister
 *
 * When your hands reach across your body, your torso and head naturally
 * turn toward the reaching direction. This reframes the coordinate
 * system — a cross-body reach becomes more like a front-body reach
 * from the spine's perspective. Without this, the avatar looks like
 * a mannequin bolted to a pole.
 *
 * The twist distributes anatomically up the spine chain:
 * - Spine1 (lower back): barely moves (15% of total)
 * - Spine2 (upper back): moderate rotation (25%)
 * - Neck: follows upper back (25%)
 * - Head: leads the rotation (35%)
 *
 * Biomechanics reference:
 * - Thoracic spine: ~47° total axial rotation capacity
 * - Cervical spine: ~85° total axial rotation capacity
 * - We use ~25° max total, well within safe range
 */

import { Vector3, Quaternion } from "three";
import type { ISpineTwister, SpineTwistResult } from "../contracts/ISpineTwister";

/** Maximum total twist in radians (~25 degrees), distributed across all bones */
const MAX_TOTAL_TWIST = (25 * Math.PI) / 180;

/** Half shoulder width for normalizing lateral offset (same as ElbowPoleComputer) */
const SHOULDER_HALF_WIDTH = 0.2;

/** How much cross-body tension contributes relative to lateral bias */
const CROSS_TENSION_WEIGHT = 0.3;

/**
 * Distribution weights — how much of the total twist each bone gets.
 * Increases up the chain: lower back barely moves, head leads.
 * Must sum to 1.0.
 */
const SPINE1_WEIGHT = 0.15;
const SPINE2_WEIGHT = 0.25;
const NECK_WEIGHT = 0.25;
const HEAD_WEIGHT = 0.35;

export class SpineTwister implements ISpineTwister {
  computeSpineTwist(
    leftHandTarget: Vector3,
    rightHandTarget: Vector3,
    bodyCenter: Vector3
  ): SpineTwistResult {
    const leftX = leftHandTarget.x - bodyCenter.x;
    const rightX = rightHandTarget.x - bodyCenter.x;

    // Lateral bias: average X offset of both hands.
    // Positive = both hands are on the skeleton's left (+X) side.
    const lateralBias = (leftX + rightX) / 2;

    // Cross-body tension: each hand's individual crossing distance.
    // Skeleton convention: left hand's natural side is +X, right hand's is -X.
    // Left hand crossing to right = negative leftX.
    // Right hand crossing to left = positive rightX.
    const leftCross = Math.max(0, -leftX);
    const rightCross = Math.max(0, rightX);
    const crossTension = (leftCross + rightCross) * CROSS_TENSION_WEIGHT;

    // Combined signal: lateral bias + cross tension contribution.
    // Cross tension always adds in the direction of the lateral bias,
    // or toward the side with more crossing if bias is near zero.
    const twistSignal = lateralBias + Math.sign(lateralBias || 1) * crossTension;

    // Normalize to [-1, 1] range by shoulder width
    const normalizedSignal = Math.max(-1, Math.min(1,
      twistSignal / SHOULDER_HALF_WIDTH
    ));

    // Total twist angle
    const totalAngle = normalizedSignal * MAX_TOTAL_TWIST;

    // Distribute across bones
    return {
      spine1: this.makeYRotation(totalAngle * SPINE1_WEIGHT),
      spine2: this.makeYRotation(totalAngle * SPINE2_WEIGHT),
      neck: this.makeYRotation(totalAngle * NECK_WEIGHT),
      head: this.makeYRotation(totalAngle * HEAD_WEIGHT),
    };
  }

  private makeYRotation(angle: number): Quaternion {
    const q = new Quaternion();
    if (Math.abs(angle) < 0.0001) return q; // identity for zero angle
    q.setFromAxisAngle(new Vector3(0, 1, 0), angle);
    return q;
  }
}
