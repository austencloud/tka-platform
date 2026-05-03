/**
 * Pictograph Filter Service
 *
 * Handles all filtering logic for pictograph selection during sequence generation.
 * Single Responsibility: Filter pictographs by various criteria (rotation, continuity).
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { FilteringError } from "../../domain/errors/generation-errors";
import { getLetterType } from "$lib/shared/foundation/domain/models/Letter";
import { LetterType } from "$lib/shared/foundation/domain/models/LetterType";

// Legacy constants for rotation directions
const ROTATION_DIRS = {
  CLOCKWISE: RotationDirection.CLOCKWISE,
  COUNTER_CLOCKWISE: RotationDirection.COUNTER_CLOCKWISE,
  noRotation: RotationDirection.NO_ROTATION,
} as const;

export class PictographFilter {
  /**
   * Filter by continuity - next beat's start position must match last beat's end position
   */
  filterByContinuity(
    options: PictographData[],
    lastStep: StepData | StartPositionData | null
  ): PictographData[] {
    if (!lastStep?.endPosition) {
      return options; // No filtering needed for first beat or if no end position
    }

    const lastEndPosition = lastStep.endPosition.toLowerCase();

    const filtered = options.filter((option: PictographData) => {
      if (!option.startPosition) return false;
      const optionStartPosition = option.startPosition.toLowerCase();
      return optionStartPosition === lastEndPosition;
    });

    // If filtering eliminates all options, return original options (legacy behavior)
    if (filtered.length === 0) {
      console.warn(
        `⚠️ No options match end position "${lastEndPosition}", using all options`
      );
      return options;
    }

    return filtered;
  }

  /**
   * Filter options by rotation direction - exact port from legacy filter_options_by_rotation()
   * Filters pictographs to match the given rotation directions for continuous prop continuity.
   * Options must have rotation directions that match OR are NO_ROTATION.
   */
  filterByRotation(
    options: PictographData[],
    blueRotDir: string,
    redRotDir: string
  ): PictographData[] {
    const filtered = options.filter((option: PictographData) => {
      const blueMotion = option.motions.blue;
      const redMotion = option.motions.red;

      if (!blueMotion || !redMotion) return false;

      const blueMotionRotDir = blueMotion.rotationDirection;
      const redMotionRotDir = redMotion.rotationDirection;

      // Check if blue rotation matches (either matches target or is NO_ROTATION)
      const blueMatches =
        blueMotionRotDir === blueRotDir ||
        blueMotionRotDir === ROTATION_DIRS.noRotation;

      // Check if red rotation matches (either matches target or is NO_ROTATION)
      const redMatches =
        redMotionRotDir === redRotDir ||
        redMotionRotDir === ROTATION_DIRS.noRotation;

      return blueMatches && redMatches;
    });

    // If filtering eliminates all options, return original options (legacy behavior)
    return filtered.length > 0 ? filtered : options;
  }

  /**
   * Filter for start positions - static pictographs where startPosition === endPosition
   */
  filterStartPositions(options: PictographData[]): PictographData[] {
    const filtered = options.filter((option: PictographData) => {
      if (!option.startPosition || !option.endPosition) return false;
      const startPos = option.startPosition.toLowerCase();
      const endPos = option.endPosition.toLowerCase();
      return startPos === endPos;
    });

    if (filtered.length === 0) {
      throw new FilteringError(
        "No valid start positions found in options",
        "start_positions",
        { totalOptions: options.length }
      );
    }

    return filtered;
  }

  /**
   * Filter Type 6 (static) pictographs based on difficulty level.
   *
   * Level 1: No turns allowed, so filter out ALL Type 6 pictographs
   * Level 2+: Filter out Type 6 pictographs that have no turns applied (keep those with turns > 0)
   *
   * This ensures Type 6 static pictographs are only used when they can have visual interest via turns.
   */
  filterStaticType6(
    options: PictographData[],
    level: number
  ): PictographData[] {
    const filtered = options.filter((option: PictographData) => {
      if (!option.letter) return true; // Keep if no letter specified

      const letterType = getLetterType(option.letter);

      // If not Type 6, always keep it
      if (letterType !== LetterType.TYPE6) return true;

      // Level 1: No turns allowed, so exclude ALL Type 6 pictographs
      if (level === 1) return false;

      // Level 2+: Keep Type 6 only if at least one motion has turns > 0
      const blueMotion = option.motions.blue;
      const redMotion = option.motions.red;

      const blueTurns = blueMotion?.turns ?? 0;
      const redTurns = redMotion?.turns ?? 0;

      // Keep Type 6 only if at least one motion has turns > 0
      // (turns can be a number or "fl", so handle both cases)
      const blueHasTurns = blueTurns === "fl" || blueTurns > 0;
      const redHasTurns = redTurns === "fl" || redTurns > 0;

      return blueHasTurns || redHasTurns;
    });

    return filtered;
  }

  /**
   * Filter pictographs by required end position.
   * Used for the final beat in freeform mode when user specifies an end position constraint.
   */
  filterByEndPosition(
    options: PictographData[],
    requiredEndPosition: string
  ): PictographData[] {
    const targetEndPos = requiredEndPosition.toLowerCase();

    const filtered = options.filter((option: PictographData) => {
      if (!option.endPosition) return false;
      return option.endPosition.toLowerCase() === targetEndPos;
    });

    // If no options match, log warning but don't fall back (this is an explicit constraint)
    if (filtered.length === 0) {
      console.warn(
        `⚠️ No pictographs end at position "${requiredEndPosition}". Cannot satisfy end position constraint.`
      );
    }

    return filtered;
  }

  /**
   * Filter pictographs by prop type.
   * Ensures both blue and red motions match the specified prop type.
   */
  filterByPropType(
    options: PictographData[],
    propType: string
  ): PictographData[] {
    const filtered = options.filter((option: PictographData) => {
      const blueMotion = option.motions.blue;
      const redMotion = option.motions.red;

      if (!blueMotion || !redMotion) return false;

      // Both motions must match the specified prop type
      return (
        blueMotion.propType === propType && redMotion.propType === propType
      );
    });

    // If filtering eliminates all options, return original options (legacy behavior)
    // This ensures generation doesn't fail if prop filtering is too restrictive
    if (filtered.length === 0) {
      console.warn(
        `⚠️ No options match prop type "${propType}", using all options`
      );
      return options;
    }

    return filtered;
  }

  /**
   * Select random item from array - simple utility for random selection
   */
  selectRandom<T>(array: T[]): T {
    if (array.length === 0) {
      throw new FilteringError(
        "Cannot choose from empty array",
        "random_selection"
      );
    }
    const index = Math.floor(Math.random() * array.length);
    const selected = array[index];
    if (selected === undefined) {
      throw new FilteringError(
        "Selected item is undefined",
        "random_selection",
        { index, arrayLength: array.length }
      );
    }
    return selected;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const pictographFilter = new PictographFilter();
