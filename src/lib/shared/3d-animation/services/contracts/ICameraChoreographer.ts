/**
 * ICameraChoreographer Contract
 *
 * Service for managing beat-synchronized camera choreography.
 * Handles keyframe interpolation, performer following, and playback integration.
 */

import type {
  CameraChoreography,
  CameraKeyframe,
  CameraState,
  CameraPosition,
} from "../../domain/camera-choreography";

/**
 * Performer position provider for follow mode
 */
export interface PerformerPositionProvider {
  getPosition(index: number): CameraPosition | null;
}

/**
 * Callback for camera state changes
 */
export type CameraStateChangeCallback = (state: CameraState) => void;

/**
 * Callback for keyframe events
 */
export type KeyframeEventCallback = (keyframe: CameraKeyframe) => void;

export interface ICameraChoreographer {
  // ============================================
  // Choreography Management
  // ============================================

  /**
   * Load a camera choreography
   */
  loadChoreography(choreography: CameraChoreography): void;

  /**
   * Clear current choreography
   */
  clearChoreography(): void;

  /**
   * Get current loaded choreography
   */
  readonly choreography: CameraChoreography | null;

  /**
   * Check if choreography is loaded
   */
  readonly hasChoreography: boolean;

  // ============================================
  // Playback Integration
  // ============================================

  /**
   * Update camera state for current beat/progress
   * Call this each frame or when beat changes
   *
   * @param stepNumber - Current beat index (0-based)
   * @param stepProgress - Progress within current beat (0-1)
   * @param performerProvider - Optional provider for performer positions (for follow mode)
   * @returns Current camera state
   */
  updateForStep(
    stepNumber: number,
    stepProgress: number,
    performerProvider?: PerformerPositionProvider
  ): CameraState;

  /**
   * Get current camera state without updating
   */
  readonly currentState: CameraState;

  /**
   * Check if camera is currently animating between keyframes
   */
  readonly isAnimating: boolean;

  // ============================================
  // Keyframe Editing
  // ============================================

  /**
   * Add a keyframe to the choreography
   */
  addKeyframe(keyframe: CameraKeyframe): void;

  /**
   * Update an existing keyframe
   */
  updateKeyframe(id: string, updates: Partial<Omit<CameraKeyframe, "id">>): void;

  /**
   * Remove a keyframe by ID
   */
  removeKeyframe(id: string): void;

  /**
   * Get keyframe by ID
   */
  getKeyframe(id: string): CameraKeyframe | null;

  /**
   * Get all keyframes sorted by beat time
   */
  readonly keyframes: CameraKeyframe[];

  /**
   * Capture current camera position as a new keyframe
   *
   * @param stepNumber - Beat to place the keyframe at
   * @param currentPosition - Current camera position to capture
   * @param currentTarget - Current camera target to capture
   * @returns The created keyframe
   */
  captureKeyframe(
    stepNumber: number,
    currentPosition: CameraPosition,
    currentTarget: CameraPosition
  ): CameraKeyframe;

  // ============================================
  // State Queries
  // ============================================

  /**
   * Get the active keyframe (the one we're currently at or past)
   */
  readonly activeKeyframe: CameraKeyframe | null;

  /**
   * Get the next keyframe we're transitioning to
   */
  readonly nextKeyframe: CameraKeyframe | null;

  /**
   * Get progress between active and next keyframe (0-1)
   */
  readonly transitionProgress: number;

  // ============================================
  // Events
  // ============================================

  /**
   * Subscribe to camera state changes
   */
  onStateChange(callback: CameraStateChangeCallback): () => void;

  /**
   * Subscribe to keyframe reached events
   */
  onKeyframeReached(callback: KeyframeEventCallback): () => void;
}
