/**
 * Glyph Transition Service Implementation
 *
 * Manages cross-fade transitions between glyph states.
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
  displayedStepNumber: number | null;
  /** Musical position display (e.g., "2, 3" for a beat spanning positions 2-3) */
  displayedMusicalPosition: string | null;

  // Fading out values (during transition)
  fadingOutLetter: Letter | null;
  fadingOutTurnsTuple: string | null;
  fadingOutStepNumber: number | null;

  // Transition flags
  isNewLetter: boolean;
}

// Glyph transition duration - controls the cross-fade animation
// Set to 0 for instant swap (best for step playback sync)
// Set higher (e.g., 100-200) for smoother continuous playback
const GLYPH_TRANSITION_DURATION_MS = 0;

export class GlyphTransitionController {
  // Reactive state - owned by service
  state = $state<GlyphTransitionState>({
    displayedLetter: null,
    displayedTurnsTuple: "(s, 0, 0)",
    displayedStepNumber: null,
    displayedMusicalPosition: null,
    fadingOutLetter: null,
    fadingOutTurnsTuple: null,
    fadingOutStepNumber: null,
    isNewLetter: false,
  });

  private fadeOutTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private newLetterTimeoutId: ReturnType<typeof setTimeout> | null = null;

  updateTarget(
    letter: Letter | null,
    turnsTuple: string,
    stepNumber: number | null,
    musicalPosition?: string | null
  ): void {
    const hasLetterChanged = letter !== this.state.displayedLetter;
    const hasTurnsChanged = turnsTuple !== this.state.displayedTurnsTuple;
    const hasStepChanged = stepNumber !== this.state.displayedStepNumber;
    const hasPositionChanged = musicalPosition !== this.state.displayedMusicalPosition;

    if (!hasLetterChanged && !hasTurnsChanged && !hasStepChanged && !hasPositionChanged) {
      return; // No change at all
    }

    // Only trigger fade animation if the LETTER actually changed
    // If just beat number or turns changed but letter is same, skip the fade
    if (hasLetterChanged && this.state.displayedLetter !== null) {
      this.state.fadingOutLetter = this.state.displayedLetter;
      this.state.fadingOutTurnsTuple = this.state.displayedTurnsTuple;
      this.state.fadingOutStepNumber = this.state.displayedStepNumber;
      this.state.isNewLetter = true;

      // Clear any existing timeouts
      if (this.fadeOutTimeoutId) {
        clearTimeout(this.fadeOutTimeoutId);
      }
      if (this.newLetterTimeoutId) {
        clearTimeout(this.newLetterTimeoutId);
      }

      // Remove fading-out values after transition completes
      this.fadeOutTimeoutId = setTimeout(() => {
        this.state.fadingOutLetter = null;
        this.state.fadingOutTurnsTuple = null;
        this.state.fadingOutStepNumber = null;
      }, GLYPH_TRANSITION_DURATION_MS);

      // Reset isNewLetter flag after transition
      this.newLetterTimeoutId = setTimeout(() => {
        this.state.isNewLetter = false;
      }, GLYPH_TRANSITION_DURATION_MS);
    }

    // Always update displayed values (silently if letter didn't change)
    this.state.displayedLetter = letter;
    this.state.displayedTurnsTuple = turnsTuple;
    this.state.displayedStepNumber = stepNumber;
    this.state.displayedMusicalPosition = musicalPosition ?? null;
  }

  getTransitionDuration(): number {
    return GLYPH_TRANSITION_DURATION_MS;
  }

  dispose(): void {
    if (this.fadeOutTimeoutId) {
      clearTimeout(this.fadeOutTimeoutId);
      this.fadeOutTimeoutId = null;
    }
    if (this.newLetterTimeoutId) {
      clearTimeout(this.newLetterTimeoutId);
      this.newLetterTimeoutId = null;
    }
    // Reset state
    this.state.displayedLetter = null;
    this.state.displayedTurnsTuple = "(s, 0, 0)";
    this.state.displayedStepNumber = null;
    this.state.displayedMusicalPosition = null;
    this.state.fadingOutLetter = null;
    this.state.fadingOutTurnsTuple = null;
    this.state.fadingOutStepNumber = null;
    this.state.isNewLetter = false;
  }
}
