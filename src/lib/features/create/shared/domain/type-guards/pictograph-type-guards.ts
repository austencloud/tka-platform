/**
 * Type Guards for Pictograph Data
 *
 * Utilities to distinguish between StepData and StartPositionData at runtime.
 * These enable TypeScript to narrow union types and enforce type safety.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

/**
 * Union type for all pictograph-based data structures
 */
export type StepOrStartPosition = StepData | StartPositionData;

/**
 * Type guard: Check if data is StartPositionData
 *
 * Checks for the presence of isStartPosition discriminator OR stepNumber === 0 (legacy)
 */
export function isStartPosition(
  data: PictographData | StepData | StartPositionData | unknown
): data is StartPositionData {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Primary check: Type discriminator field
  if (obj.isStartPosition === true) {
    return true;
  }

  // Fallback check: Legacy stepNumber === 0 pattern
  // This supports old data before migration is complete
  if ("stepNumber" in obj && obj.stepNumber === 0) {
    return true;
  }

  return false;
}

/**
 * Type guard: Check if data is StepData
 *
 * Checks for stepNumber >= 1 (the isStep discriminator was retired — steps
 * are identified structurally by stepNumber).
 */
export function isStep(
  data: PictographData | StepData | StartPositionData | unknown
): data is StepData {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (
    "stepNumber" in obj &&
    typeof obj.stepNumber === "number" &&
    obj.stepNumber >= 1
  ) {
    return true;
  }

  return false;
}

/**
 * Type guard: Check if data is either a beat or start position
 *
 * Useful for validating that data is one of our known types
 */
export function isStepOrStartPosition(
  data: unknown
): data is StepOrStartPosition {
  return isStartPosition(data) || isStep(data);
}

/**
 * Assertion: Throw if data is not StartPositionData
 */
export function assertIsStartPosition(
  data: unknown
): asserts data is StartPositionData {
  if (!isStartPosition(data)) {
    throw new Error(
      `Expected StartPositionData but got ${typeof data}. Data: ${JSON.stringify(data)}`
    );
  }
}

/**
 * Assertion: Throw if data is not StepData
 */
export function assertIsBeat(data: unknown): asserts data is StepData {
  if (!isStep(data)) {
    throw new Error(
      `Expected StepData but got ${typeof data}. Data: ${JSON.stringify(data)}`
    );
  }
}
