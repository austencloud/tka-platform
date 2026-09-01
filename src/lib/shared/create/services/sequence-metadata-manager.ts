/**
 * Sequence Metadata — name generation, metadata creation, and word calculation.
 */

import type { Step } from "@tka/tka-types";
import {
  DifficultyLevel,
  type GenerationOptions,
} from "$lib/shared/foundation/domain/models/generation/generate-models";

export function generateSequenceName(options: GenerationOptions): string {
  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const difficulty =
    options.difficulty.charAt(0).toUpperCase() + options.difficulty.slice(1);
  return `${difficulty} ${options.length}-Step (${timestamp})`;
}

export function calculateWordFromBeats(steps: Step[]): string {
  return steps
    .filter((step) => step.letter)
    .map((step) => step.letter)
    .join("");
}

export function mapDifficultyToLevel(difficulty: DifficultyLevel): number {
  switch (difficulty) {
    case DifficultyLevel.BEGINNER:
      return 1;
    case DifficultyLevel.INTERMEDIATE:
      return 2;
    case DifficultyLevel.ADVANCED:
      return 3;
    default:
      return 2;
  }
}

export function createGenerationMetadata(options: {
  stepsGenerated: number;
  propContinuity: string;
  leftRotationDirection: string;
  rightRotationDirection: string;
  turnIntensity: number;
  level: number;
}): Record<string, unknown> {
  return {
    generated: true,
    generatedAt: new Date().toISOString(),
    algorithm: "freeform",
    stepsGenerated: options.stepsGenerated,
    propContinuity: options.propContinuity,
    leftRotationDirection: options.leftRotationDirection,
    rightRotationDirection: options.rightRotationDirection,
    turnIntensity: options.turnIntensity,
    level: options.level,
  };
}

/**
 * Drop-in replacement for the old singleton — keeps all constructor-injected
 * call-sites working without changes.
 */
export const sequenceMetadataManager = {
  generateSequenceName,
  calculateWordFromBeats,
  mapDifficultyToLevel,
  createGenerationMetadata,
};
