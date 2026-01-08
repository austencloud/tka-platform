/**
 * Promo Animation Controller Contract
 *
 * Controls device and camera animations using GSAP timelines.
 * Manages animation presets and provides playback control.
 */

import type * as THREE from "three";
import type {
  AnimationPreset,
  AnimationKeyframe,
  CameraState,
  DeviceState,
} from "../../domain/promo-models";

/**
 * Animation playback state
 */
export interface AnimationPlaybackState {
  /** Whether the animation is currently playing */
  isPlaying: boolean;
  /** Whether the animation is paused */
  isPaused: boolean;
  /** Current time position (0-1 normalized) */
  progress: number;
  /** Current time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
}

/**
 * Callback for animation progress updates
 */
export type AnimationProgressCallback = (
  progress: number,
  currentTime: number
) => void;

export interface IPromoAnimationController {
  /**
   * Initialize the controller with scene objects
   * @param device - The device group to animate
   * @param camera - The camera to animate
   * @param cameraDistance - Recommended camera distance for scaling presets
   */
  initialize(
    device: THREE.Group,
    camera: THREE.PerspectiveCamera,
    cameraDistance?: number
  ): void;

  /**
   * Load an animation preset
   * @param preset - The preset to load
   */
  loadPreset(preset: AnimationPreset): void;

  /**
   * Load a preset by ID from the registry
   * @param presetId - The preset identifier
   */
  loadPresetById(presetId: string): void;

  /**
   * Create a custom animation from keyframes
   * @param keyframes - Array of keyframes
   * @param duration - Total duration in seconds
   */
  createAnimation(keyframes: AnimationKeyframe[], duration: number): void;

  /**
   * Play the animation
   * @param onProgress - Optional callback for progress updates
   */
  play(onProgress?: AnimationProgressCallback): void;

  /**
   * Pause the animation
   */
  pause(): void;

  /**
   * Resume a paused animation
   */
  resume(): void;

  /**
   * Stop the animation and reset to beginning
   */
  stop(): void;

  /**
   * Seek to a specific time position
   * @param normalizedTime - Time position (0-1)
   */
  seek(normalizedTime: number): void;

  /**
   * Get the current playback state
   */
  getPlaybackState(): AnimationPlaybackState;

  /**
   * Get the current animation progress (0-1)
   */
  getProgress(): number;

  /**
   * Set the camera state directly
   * @param state - The camera state to apply
   */
  setCameraState(state: CameraState): void;

  /**
   * Set the device state directly
   * @param state - The device state to apply
   */
  setDeviceState(state: DeviceState): void;

  /**
   * Get all available animation presets
   */
  getAvailablePresets(): AnimationPreset[];

  /**
   * Register a custom preset
   * @param preset - The preset to register
   */
  registerPreset(preset: AnimationPreset): void;

  /**
   * Set animation speed multiplier
   * @param speed - Speed multiplier (1 = normal, 2 = double speed, 0.5 = half speed)
   */
  setSpeed(speed: number): void;

  /**
   * Dispose of animation resources
   */
  dispose(): void;
}
