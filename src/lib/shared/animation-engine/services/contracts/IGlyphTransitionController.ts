/**
 * Glyph Transition Service Interface
 *
 * Manages cross-fade transitions between glyph states (letter, turns, beat number).
 * Handles the timing and state management for smooth visual transitions.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

/**
 * Current transition state - owned by service
 */
export interface GlyphTransitionState {
  // Currently displayed values
  displayedLetter: Letter | null;
  displayedTurnsTuple: string;
  displayedBeatNumber: number | null;
  /** Musical position display (e.g., "2, 3" for a beat spanning positions 2-3) */
  displayedMusicalPosition: string | null;

  // Fading out values (during transition)
  fadingOutLetter: Letter | null;
  fadingOutTurnsTuple: string | null;
  fadingOutBeatNumber: number | null;

  // Transition flags
  isNewLetter: boolean;
}

/**
 * Service for managing glyph cross-fade transitions
 */
export interface IGlyphTransitionController {
  /**
   * Reactive state - read from component via $derived
   */
  readonly state: GlyphTransitionState;

  /**
   * Update the target glyph values - triggers transition if changed
   * @param letter - New letter (or null)
   * @param turnsTuple - New turns tuple string
   * @param beatNumber - New beat number
   * @param musicalPosition - Musical position display string (e.g., "2, 3")
   */
  updateTarget(
    letter: Letter | null,
    turnsTuple: string,
    beatNumber: number | null,
    musicalPosition?: string | null
  ): void;

  /**
   * Get the transition duration in milliseconds
   */
  getTransitionDuration(): number;

  /**
   * Clean up resources (cancel any pending timeouts)
   */
  dispose(): void;
}
