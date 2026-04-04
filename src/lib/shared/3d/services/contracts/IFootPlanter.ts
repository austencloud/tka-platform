/**
 * IFootPlanter
 *
 * Post-process foot IK that runs after the animation mixer each frame.
 * Detects when feet are in contact phase (low velocity = planted) and
 * uses two-bone IK (UpLeg -> Leg -> Foot) to pin them to the ground.
 *
 * This is the same approach Unity's Foot IK and Unreal's Control Rig
 * use as a final correction pass after animation blending.
 *
 * Pipeline position:
 *   LocomotionAnimator.update()  (writes bone quaternions from clips)
 *   -> FootPlanter.update()      (pins feet to ground via IK)
 *   -> AvatarAnimator.update()   (arm IK for props)
 */

import type { LocomotionState } from "./IAnimationStateMachine";
import type { IAvatarSkeletonBuilder } from "./IAvatarSkeletonBuilder";
import type { IIKSolver } from "./IIKSolver";

/**
 * Per-frame input from the movement system.
 */
export interface FootPlanterInput {
  /** World Y of the ground plane under the avatar */
  groundY: number;
  /** Current locomotion state (affects blending strategy) */
  locomotionState: LocomotionState;
  /** Whether the avatar is currently moving */
  isMoving: boolean;
}

/**
 * Configuration for foot planting behavior.
 */
export interface FootPlanterConfig {
  /** Foot velocity threshold below which the foot is considered "planted" (units/sec).
   *  Default: 0.15 — low enough to catch the stance phase of a walk cycle. */
  contactVelocityThreshold?: number;
  /** How quickly the IK blend weight ramps up when a foot enters contact (seconds).
   *  Default: 0.08 — fast enough to not see the foot drift. */
  lockBlendInTime?: number;
  /** How quickly the IK blend weight ramps down when a foot lifts off (seconds).
   *  Default: 0.15 — slightly slower so the unlock isn't jarring. */
  lockBlendOutTime?: number;
  /** Maximum pelvis height adjustment (scene units). Prevents extreme corrections.
   *  Default: 0.1 */
  maxPelvisAdjust?: number;
  /** Vertical offset from ground for the foot bone target (scene units).
   *  Accounts for the distance between the ankle joint and the sole.
   *  Default: 0.02 */
  footHeightOffset?: number;
}

export interface IFootPlanter {
  /**
   * Initialize with skeleton and IK solver references.
   * Must be called after the GLTF model is loaded and leg chains are built.
   */
  initialize(skeleton: IAvatarSkeletonBuilder, ikSolver: IIKSolver): void;

  /**
   * Run foot planting IK. Call each frame AFTER LocomotionAnimator.update()
   * and BEFORE AvatarAnimator.update().
   */
  update(delta: number, input: FootPlanterInput): void;

  /**
   * Configure foot planting behavior.
   */
  configure(config: FootPlanterConfig): void;

  /**
   * Whether the foot planter is initialized and has valid leg chains.
   */
  isReady(): boolean;

  /**
   * Clean up resources.
   */
  dispose(): void;
}
