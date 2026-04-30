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
   * Set prop states and compute per-arm IK blend weights.
   * Arms with props ramp toward IK (weight 1).
   * Arms without props ramp toward animation (weight 0).
   */
  setPropsAndBlend(
    blueProp: PropState3D | null,
    redProp: PropState3D | null,
    offset?: PositionOffset
  ): void;

  /**
   * Enable/disable smooth blending between poses
   */
  setSmoothBlending(enabled: boolean): void;

  /**
   * Set the smoothing factor (0-1, higher = smoother but laggier)
   */
  setSmoothingFactor(factor: number): void;

  /**
   * Set an extra forward pitch (radians) to apply to Spine1 each frame.
   * Composed on top of the spine twist rest pose before arm IK runs, so
   * the arms solve against a leaned-forward torso. Pass 0 to disable.
   *
   * Used by features that need to override the torso tilt without
   * touching the twist logic - e.g., collision-lab stance variants.
   */
  setExternalSpinePitch(radians: number): void;
}
