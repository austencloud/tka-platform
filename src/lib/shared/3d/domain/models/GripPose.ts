import type { Bone } from "three";

/** All grip types for staff manipulation */
export enum GripType {
  /** Relaxed open hand, fingers slightly curled. Default/idle. */
  IDLE = "idle",
  /** Full palm wrap around staff shaft. Wrist-driven rotation. */
  SQUARE = "square",
  /** Thumb + index + middle pinch, ring/pinky relaxed. Finger-driven rotation. */
  PENCIL = "pencil",
  /** Light cradle in curved fingers, thumb alongside. Passive hold. */
  CRADLE = "cradle",
  /** Flat open palm, staff resting on top. Catches and plane transitions. */
  OPEN_PALM = "open_palm",
  /** All fingers released. Staff is airborne. */
  RELEASE = "release",
}

/** Finger bone names in canonical order. 15 per hand. */
export const FINGER_BONES = [
  "Thumb1", "Thumb2", "Thumb3",
  "Index1", "Index2", "Index3",
  "Middle1", "Middle2", "Middle3",
  "Ring1", "Ring2", "Ring3",
  "Pinky1", "Pinky2", "Pinky3",
] as const;

export type FingerBoneName = (typeof FINGER_BONES)[number];

/**
 * A grip pose: 15 quaternions [x, y, z, w], one per finger bone in FINGER_BONES order.
 * Authored for left hand. Right hand mirrors at application time.
 */
export interface GripPose {
  readonly name: string;
  readonly type: GripType;
  readonly rotations: readonly [number, number, number, number][];
}

/** Mapped finger bones for both hands. */
export interface FingerChains {
  left: Map<FingerBoneName, Bone>;
  right: Map<FingerBoneName, Bone>;
}

/**
 * Mirror a quaternion for right-hand application.
 * Negates Y and Z components (reflection across the YZ plane).
 */
export function mirrorQuaternion(
  q: [number, number, number, number]
): [number, number, number, number] {
  return [q[0], -q[1], -q[2], q[3]];
}
