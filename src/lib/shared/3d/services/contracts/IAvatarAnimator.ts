/**
 * IAvatarAnimator
 *
 * Manages avatar pose states and animation blending.
 * Coordinates between IK targets (from props) and the skeleton.
 */

import type { Vector3, Quaternion } from "three";
import type { PropState3D } from "../../domain/models/PropState3D";

/**
 * Pose for a single hand/arm
 */
export interface HandPose {
  /** Target position in world space */
  targetPosition: Vector3;
  /** Target rotation for wrist (optional) */
  wristRotation?: Quaternion;
  /** Grip type for fingers (future) */
  gripType?: "staff" | "open" | "fist" | "point";
  /** Blend weight (0-1) */
  weight: number;
}

/**
 * Full body pose
 */
export interface BodyPose {
  leftHand: HandPose;
  rightHand: HandPose;
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

export interface IAvatarAnimator {
  /**
   * Set the hand targets from prop states
   * This is the main integration point with TKA motion data
   *
   * Blue prop = performer's left hand = skeleton's LeftHand
   * Red prop = performer's right hand = skeleton's RightHand
   *
   * @param offset Optional position offset for multi-avatar mode.
   *               World prop positions are converted to local by subtracting this offset.
   */
  setHandTargetsFromProps(
    blueProp: PropState3D | null,
    redProp: PropState3D | null,
    offset?: PositionOffset
  ): void;

  /**
   * Set a direct hand target
   */
  setLeftHandTarget(target: HandPose): void;
  setRightHandTarget(target: HandPose): void;

  /**
   * Get the current computed body pose
   */
  getCurrentPose(): BodyPose;

  /**
   * Update animation (call each frame)
   * @param deltaTime Time since last update in seconds
   */
  update(deltaTime: number): void;

  /**
   * Add an animation layer
   */
  addLayer(layer: AnimationLayer): void;

  /**
   * Remove an animation layer
   */
  removeLayer(layerId: string): void;

  /**
   * Set layer weight
   */
  setLayerWeight(layerId: string, weight: number): void;

  /**
   * Blend to a new pose with transition
   */
  transitionTo(pose: BodyPose, config: TransitionConfig): Promise<void>;

  /**
   * Set the idle pose (when no props are being held)
   */
  setIdlePose(pose: BodyPose): void;

  /**
   * Reset to idle pose
   */
  resetToIdle(): void;

  /**
   * Enable/disable smooth blending between poses
   */
  setSmoothBlending(enabled: boolean): void;

  /**
   * Set the smoothing factor (0-1, higher = smoother but laggier)
   */
  setSmoothingFactor(factor: number): void;
}
