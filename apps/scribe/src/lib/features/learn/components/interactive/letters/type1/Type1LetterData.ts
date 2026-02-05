/**
 * Type1LetterData - Domain model for Type 1 letter lesson data
 * Uses existing TKA enums for type safety
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface Type1LetterData {
  letter: Letter;
  blueMotion: MotionType;
  redMotion: MotionType;
  startPositionGroup: GridPositionGroup;
  endPositionGroup: GridPositionGroup;
  description: string;
}
