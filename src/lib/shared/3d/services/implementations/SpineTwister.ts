/**
 * SpineTwister
 *
 * When your hands reach across your body, your torso and head naturally
 * turn toward the reaching direction. This reframes the coordinate
 * system - a cross-body reach becomes more like a front-body reach
 * from the spine's perspective. Without this, the avatar looks like
 * a mannequin bolted to a pole.
 *
 * Two degrees of freedom:
 * 1. YAW (Y-axis): torso turns left/right toward the crossing direction
 * 2. LATERAL TILT (Z-axis): torso leans sideways when hands are high
 *    and crossing - prevents arms from clipping through the head
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
 * - Lateral flexion: ~25° thoracic, ~45° cervical
 * - We use ~60° max yaw, ~25° max tilt - within safe range
 */

import { Vector3, Quaternion, Euler } from "three";
import type { SpineTwistResult } from "../contracts/ISpineTwister";

/** Maximum total upper-body yaw (turning left/right) in radians (~60 degrees). */
const MAX_YAW = (60 * Math.PI) / 180;

/** Maximum yaw in single-hand gaze mode (~40 degrees). Softer than
 *  the cross-body reach case - you turn to LOOK at a held prop, you
 *  don't lean your whole torso toward it. */
const SINGLE_HAND_MAX_YAW = (40 * Math.PI) / 180;

/** Maximum lateral tilt (leaning sideways) in radians (~25 degrees). */
const MAX_TILT = (25 * Math.PI) / 180;

/** Half shoulder width for normalizing lateral offset */
const SHOULDER_HALF_WIDTH = 0.2;

/** Hand reach used to normalize single-hand yaw. A hand extended to this
 *  X-offset from body center drives the single-hand yaw to its max. */
const SINGLE_HAND_REACH = 0.5;

/** Identity quaternion reused across idle-branch returns. */
const IDENTITY_QUAT = new Quaternion();

/** How much cross-body tension contributes relative to lateral bias */
const CROSS_TENSION_WEIGHT = 0.5;

/** Hip counter-rotation as a fraction of the total upper-body twist.
 * Negative because hips rotate opposite to the upper body. */
const HIP_COUNTER_FRACTION = -0.20;

/**
 * How high (relative to body center) hands need to be before lateral
 * tilt kicks in. Below this, only yaw is applied. Above, tilt ramps
 * in proportionally. This prevents unnecessary leaning for waist-level
 * cross-body moves where yaw alone is sufficient.
 */
const TILT_HEIGHT_THRESHOLD = 0.25;

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

export class SpineTwister {
  computeSpineTwist(
    leftHandTarget: Vector3 | null,
    rightHandTarget: Vector3 | null,
    bodyCenter: Vector3,
    availableBones?: Set<string>
  ): SpineTwistResult {
    if (leftHandTarget && rightHandTarget) {
      return this.computeTwoHandedTwist(
        leftHandTarget,
        rightHandTarget,
        bodyCenter,
        availableBones
      );
    }
    const presentHand = leftHandTarget ?? rightHandTarget;
    if (presentHand) {
      return this.computeSingleHandGaze(presentHand, bodyCenter, availableBones);
    }
    return this.identityResult();
  }

