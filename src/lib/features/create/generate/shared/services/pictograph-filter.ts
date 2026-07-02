/**
 * Pictograph Filter — all filtering logic for pictograph selection during
 * sequence generation.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { FilteringError } from "../domain/errors/generation-errors";
import { getLetterType } from "$lib/shared/foundation/domain/models/letter";
import { LetterType } from "$lib/shared/foundation/domain/models/letter-type";

// Legacy constants for rotation directions
const ROTATION_DIRS = {
  CLOCKWISE: RotationDirection.CLOCKWISE,
  COUNTER_CLOCKWISE: RotationDirection.COUNTER_CLOCKWISE,
  noRotation: RotationDirection.NO_ROTATION,
} as const;

/**
 * Filter by continuity — next beat's start position must match last beat's end position.
 */
export function filterByContinuity(
  options: PictographData[],
  lastStep: StepData | StartPositionData | null
): PictographData[] {
  if (!lastStep?.endPosition) {
    return options;
  }

  const lastEndPosition = lastStep.endPosition.toLowerCase();

  const filtered = options.filter((option: PictographData) => {
    if (!option.startPosition) return false;
    const optionStartPosition = option.startPosition.toLowerCase();
    return optionStartPosition === lastEndPosition;
  });

  if (filtered.length === 0) {
    console.warn(
      `⚠️ No options match end position "${lastEndPosition}", using all options`
    );
    return options;
  }

  return filtered;
}

/**
 * Filter options by rotation direction — exact port from legacy filter_options_by_rotation().
 */
export function filterByRotation(
  options: PictographData[],
  blueRotDir: string,
  redRotDir: string
): PictographData[] {
  const filtered = options.filter((option: PictographData) => {
    const blueMotion = option.motions.blue;
    const redMotion = option.motions.red;

    // Invisible placeholder = hand not really there (both-required Step shape).
    if (!isVisibleMotion(blueMotion) || !isVisibleMotion(redMotion)) return false;

    const blueMotionRotDir = blueMotion.rotationDirection;
    const redMotionRotDir = redMotion.rotationDirection;

    const blueMatches =
      blueMotionRotDir === blueRotDir ||
      blueMotionRotDir === ROTATION_DIRS.noRotation;

    const redMatches =
      redMotionRotDir === redRotDir ||
      redMotionRotDir === ROTATION_DIRS.noRotation;

    return blueMatches && redMatches;
  });

  return filtered.length > 0 ? filtered : options;
}

/**
 * Filter for start positions — static pictographs where startPosition === endPosition.
 */
export function filterStartPositions(options: PictographData[]): PictographData[] {
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
 */
export function filterStaticType6(
  options: PictographData[],
  level: number
): PictographData[] {
  return options.filter((option: PictographData) => {
    if (!option.letter) return true;

    const letterType = getLetterType(option.letter);
    if (letterType !== LetterType.TYPE6) return true;
    if (level === 1) return false;

    const blueMotion = option.motions.blue;
    const redMotion = option.motions.red;
    const blueTurns = blueMotion?.turns ?? 0;
    const redTurns = redMotion?.turns ?? 0;
    const blueHasTurns = blueTurns === "fl" || blueTurns > 0;
    const redHasTurns = redTurns === "fl" || redTurns > 0;

    return blueHasTurns || redHasTurns;
  });
}

/**
 * Filter pictographs by required end position.
 */
export function filterByEndPosition(
  options: PictographData[],
  requiredEndPosition: string
): PictographData[] {
  const targetEndPos = requiredEndPosition.toLowerCase();

  const filtered = options.filter((option: PictographData) => {
    if (!option.endPosition) return false;
    return option.endPosition.toLowerCase() === targetEndPos;
  });

  if (filtered.length === 0) {
    console.warn(
      `⚠️ No pictographs end at position "${requiredEndPosition}". Cannot satisfy end position constraint.`
    );
  }

  return filtered;
}

/**
 * Filter pictographs by prop type.
 */
export function filterByPropType(
  options: PictographData[],
  propType: string
): PictographData[] {
  const filtered = options.filter((option: PictographData) => {
    const blueMotion = option.motions.blue;
    const redMotion = option.motions.red;

    if (!isVisibleMotion(blueMotion) || !isVisibleMotion(redMotion)) return false;

    return (
      blueMotion.propType === propType && redMotion.propType === propType
    );
  });

  if (filtered.length === 0) {
    console.warn(
      `⚠️ No options match prop type "${propType}", using all options`
    );
    return options;
  }

  return filtered;
}

/**
 * Select a random item from an array.
 */
export function selectRandom<T>(array: T[]): T {
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

/**
 * Drop-in replacement for the old singleton — keeps all constructor-injected
 * call-sites working without changes.
 */
export const pictographFilter = {
  filterByContinuity,
  filterByRotation,
  filterStartPositions,
  filterStaticType6,
  filterByEndPosition,
  filterByPropType,
  selectRandom,
};
