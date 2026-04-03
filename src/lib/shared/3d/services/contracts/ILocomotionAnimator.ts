/**
 * ILocomotionAnimator
 *
 * Plays full-body Mixamo animation clips (idle, walk, strafe)
 * via Three.js AnimationMixer. Unlike the old LegAnimator, this
 * does NOT filter out upper body bones -- the full skeleton is
 * animated. IK post-processing in AvatarAnimator selectively
 * overrides arm bones when props are held.
 */

import type { Object3D, AnimationClip } from "three";
import type { LocomotionState } from "./IAnimationStateMachine";

/**
 * Locomotion state from the avatar movement system
 */
export interface LocomotionInput {
  /** Whether the avatar is currently moving */
  isMoving: boolean;
  /** Movement speed in scene units/sec (used to sync animation playback with actual movement) */
  speed: number;
  /** Optional: facing angle for root motion alignment */
  facingAngle?: number;
  /** Movement direction relative to facing: x (-1 left, +1 right), z (-1 back, +1 forward) */
  moveDirection?: { x: number; z: number };
}

/**
 * URLs for all locomotion animation clips
 */
export interface AnimationUrls {
  idle: string;
  forward: string;
  backward: string;
  strafeLeft: string;
  strafeRight: string;
  /** Jump ascent clip (optional — needed for jump/fall/land states) */
  jump?: string;
  /** Sustained fall loop (optional) */
  fall?: string;
  /** One-shot landing recovery (optional) */
  land?: string;
  /** Crouch idle loop (optional) */
  crouch?: string;
}

/**
 * Configuration for locomotion animation behavior
 */
export interface LocomotionConfig {
  /** Base playback speed multiplier (default: 1) */
  baseSpeed?: number;
  /** Blend time when transitioning between states (seconds, default: 0.3) */
  blendTime?: number;
  /**
   * The walk animation's natural speed in scene units/sec.
   * Mixamo walk animations are typically ~1.4 m/s.
   * Animation timeScale = actualSpeed / animationWalkSpeed
   * so feet match actual ground movement. Default: 1.4
   */
  animationWalkSpeed?: number;
}

export interface ILocomotionAnimator {
  /**
   * Initialize with the avatar's root object.
   * Must be called after the GLTF model is loaded.
   */
  initialize(root: Object3D): void;

  /**
   * Load all locomotion animation clips (idle + 4 directional walks).
   * Clips are retargeted to match the avatar's bone naming convention
   * and play on ALL bones (full body, not leg-filtered).
   */
  loadAnimations(urls: AnimationUrls): Promise<void>;

  /**
   * Update locomotion state from the movement system.
   * Triggers idle/walk crossfade and directional weight blending.
   */
  setLocomotion(input: LocomotionInput): void;

  /**
   * Update animation each frame. Call from useTask/requestAnimationFrame loop.
   * @param delta Time since last frame in seconds
   */
  update(delta: number): void;

  /**
   * Check if the animator is ready (initialized + at least one animation loaded)
   */
  isReady(): boolean;

  /**
   * Configure animation behavior
   */
  configure(config: LocomotionConfig): void;

  /**
   * Set which locomotion state is active (drives clip selection beyond idle/walk).
   * When called, takes priority over the idle↔walk logic in setLocomotion().
   * If never called, LocomotionAnimator works exactly as before (backward compatible).
   */
  setActiveState?(state: LocomotionState): void;

  /**
   * Clean up all resources (mixer, actions, clips)
   */
  dispose(): void;
}
