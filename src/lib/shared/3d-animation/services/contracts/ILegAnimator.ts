/**
 * ILegAnimator
 *
 * Controls leg animations independently from upper body.
 * Plays walk/run cycles based on locomotion state while
 * arms remain controlled by prop IK.
 *
 * Uses animation masking to only affect leg bones:
 * - Hips (partial - only rotation)
 * - LeftUpLeg, LeftLeg, LeftFoot
 * - RightUpLeg, RightLeg, RightFoot
 */

import type { Object3D, AnimationClip } from "three";

/**
 * Locomotion state from the avatar movement system
 */
export interface LocomotionInput {
  /** Whether the avatar is currently moving */
  isMoving: boolean;
  /** Movement speed (0-1 normalized, affects animation playback rate) */
  speed: number;
  /** Optional: facing angle for root motion alignment */
  facingAngle?: number;
  /** Movement direction relative to facing: x (-1 left, +1 right), z (-1 back, +1 forward) */
  moveDirection?: { x: number; z: number };
}

/**
 * URLs for directional walk animations
 */
export interface DirectionalAnimationUrls {
  forward: string;
  backward: string;
  strafeLeft: string;
  strafeRight: string;
}

/**
 * Configuration for leg animation behavior
 */
export interface LegAnimatorConfig {
  /** Base playback speed multiplier (default: 1) */
  baseSpeed?: number;
  /** Blend time when starting/stopping walk (seconds, default: 0.2) */
  blendTime?: number;
  /** Whether to apply root motion from animation (default: false) */
  useRootMotion?: boolean;
}

export interface ILegAnimator {
  /**
   * Initialize with the avatar's root object and skeleton.
   * Must be called after the GLTF model is loaded.
   * @param root The avatar's root Object3D containing the skeleton
   */
  initialize(root: Object3D): void;

  /**
   * Load a walk animation from a GLTF/GLB file.
   * The animation will be masked to only affect leg bones.
   * @param url Path to the animation file
   */
  loadWalkAnimation(url: string): Promise<void>;

  /**
   * Load all directional walk animations for 4-way blending.
   * Enables smooth transitions between forward, backward, and strafe.
   * @param urls Paths to all directional animation files
   */
  loadDirectionalAnimations(urls: DirectionalAnimationUrls): Promise<void>;

  /**
   * Set a pre-loaded animation clip as the walk animation.
   * Useful when the walk animation is embedded in the avatar GLTF.
   * @param clip The animation clip to use
   */
  setWalkClip(clip: AnimationClip): void;

  /**
   * Update locomotion state from the movement system.
   * Call this when isMoving or speed changes.
   * @param input Current locomotion state
   */
  setLocomotion(input: LocomotionInput): void;

  /**
   * Update animation each frame.
   * Call from useTask/requestAnimationFrame loop.
   * @param delta Time since last frame in seconds
   */
  update(delta: number): void;

  /**
   * Check if the animator is ready (initialized + animation loaded)
   */
  isReady(): boolean;

  /**
   * Configure animation behavior
   */
  configure(config: LegAnimatorConfig): void;

  /**
   * Clean up resources
   */
  dispose(): void;
}
