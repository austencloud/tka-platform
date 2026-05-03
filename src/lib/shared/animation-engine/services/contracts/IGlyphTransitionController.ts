/**
 * Glyph Transition Types
 *
 * Co-exported types for the glyph transition system.
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

