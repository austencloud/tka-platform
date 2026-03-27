/**
 * IFormationManager Contract
 *
 * Service for managing performer formations in the Stage.
 * Handles formation presets, custom formations, and smooth transitions.
 */

import type {
  Formation,
  FormationPreset,
  FormationTransition,
  Position2D,
} from "../../domain/formation";

/**
 * Position and facing for a single performer
 */
export interface PerformerFormationState {
  index: number;
  position: Position2D;
  facingAngle: number;
}

/**
 * Callback for formation changes
 */
export type FormationChangeCallback = (formation: Formation) => void;

/**
 * Callback for transition updates
 */
export type TransitionUpdateCallback = (
  positions: PerformerFormationState[]
) => void;

export interface IFormationManager {
  /**
   * Get the current active formation
   */
  readonly currentFormation: Formation;

  /**
   * Get the current performer count
   */
  readonly performerCount: number;

  /**
   * Check if a transition is in progress
   */
  readonly isTransitioning: boolean;

  /**
   * Get the current transition progress (0-1)
   */
  readonly transitionProgress: number;

  /**
   * Get the active transition (if any)
   */
  readonly activeTransition: FormationTransition | null;

  /**
   * Set the number of performers and update formation accordingly
   */
  setPerformerCount(count: number): void;

  /**
   * Apply a preset formation immediately (no transition)
   */
  applyPreset(preset: FormationPreset): void;

  /**
   * Apply a custom formation immediately (no transition)
   */
  applyFormation(formation: Formation): void;

  /**
   * Transition smoothly to a preset formation
   * @param preset - The formation preset to transition to
   * @param durationMs - Transition duration in milliseconds
   */
  transitionToPreset(preset: FormationPreset, durationMs: number): void;

  /**
   * Transition smoothly to a custom formation
   * @param formation - The formation to transition to
   * @param durationMs - Transition duration in milliseconds
   */
  transitionTo(formation: Formation, durationMs: number): void;

  /**
   * Cancel any active transition and snap to target
   */
  cancelTransition(): void;

  /**
   * Get the current position for a specific performer
   * During transitions, returns the interpolated position
   */
  getPerformerPosition(index: number): PerformerFormationState | null;

  /**
   * Get positions for all performers
   * During transitions, returns interpolated positions
   */
  getAllPerformerPositions(): PerformerFormationState[];

  /**
   * Capture current performer positions as a custom formation
   */
  captureCurrentAsFormation(name: string): Formation;

  /**
   * Update transition progress (called each frame during transitions)
   * @param timestamp - Current timestamp in milliseconds
   */
  updateTransition(timestamp: number): void;

  /**
   * Subscribe to formation changes
   */
  onFormationChange(callback: FormationChangeCallback): () => void;

  /**
   * Subscribe to transition updates (called each frame during transition)
   */
  onTransitionUpdate(callback: TransitionUpdateCallback): () => void;
}
