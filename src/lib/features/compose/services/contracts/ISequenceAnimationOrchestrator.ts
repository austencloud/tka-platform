/**
 * Sequence Animation Orchestrator Interface
 *
 * Interface for coordinating multiple animation services.
 * Higher-level orchestration of animation components.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceMetadata } from "$lib/shared/foundation/domain/models/SequenceData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type {
  PropState,
  PropStates,
} from "../../shared/domain/types/PropState";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

export interface ISequenceAnimationOrchestrator {
  /** Override the visibility manager used for effort preset lookups. */
  setVisibilityManager(vm: AnimationVisibilityStateManager): void;
  initializeWithDomainData(sequenceData: SequenceData): boolean;
  calculateState(currentStep: number): void;
  getPropStates(): PropStates;
  getBluePropState(): PropState;
  getRedPropState(): PropState;
  getMetadata(): SequenceMetadata;
  getCurrentPropStates(): PropStates;
  getCurrentLetter(): Letter | null;
  isInitialized(): boolean;
  dispose(): void;

  /**
   * Update the prop types used for rendering without full re-initialization.
   * Called when the user toggles between creator-intent and viewer props.
   */
  updatePropTypes(bluePropType: PropType, redPropType: PropType): void;

  /**
   * Check if currently showing the start position (before beat 1)
   * Start position is conceptually different from steps - it's the pose held before animation begins
   */
  isAtStartPosition(): boolean;

  /**
   * Get the total number of motion steps (NOT including start position)
   */
  getTotalBeats(): number;

  /**
   * Get the total duration of all steps (sum of individual beat durations).
   * Does NOT include start position duration.
   */
  getTotalDuration(): number;

  /**
   * Get the duration of the start position (default: 1 beat).
   * Start position is shown as a beat before motion begins.
   */
  getStartPositionDuration(): number;

  /**
   * Get the total duration INCLUDING start position.
   * This is the proper "end time" for duration-aware playback.
   */
  getTotalDurationWithStartPosition(): number;

  /**
   * Calculate animation state using duration-aware timing.
   * Maps a time position to the correct beat and progress within that beat,
   * accounting for variable beat durations.
   *
   * @param timePosition - Position in sequence time (0 to totalDuration)
   * @returns The beat number (1-based) currently being animated, for UI sync
   */
  calculateStateDurationAware(timePosition: number): number;

  /**
   * Get the current step data (the beat being animated).
   * Returns null if at start position or not initialized.
   */
  getCurrentStepBeatData(): StepData | null;

  /**
   * Get the current beat index (0-based array index).
   * Returns -1 if at start position.
   */
  getCurrentStepIndex(): number;

  /**
   * Get the current progress within the beat (0.0 to 1.0).
   */
  getStepProgress(): number;

  /**
   * Get the continuous musical position as a decimal.
   * Formula: stepNumber + (progress × duration)
   *
   * Example: Beat 2 with duration 2 at 50% progress = 2 + (0.5 × 2) = 3.0
   * Returns 0 if at start position.
   */
  getContinuousMusicalPosition(): number;

  /**
   * Convert a beat number (1-based) to a time position for duration-aware playback.
   * Handles fractional beats by interpolating within the beat's duration.
   *
   * @param beat - The beat number (1-based, can be fractional like 2.5)
   * @returns The time position in duration units
   */
  getTimePositionForBeat(beat: number): number;
}
