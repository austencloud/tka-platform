/**
 * SpineTwister
 *
 * When your hands reach across your body, your torso and head naturally
 * turn toward the reaching direction. This reframes the coordinate
 * system — a cross-body reach becomes more like a front-body reach
 * from the spine's perspective. Without this, the avatar looks like
 * a mannequin bolted to a pole.
 *
 * The twist distributes anatomically up the spine chain. If the model
 * is missing bones (common: Spine2/upper_chest), the missing bone's
 * weight is redistributed proportionally to the bones that exist.
 *
 * Hips counter-rotate opposite to the upper body at ~20% of the
 * total twist, keeping the avatar grounded rather than spinning
 * from the waist up.
 *
 * Biomechanics reference:
 * - Thoracic spine: ~47° total axial rotation capacity
 * - Cervical spine: ~85° total axial rotation capacity
 * - We use ~45° max total, within safe range
 */

import { Vector3, Quaternion } from "three";
import type { ISpineTwister, SpineTwistResult } from "../contracts/ISpineTwister";

/** Maximum total upper-body twist in radians (~45 degrees). */
const MAX_TOTAL_TWIST = (45 * Math.PI) / 180;

/** Half shoulder width for normalizing lateral offset */
const SHOULDER_HALF_WIDTH = 0.2;

/** How much cross-body tension contributes relative to lateral bias */
const CROSS_TENSION_WEIGHT = 0.5;

/** Hip counter-rotation as a fraction of the total upper-body twist.
 * Negative because hips rotate opposite to the upper body. */
const HIP_COUNTER_FRACTION = -0.20;

/**
 * Ideal distribution weights for the upper spine chain.
 * Weighted toward the upper back where shoulders attach.
 * These get redistributed at runtime if bones are missing.
 */
const IDEAL_WEIGHTS: Record<string, number> = {
  spine1: 0.25,
  spine2: 0.35,
  neck: 0.15,
  head: 0.25,
};

export class SpineTwister implements ISpineTwister {
  computeSpineTwist(
    leftHandTarget: Vector3,
    rightHandTarget: Vector3,
    bodyCenter: Vector3,
    availableBones?: Set<string>
  ): SpineTwistResult {
    const leftX = leftHandTarget.x - bodyCenter.x;
    const rightX = rightHandTarget.x - bodyCenter.x;

    // Lateral bias: average X offset of both hands
    const lateralBias = (leftX + rightX) / 2;

    // Cross-body tension: how much each hand crosses its natural side
    const leftCross = Math.max(0, -leftX);
    const rightCross = Math.max(0, rightX);
    const crossTension = (leftCross + rightCross) * CROSS_TENSION_WEIGHT;

    // Combined signal
    const twistSignal = lateralBias + Math.sign(lateralBias || 1) * crossTension;

    // Normalize to [-1, 1] range
    const normalizedSignal = Math.max(-1, Math.min(1,
      twistSignal / SHOULDER_HALF_WIDTH
    ));

    const totalAngle = normalizedSignal * MAX_TOTAL_TWIST;

    // Redistribute weights based on available bones
    const weights = this.redistributeWeights(availableBones);

    return {
      spine1: this.makeYRotation(totalAngle * (weights.spine1 ?? 0)),
      spine2: this.makeYRotation(totalAngle * (weights.spine2 ?? 0)),
      neck: this.makeYRotation(totalAngle * (weights.neck ?? 0)),
      head: this.makeYRotation(totalAngle * (weights.head ?? 0)),
      hips: this.makeYRotation(totalAngle * HIP_COUNTER_FRACTION),
    };
  }

  /**
   * If the model is missing bones, redistribute their weight proportionally
   * to the bones that exist. This way the total twist stays the same
   * regardless of how many spine bones the model has.
   */
  private redistributeWeights(
    availableBones?: Set<string>
  ): Record<string, number> {
    // If no bone info provided, assume all present
    if (!availableBones) return { ...IDEAL_WEIGHTS };

    const keys = Object.keys(IDEAL_WEIGHTS);
    // Map bone keys to the BoneName format used in the bone map
    const keyToBoneName: Record<string, string> = {
      spine1: "Spine1",
      spine2: "Spine2",
      neck: "Neck",
      head: "Head",
    };

    let presentTotal = 0;
    const present: string[] = [];

    for (const key of keys) {
      const boneName = keyToBoneName[key];
      if (boneName && availableBones.has(boneName)) {
        presentTotal += IDEAL_WEIGHTS[key] ?? 0;
        present.push(key);
      }
    }

    // Build redistributed weights: present bones get scaled up,
    // missing bones get 0
    const result: Record<string, number> = {};
    for (const key of keys) {
      if (present.includes(key) && presentTotal > 0) {
        result[key] = (IDEAL_WEIGHTS[key] ?? 0) / presentTotal;
      } else {
        result[key] = 0;
      }
    }

    return result;
  }

  private makeYRotation(angle: number): Quaternion {
    const q = new Quaternion();
    if (Math.abs(angle) < 0.0001) return q;
    q.setFromAxisAngle(new Vector3(0, 1, 0), angle);
    return q;
  }
}
