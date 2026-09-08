/**
 * Type1LetterData - Domain model for Type 1 letter lesson data
 * Uses existing TKA enums for type safety
 */

import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface Type1LetterData {
  letter: Letter;
  leftMotion: MotionType;
  rightMotion: MotionType;
  startPositionGroup: GridPositionGroup;
  endPositionGroup: GridPositionGroup;
  description: string;
  /** Present only for quarter-same letters (S, T, U, V). */
  leaderRotation?: "pro" | "anti";
}
