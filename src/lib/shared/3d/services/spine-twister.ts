/**
 * SpineTwister
 *
 * When your hands reach across your body, your torso and head naturally
 * turn toward the reaching direction.
 */

import type { Vector3} from "three";
import { Quaternion, Euler } from "three";

export interface SpineTwistResult {
  spine1: Quaternion;
  spine2: Quaternion;
  neck: Quaternion;
  head: Quaternion;
  hips: Quaternion;
}

const MAX_YAW = (60 * Math.PI) / 180;
const SINGLE_HAND_MAX_YAW = (40 * Math.PI) / 180;
const MAX_TILT = (25 * Math.PI) / 180;
const SHOULDER_HALF_WIDTH = 0.2;
const SINGLE_HAND_REACH = 0.5;
const IDENTITY_QUAT = new Quaternion();
const CROSS_TENSION_WEIGHT = 0.5;
const HIP_COUNTER_FRACTION = -0.20;
const TILT_HEIGHT_THRESHOLD = 0.25;

const IDEAL_WEIGHTS: Record<string, number> = {
  spine1: 0.25,
  spine2: 0.35,
  neck: 0.15,
  head: 0.25,
};

function makeSpineRotation(yaw: number, tilt: number): Quaternion {
  const q = new Quaternion();
  if (Math.abs(yaw) < 0.0001 && Math.abs(tilt) < 0.0001) return q;
  const euler = new Euler(0, yaw, tilt, "YZX");
  q.setFromEuler(euler);
  return q;
}

function redistributeWeights(availableBones?: Set<string>): Record<string, number> {
  if (!availableBones) return { ...IDEAL_WEIGHTS };

  const keys = Object.keys(IDEAL_WEIGHTS);
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

function identityResult(): SpineTwistResult {
  return {
    spine1: IDENTITY_QUAT.clone(),
    spine2: IDENTITY_QUAT.clone(),
    neck: IDENTITY_QUAT.clone(),
    head: IDENTITY_QUAT.clone(),
    hips: IDENTITY_QUAT.clone(),
  };
}

function computeTwoHandedTwist(
  leftHandTarget: Vector3,
  rightHandTarget: Vector3,
  bodyCenter: Vector3,
  availableBones?: Set<string>,
): SpineTwistResult {
  const leftX = leftHandTarget.x - bodyCenter.x;
  const rightX = rightHandTarget.x - bodyCenter.x;

  const lateralBias = (leftX + rightX) / 2;

  const leftCross = Math.max(0, -leftX);
  const rightCross = Math.max(0, rightX);
  const crossTension = (leftCross + rightCross) * CROSS_TENSION_WEIGHT;

  const yawSignal = lateralBias + Math.sign(lateralBias || 1) * crossTension;
  const normalizedYaw = Math.max(-1, Math.min(1, yawSignal / SHOULDER_HALF_WIDTH));
  const totalYaw = normalizedYaw * MAX_YAW;

  const leftY = leftHandTarget.y - bodyCenter.y;
  const rightY = rightHandTarget.y - bodyCenter.y;
  const avgHeight = (leftY + rightY) / 2;

  const heightFactor = Math.max(0, Math.min(1, (avgHeight - TILT_HEIGHT_THRESHOLD) / 0.3));
  const crossFactor = Math.max(0, Math.min(1, (leftCross + rightCross) / SHOULDER_HALF_WIDTH));
  const tiltSignal = Math.sign(normalizedYaw) * heightFactor * crossFactor;
  const totalTilt = tiltSignal * MAX_TILT;

  const weights = redistributeWeights(availableBones);

  return {
    spine1: makeSpineRotation(totalYaw * (weights.spine1 ?? 0), totalTilt * (weights.spine1 ?? 0)),
    spine2: makeSpineRotation(totalYaw * (weights.spine2 ?? 0), totalTilt * (weights.spine2 ?? 0)),
    neck: makeSpineRotation(totalYaw * (weights.neck ?? 0), totalTilt * (weights.neck ?? 0)),
    head: makeSpineRotation(totalYaw * (weights.head ?? 0), totalTilt * (weights.head ?? 0)),
    hips: makeSpineRotation(totalYaw * HIP_COUNTER_FRACTION, totalTilt * HIP_COUNTER_FRACTION * 0.5),
  };
}

function computeSingleHandGaze(
  handTarget: Vector3,
  bodyCenter: Vector3,
  availableBones?: Set<string>,
): SpineTwistResult {
  const offsetX = handTarget.x - bodyCenter.x;
  const normalizedYaw = Math.max(-1, Math.min(1, offsetX / SINGLE_HAND_REACH));
  const totalYaw = normalizedYaw * SINGLE_HAND_MAX_YAW;

  const weights = redistributeWeights(availableBones);

  return {
    spine1: makeSpineRotation(totalYaw * (weights.spine1 ?? 0), 0),
    spine2: makeSpineRotation(totalYaw * (weights.spine2 ?? 0), 0),
    neck: makeSpineRotation(totalYaw * (weights.neck ?? 0), 0),
    head: makeSpineRotation(totalYaw * (weights.head ?? 0), 0),
    hips: new Quaternion(),
  };
}

export function computeSpineTwist(
  leftHandTarget: Vector3 | null,
  rightHandTarget: Vector3 | null,
  bodyCenter: Vector3,
  availableBones?: Set<string>,
): SpineTwistResult {
  if (leftHandTarget && rightHandTarget) {
    return computeTwoHandedTwist(leftHandTarget, rightHandTarget, bodyCenter, availableBones);
  }
  const presentHand = leftHandTarget ?? rightHandTarget;
  if (presentHand) {
    return computeSingleHandGaze(presentHand, bodyCenter, availableBones);
  }
  return identityResult();
}
