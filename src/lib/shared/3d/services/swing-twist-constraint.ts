import { Quaternion, Vector3 } from "three";

const SHOULDER_LIMITS = {
  forward: (160 * Math.PI) / 180,
  backward: (60 * Math.PI) / 180,
  abduction: (170 * Math.PI) / 180,
  adduction: (75 * Math.PI) / 180,
};

const SHOULDER_TWIST_MIN = (-90 * Math.PI) / 180;
const SHOULDER_TWIST_MAX = (90 * Math.PI) / 180;
const ELBOW_FLEXION_MIN = 0;
const ELBOW_FLEXION_MAX = (145 * Math.PI) / 180;

export interface SwingTwist {
  swing: Quaternion;
  twist: Quaternion;
}

export function decomposeSwingTwist(q: Quaternion, twistAxis: Vector3): SwingTwist {
  const projection = twistAxis.clone().multiplyScalar(
    q.x * twistAxis.x + q.y * twistAxis.y + q.z * twistAxis.z
  );

  const tx = projection.x;
  const ty = projection.y;
  const tz = projection.z;
  const twW = q.w;

  const len = Math.sqrt(tx * tx + ty * ty + tz * tz + twW * twW);

  if (len < 1e-10) {
    return { swing: q.clone(), twist: new Quaternion() };
  }

  const invLen = 1 / len;
  const twist = new Quaternion(tx * invLen, ty * invLen, tz * invLen, twW * invLen);

  const swing = q.clone().multiply(twist.clone().conjugate());

  return { swing, twist };
}

export function constrainShoulderCone(
  shoulderQuat: Quaternion,
  restDir: Vector3,
  side: "left" | "right",
): Quaternion {
  const twistAxis = restDir.clone().normalize();
  const { swing, twist } = decomposeSwingTwist(shoulderQuat, twistAxis);

  const clampedTwist = clampTwistAngle(twist, twistAxis, SHOULDER_TWIST_MIN, SHOULDER_TWIST_MAX);
  const clampedSwing = clampSwingElliptical(swing, twistAxis, side);

  return clampedSwing.multiply(clampedTwist);
}

function clampTwistAngle(
  twist: Quaternion,
  twistAxis: Vector3,
  minRad: number,
  maxRad: number,
): Quaternion {
  const dotSign = twist.x * twistAxis.x + twist.y * twistAxis.y + twist.z * twistAxis.z;
  let angle = 2 * Math.atan2(Math.abs(dotSign), Math.abs(twist.w));
  if (dotSign < 0) angle = -angle;
  if (twist.w < 0) angle = -angle;

  const clamped = Math.max(minRad, Math.min(maxRad, angle));
  if (Math.abs(clamped - angle) < 1e-6) return twist.clone();

  return new Quaternion().setFromAxisAngle(twistAxis, clamped);
}

function clampSwingElliptical(
  swing: Quaternion,
  twistAxis: Vector3,
  side: "left" | "right",
): Quaternion {
  const swingAngle = 2 * Math.acos(Math.max(-1, Math.min(1, swing.w)));
  if (swingAngle < 1e-6) return swing.clone();

  const swingAxis = new Vector3(swing.x, swing.y, swing.z);
  const axisLen = swingAxis.length();
  if (axisLen < 1e-10) return swing.clone();
  swingAxis.divideScalar(axisLen);

  const up = new Vector3(0, 1, 0);
  let forward = new Vector3().crossVectors(twistAxis, up);
  if (forward.lengthSq() < 0.01) {
    forward = new Vector3(0, 0, 1);
  }
  forward.normalize();
  const actualUp = new Vector3().crossVectors(forward, twistAxis).normalize();

  const forwardComponent = swingAxis.dot(forward);
  const upComponent = swingAxis.dot(actualUp);

  const azimuth = Math.atan2(upComponent, forwardComponent);

  const cosAz = Math.cos(azimuth);
  const sinAz = Math.sin(azimuth);

  const forwardLimit = cosAz >= 0 ? SHOULDER_LIMITS.forward : SHOULDER_LIMITS.backward;

  const adductionSide = side === "left" ? -1 : 1;
  const abductionLimit = (sinAz * adductionSide) >= 0
    ? SHOULDER_LIMITS.abduction
    : SHOULDER_LIMITS.adduction;

  const a = forwardLimit;
  const b = abductionLimit;
  const denomSq = (b * cosAz) * (b * cosAz) + (a * sinAz) * (a * sinAz);
  const maxSwing = (a * b) / Math.sqrt(Math.max(1e-10, denomSq));

  if (swingAngle <= maxSwing) return swing.clone();

  return new Quaternion().setFromAxisAngle(swingAxis, maxSwing);
}

export function constrainElbowHinge(
  elbowQuat: Quaternion,
  bendAxis: Vector3,
  restDir: Vector3,
): Quaternion {
  const normalizedBend = bendAxis.clone().normalize();

  const { swing: flexionPart } = decomposeSwingTwist(elbowQuat, restDir);

  let flexionAngle = 2 * Math.acos(Math.max(-1, Math.min(1, flexionPart.w)));

  const flexionAxis = new Vector3(flexionPart.x, flexionPart.y, flexionPart.z);
  const axisLen = flexionAxis.length();
  if (axisLen > 1e-10) {
    flexionAxis.divideScalar(axisLen);
    if (flexionAxis.dot(normalizedBend) < 0) {
      flexionAngle = -flexionAngle;
    }
  }

  const clampedAngle = Math.max(ELBOW_FLEXION_MIN, Math.min(ELBOW_FLEXION_MAX, flexionAngle));

  return new Quaternion().setFromAxisAngle(normalizedBend, clampedAngle);
}
