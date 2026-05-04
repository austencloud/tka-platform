/**
 * ClavicleRaiser
 *
 * When you raise your arm overhead, your collarbone (clavicle) tilts
 * upward at the sternoclavicular joint to give the arm more room. This
 * is called scapulohumeral rhythm.
 */

import { Vector3, Quaternion } from "three";

/** Maximum clavicle elevation in radians (~15 degrees) */
const MAX_CLAVICLE_ELEVATION = (15 * Math.PI) / 180;

/**
 * Fraction of arm length the hand must exceed above shoulder
 * before the clavicle starts responding.
 */
const ACTIVATION_THRESHOLD = 0.2;

export function computeClavicleRotation(
  handTarget: Vector3,
  side: "left" | "right",
  shoulderRestY: number,
  armLength: number,
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

  const normalizedRatio = (elevationRatio - ACTIVATION_THRESHOLD) / (1 - ACTIVATION_THRESHOLD);

  const smoothed = normalizedRatio * normalizedRatio * (3 - 2 * normalizedRatio);

  const angle = smoothed * MAX_CLAVICLE_ELEVATION;

  const sign = side === "left" ? -1 : 1;

  const result = new Quaternion();
  result.setFromAxisAngle(new Vector3(1, 0, 0), angle * sign);
  return result;
}
