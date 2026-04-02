/**
 * ClavicleRaiser
 *
 * When you raise your arm overhead, your collarbone (clavicle) tilts
 * upward at the sternoclavicular joint to give the arm more room. This
 * is called scapulohumeral rhythm. Without it, animated characters look
 * stiff when reaching above their shoulders.
 *
 * The real biomechanics (Inman 1944, Ludewig 2009):
 * - 0°–30° arm elevation: "setting phase" — clavicle barely moves
 * - 30°–90°: clavicle starts elevating
 * - 90°–180°: clavicle reaches max ~15° elevation
 *
 * This implementation follows the FinalIK ShoulderRotator pattern used
 * in thousands of game titles: rotate the clavicle bone before the IK
 * solver reads the skeleton, so the arm chain naturally starts from
 * the elevated shoulder position.
 */

import { Vector3, Quaternion } from "three";
import type { IClavicleRaiser } from "../contracts/IClavicleRaiser";

/** Maximum clavicle elevation in radians (~15 degrees) */
const MAX_CLAVICLE_ELEVATION = (15 * Math.PI) / 180;

/**
 * What fraction of arm length the hand must exceed above shoulder
 * before the clavicle starts responding. Maps to the anatomical
 * "setting phase" where the scapula barely moves.
 */
const ACTIVATION_THRESHOLD = 0.2;

export class ClavicleRaiser implements IClavicleRaiser {
  computeClavicleRotation(
    handTarget: Vector3,
    side: "left" | "right",
    shoulderRestY: number,
    armLength: number
  ): Quaternion {
    const identity = new Quaternion();

    const elevationAbove = handTarget.y - shoulderRestY;
    if (elevationAbove <= 0 || armLength <= 0) {
      return identity;
    }

    const elevationRatio = Math.min(1, elevationAbove / armLength);

    if (elevationRatio < ACTIVATION_THRESHOLD) {
      return identity;
    }

    const normalizedRatio =
      (elevationRatio - ACTIVATION_THRESHOLD) / (1 - ACTIVATION_THRESHOLD);

    // Smoothstep easing so the clavicle doesn't snap on at the threshold
    const smoothed =
      normalizedRatio * normalizedRatio * (3 - 2 * normalizedRatio);

    const angle = smoothed * MAX_CLAVICLE_ELEVATION;

    // Left clavicle tilts toward +Z, right toward -Z (mirrored anatomy)
    const sign = side === "left" ? 1 : -1;

    const result = new Quaternion();
    result.setFromAxisAngle(new Vector3(0, 0, 1), angle * sign);
    return result;
  }
}
