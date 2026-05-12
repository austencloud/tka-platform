import { Vector3, Quaternion } from "three";
import { decomposeSwingTwist } from "./swing-twist-constraint";

interface BoneParams {
  aimWeight: number;
  maxSwing: number;
  maxTwist: number;
}

const DEG = Math.PI / 180;

const SQUARE_WEIGHTS: Record<string, BoneParams> = {
  spine:  { aimWeight: 0.00, maxSwing: 35 * DEG, maxTwist: 25 * DEG },
  spine1: { aimWeight: 0.30, maxSwing: 25 * DEG, maxTwist: 15 * DEG },
  spine2: { aimWeight: 0.35, maxSwing: 20 * DEG, maxTwist: 12 * DEG },
  neck:   { aimWeight: 0.15, maxSwing: 45 * DEG, maxTwist: 35 * DEG },
  head:   { aimWeight: 0.80, maxSwing: 70 * DEG, maxTwist: 50 * DEG },
};

const EXPRESSIVE_WEIGHTS: Record<string, BoneParams> = {
  spine:  { aimWeight: 0.60, maxSwing: 35 * DEG, maxTwist: 25 * DEG },
  spine1: { aimWeight: 0.30, maxSwing: 25 * DEG, maxTwist: 15 * DEG },
  spine2: { aimWeight: 0.35, maxSwing: 20 * DEG, maxTwist: 12 * DEG },
  neck:   { aimWeight: 0.30, maxSwing: 45 * DEG, maxTwist: 35 * DEG },
  head:   { aimWeight: 1.00, maxSwing: 70 * DEG, maxTwist: 50 * DEG },
};

const SINGLE_HAND_WEIGHT_SCALE = 0.65;
const HIP_COUNTER_SQUARE = -0.20;
const HIP_COUNTER_EXPRESSIVE = -0.10;

export interface SpineTwistResult {
  spine: Quaternion;
  spine1: Quaternion;
  spine2: Quaternion;
  neck: Quaternion;
  head: Quaternion;
  hips: Quaternion;
}

const SPINE_CHAIN: { key: keyof Omit<SpineTwistResult, "hips">; boneName: string }[] = [
  { key: "spine",  boneName: "Spine" },
  { key: "spine1", boneName: "Spine1" },
  { key: "spine2", boneName: "Spine2" },
  { key: "neck",   boneName: "Neck" },
  { key: "head",   boneName: "Head" },
];

const IDENTITY = new Quaternion();
const Y_AXIS = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);

function lerpBoneParams(a: BoneParams, b: BoneParams, t: number): BoneParams {
  return {
    aimWeight: a.aimWeight + (b.aimWeight - a.aimWeight) * t,
    maxSwing: a.maxSwing,
    maxTwist: a.maxTwist,
  };
}

function clampQuatAngle(q: Quaternion, maxRad: number): Quaternion {
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, q.w)));
  if (angle <= maxRad || angle < 1e-6) return q.clone();
  const sinHalf = Math.sin(angle / 2);
  if (sinHalf < 1e-10) return q.clone();
  const scale = Math.sin(maxRad / 2) / sinHalf;
  return new Quaternion(q.x * scale, q.y * scale, q.z * scale, Math.cos(maxRad / 2));
}

function computeAimTarget(
  left: Vector3 | null,
  right: Vector3 | null,
  bodyCenter: Vector3,
): Vector3 | null {
  if (left && right) {
    const mid = left.clone().add(right).multiplyScalar(0.5);
    const leftCross = Math.max(0, -(left.x - bodyCenter.x));
    const rightCross = Math.max(0, right.x - bodyCenter.x);
    const totalCross = leftCross + rightCross;
    if (totalCross > 0.01) {
      const bias = (rightCross - leftCross) / totalCross;
      mid.x += bias * (right.x - left.x) * 0.25;
      mid.y += bias * (right.y - left.y) * 0.25;
      mid.z += bias * (right.z - left.z) * 0.25;
    }
    return mid;
  }
  return left ?? right ?? null;
}

export function computeSpineTwist(
  leftHandTarget: Vector3 | null,
  rightHandTarget: Vector3 | null,
  bodyCenter: Vector3,
  bodyFreedom: number,
  availableBones?: Set<string>,
): SpineTwistResult {
  const result: SpineTwistResult = {
    spine: IDENTITY.clone(),
    spine1: IDENTITY.clone(),
    spine2: IDENTITY.clone(),
    neck: IDENTITY.clone(),
    head: IDENTITY.clone(),
    hips: IDENTITY.clone(),
  };

  const target = computeAimTarget(leftHandTarget, rightHandTarget, bodyCenter);
  if (!target) return result;

  const singleHand = !leftHandTarget || !rightHandTarget;
  const t = Math.max(0, Math.min(1, bodyFreedom));

  const aimDir = target.clone().sub(bodyCenter);
  if (aimDir.lengthSq() < 1e-8) return result;

  const aimNorm = aimDir.normalize();
  const fullAim = new Quaternion().setFromUnitVectors(FORWARD, aimNorm);

  const { swing: pitchSwing, twist: yawTwist } = decomposeSwingTwist(fullAim, Y_AXIS);

  let totalYawApplied = 0;
  let residualYaw = yawTwist.clone();
  let residualPitch = pitchSwing.clone();

  for (const { key, boneName } of SPINE_CHAIN) {
    if (availableBones && !availableBones.has(boneName)) continue;

    const squareP = SQUARE_WEIGHTS[key];
    const expressiveP = EXPRESSIVE_WEIGHTS[key];
    if (!squareP || !expressiveP) continue;

    const params = lerpBoneParams(squareP, expressiveP, t);
    let weight = params.aimWeight;
    if (singleHand) weight *= SINGLE_HAND_WEIGHT_SCALE;

    if (weight < 0.001) {
      result[key] = IDENTITY.clone();
      continue;
    }

    const scaledYaw = new Quaternion().slerp(residualYaw, weight);
    const clampedYaw = clampQuatAngle(scaledYaw, params.maxTwist);

    const scaledPitch = new Quaternion().slerp(residualPitch, weight);
    const clampedPitch = clampQuatAngle(scaledPitch, params.maxSwing);

    const boneQuat = clampedPitch.clone().multiply(clampedYaw);
    result[key] = boneQuat;

    const yawAngle = 2 * Math.acos(Math.max(-1, Math.min(1, clampedYaw.w)));
    const yawDot = clampedYaw.x * Y_AXIS.x + clampedYaw.y * Y_AXIS.y + clampedYaw.z * Y_AXIS.z;
    totalYawApplied += yawAngle * (yawDot < 0 ? -1 : 1);

    const yawConsumed = clampedYaw.clone().conjugate();
    residualYaw = yawConsumed.multiply(residualYaw);
    const pitchConsumed = clampedPitch.clone().conjugate();
    residualPitch = pitchConsumed.multiply(residualPitch);
  }

  const hipFraction = HIP_COUNTER_SQUARE + (HIP_COUNTER_EXPRESSIVE - HIP_COUNTER_SQUARE) * t;
  if (Math.abs(totalYawApplied) > 0.001) {
    result.hips = new Quaternion().setFromAxisAngle(Y_AXIS, totalYawApplied * hipFraction);
  }

  return result;
}
