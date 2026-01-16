/**
 * ISceneOrchestrator Contract
 *
 * Orchestrates the 3D Stage scene by interpreting timeline state.
 * Maps timeline concepts (performer tracks, formation cues, camera clips)
 * to Stage rendering concepts (avatar playback, formations, camera positions).
 *
 * This allows Stage to reuse compose's DAW timeline infrastructure
 * without duplicating playback, UI, or state management code.
 */

import type { FormationPreset } from "../../domain/formation";

// ============================================================================
// Types
// ============================================================================

/**
 * Time in seconds (matches TimelineState convention)
 */
export type TimeSeconds = number;

/**
 * Active clip info for a performer at current playhead position
 */
export interface ActivePerformerClip {
  /** Unique clip identifier */
  clipId: string;
  /** Progress within the clip (0-1) */
  progress: number;
  /** Current beat index within the sequence */
  stepIndex: number;
  /** Sub-beat progress within current beat (0-1) */
  stepProgress: number;
  /** The sequence ID being played */
  sequenceId: string;
}

/**
 * Camera state from camera track (interpolated position and target)
 */
export interface OrchestratedCameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

/**
 * Callback for playhead position changes
 */
export type PlayheadChangeCallback = (position: TimeSeconds) => void;

/**
 * Callback for play state changes
 */
export type PlayStateChangeCallback = (isPlaying: boolean) => void;

/**
 * Callback for formation cue triggers
 */
export type FormationCueCallback = (preset: FormationPreset) => void;

// ============================================================================
// Interface
// ============================================================================

export interface ISceneOrchestrator {
  // =========================================================================
  // State Accessors
  // =========================================================================

  /**
   * Current playhead position in seconds
   */
  readonly playheadPosition: TimeSeconds;

  /**
   * Whether the timeline is currently playing
   */
  readonly isPlaying: boolean;

  /**
   * Current BPM for beat calculations
   */
  readonly bpm: number;

  /**
   * Number of performer tracks in the current project
   */
  readonly performerTrackCount: number;

  // =========================================================================
  // Performer Track Methods
  // =========================================================================

  /**
   * Get the active clip at current playhead for a specific performer.
   * Returns clip info with progress and beat calculations, or null if no active clip.
   *
   * @param performerIndex - Zero-based performer index
   */
  getActivePerformerClip(performerIndex: number): ActivePerformerClip | null;

  /**
   * Get active clips for all performers at current playhead.
   * Map keys are performer indices (0-based).
   */
  getAllActivePerformerClips(): Map<number, ActivePerformerClip | null>;

  // =========================================================================
  // Formation Methods
  // =========================================================================

  /**
   * Get the currently active formation preset based on playhead position.
   * Formation cues are "instant" - returns the most recent cue before playhead.
   */
  getActiveFormation(): FormationPreset;

  /**
   * Check if a formation track exists in the current project
   */
  hasFormationTrack(): boolean;

  // =========================================================================
  // Camera Methods
  // =========================================================================

  /**
   * Get interpolated camera state from camera track.
   * Returns null if no camera track or no keyframes.
   */
  getCameraState(): OrchestratedCameraState | null;

  /**
   * Check if a camera track exists in the current project
   */
  hasCameraTrack(): boolean;

  // =========================================================================
  // Event Subscriptions
  // =========================================================================

  /**
   * Subscribe to playhead position changes
   * @returns Unsubscribe function
   */
  onPlayheadChange(callback: PlayheadChangeCallback): () => void;

  /**
   * Subscribe to play state changes
   * @returns Unsubscribe function
   */
  onPlayStateChange(callback: PlayStateChangeCallback): () => void;

  /**
   * Subscribe to formation cue triggers
   * Called when playhead crosses a formation cue point
   * @returns Unsubscribe function
   */
  onFormationCue(callback: FormationCueCallback): () => void;
}
