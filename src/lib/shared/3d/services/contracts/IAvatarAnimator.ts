/**
 * IAvatarAnimator
 *
 * Manages avatar pose states and animation blending.
 * Coordinates between IK targets (from props) and the skeleton.
 */

import type { Vector3, Quaternion } from "three";
import type { PropState3D } from "../../domain/models/PropState3D";
import type { Plane } from "../../domain/enums/Plane";

/**
 * Pose for a single hand/arm
 */
export interface HandPose {
  /** Target position in world space */
  targetPosition: Vector3;
  /** Target rotation for wrist (optional) */
  wristRotation?: Quaternion;
  /** Staff rotation angle in radians - used to twist the hand to match the prop angle */
  staffAngle?: number;
  /** Grip type for fingers - see GripType enum in GripPose.ts */
  gripType?: import("../../domain/models/GripPose").GripType;
  /** Which plane this hand's prop is operating on */
  plane?: Plane;
  /** Blend weight (0-1) */
  weight: number;
}

/**
 * Full body pose.
 *
 * `leftHand` / `rightHand` may be null when that side holds no prop. Body
 * systems (spine twist, clavicle raise, pole vectors, IK) must treat null
 * as "hand not present" and skip the side rather than reading stale
 * positions from a prior frame.
 */
export interface BodyPose {
  leftHand: HandPose | null;
  rightHand: HandPose | null;
  /** Optional head look target */
  headLookAt?: Vector3;
  /** Root position offset */
  rootOffset?: Vector3;
  /** Timestamp for animation */
  timestamp: number;
}

/**
 * Animation layer for blending
 */
export interface AnimationLayer {
  id: string;
  name: string;
  weight: number;
  pose: BodyPose;
}

/**
 * Blend mode for combining layers
 */
export type BlendMode = "override" | "additive" | "multiply";

/**
 * Animation transition configuration
 */
export interface TransitionConfig {
  /** Duration in seconds */
  duration: number;
  /** Easing function */
  easing: "linear" | "easeIn" | "easeOut" | "easeInOut";
  /** Blend mode */
  blendMode: BlendMode;
}

/**
 * Position offset for converting world coordinates to local
 */
export interface PositionOffset {
  x: number;
  y: number;
  z: number;
}

// IAvatarAnimator interface retired — AvatarAnimator class is the contract now.