  /**
   * Cross-body reach: torso leans toward the reaching direction, hips
   * counter-rotate for grounding, head tracks the average cross-body
   * pull. Height-gated lateral tilt keeps high cross-body reaches from
   * clipping arms through the head.
   */
  private computeTwoHandedTwist(
    leftHandTarget: Vector3,
    rightHandTarget: Vector3,
    bodyCenter: Vector3,
    availableBones?: Set<string>
  ): SpineTwistResult {
    const leftX = leftHandTarget.x - bodyCenter.x;
    const rightX = rightHandTarget.x - bodyCenter.x;

    // --- YAW (Y-axis): torso turns toward crossing direction ---

    // Lateral bias: average X offset of both hands
    const lateralBias = (leftX + rightX) / 2;

    // Cross-body tension: how much each hand crosses its natural side
    // Left hand's natural side is -X, so crossing = positive X.
    // Right hand's natural side is +X, so crossing = negative X.
    const leftCross = Math.max(0, -leftX);
    const rightCross = Math.max(0, rightX);
    const crossTension = (leftCross + rightCross) * CROSS_TENSION_WEIGHT;

    // Combined yaw signal
    const yawSignal = lateralBias + Math.sign(lateralBias || 1) * crossTension;

    // Normalize to [-1, 1] range
    const normalizedYaw = Math.max(-1, Math.min(1,
      yawSignal / SHOULDER_HALF_WIDTH
    ));

    const totalYaw = normalizedYaw * MAX_YAW;

    // --- LATERAL TILT (Z-axis): lean sideways for high cross-body reaches ---

    // Average hand height relative to body center
    const leftY = leftHandTarget.y - bodyCenter.y;
    const rightY = rightHandTarget.y - bodyCenter.y;
    const avgHeight = (leftY + rightY) / 2;

    // Tilt only kicks in when hands are above the threshold (shoulder-ish height)
    // and there's meaningful cross-body tension
    const heightFactor = Math.max(0, Math.min(1,
      (avgHeight - TILT_HEIGHT_THRESHOLD) / 0.3
    ));

    // Cross-body factor: 0 = hands on their natural sides, 1 = fully crossed
    const crossFactor = Math.max(0, Math.min(1,
      (leftCross + rightCross) / SHOULDER_HALF_WIDTH
    ));

    // Tilt direction matches the yaw direction (lean toward where you're reaching)
    const tiltSignal = Math.sign(normalizedYaw) * heightFactor * crossFactor;
    const totalTilt = tiltSignal * MAX_TILT;

    // Redistribute weights based on available bones
    const weights = this.redistributeWeights(availableBones);

    return {
      spine1: this.makeSpineRotation(totalYaw * (weights.spine1 ?? 0), totalTilt * (weights.spine1 ?? 0)),
      spine2: this.makeSpineRotation(totalYaw * (weights.spine2 ?? 0), totalTilt * (weights.spine2 ?? 0)),
      neck: this.makeSpineRotation(totalYaw * (weights.neck ?? 0), totalTilt * (weights.neck ?? 0)),
      head: this.makeSpineRotation(totalYaw * (weights.head ?? 0), totalTilt * (weights.head ?? 0)),
      hips: this.makeSpineRotation(totalYaw * HIP_COUNTER_FRACTION, totalTilt * HIP_COUNTER_FRACTION * 0.5),
    };
  }

  /**
   * Single-hand gaze: performer holds one prop and the other hand is
   * absent. Head and upper spine orient toward the present hand; no
   * tilt (no cross-body lean), no hip counter-rotation (gazing at a
   * held prop doesn't need a counter-balanced stance). Softer max
   * yaw than the two-hand case - this is look-at, not reach-across.
   */
  private computeSingleHandGaze(
    handTarget: Vector3,
    bodyCenter: Vector3,
    availableBones?: Set<string>
  ): SpineTwistResult {
    const offsetX = handTarget.x - bodyCenter.x;
    const normalizedYaw = Math.max(-1, Math.min(1, offsetX / SINGLE_HAND_REACH));
    const totalYaw = normalizedYaw * SINGLE_HAND_MAX_YAW;

    const weights = this.redistributeWeights(availableBones);

    return {
      spine1: this.makeSpineRotation(totalYaw * (weights.spine1 ?? 0), 0),
      spine2: this.makeSpineRotation(totalYaw * (weights.spine2 ?? 0), 0),
      neck: this.makeSpineRotation(totalYaw * (weights.neck ?? 0), 0),
      head: this.makeSpineRotation(totalYaw * (weights.head ?? 0), 0),
      hips: new Quaternion(),
    };
  }

  /** No twist. Used when both hands are absent. */
  private identityResult(): SpineTwistResult {
    return {
      spine1: IDENTITY_QUAT.clone(),
      spine2: IDENTITY_QUAT.clone(),
      neck: IDENTITY_QUAT.clone(),
      head: IDENTITY_QUAT.clone(),
      hips: IDENTITY_QUAT.clone(),
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

  /**
   * Create a quaternion combining Y-axis yaw and Z-axis lateral tilt.
   * Order matters: tilt first (local Z), then yaw (local Y).
   */
  private makeSpineRotation(yaw: number, tilt: number): Quaternion {
    const q = new Quaternion();
    if (Math.abs(yaw) < 0.0001 && Math.abs(tilt) < 0.0001) return q;
    // Euler order YZX: yaw around Y, tilt around Z, composed correctly
    const euler = new Euler(0, yaw, tilt, "YZX");
    q.setFromEuler(euler);
    return q;
  }
}
