/**
 * Sequence Metadata Service
 *
 * Handles sequence metadata creation and naming.
 * Single Responsibility: Generate sequence names, metadata, and word calculation.
 */

import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import {
  DifficultyLevel,
  type GenerationOptions,
} from "../../domain/models/generate-models";

export interface ISequenceMetadataManager {
  /**
   * Generate a sequence name based on options and timestamp
   */
  generateSequenceName(options: GenerationOptions): string;

  /**
   * Calculate word from beat letters
   */
  calculateWordFromBeats(beats: BeatData[]): string;

  /**
   * Map difficulty level to numeric level (1-3)
   */
  mapDifficultyToLevel(difficulty: DifficultyLevel): number;

  /**
   * Create metadata object for generated sequence
   */
  createGenerationMetadata(options: {
    beatsGenerated: number;
    propContinuity: string;
    blueRotationDirection: string;
    redRotationDirection: string;
    turnIntensity: number;
    level: number;
  }): Record<string, unknown>;
}

export class SequenceMetadataManager implements ISequenceMetadataManager {
  /**
   * Generate sequence name based on options - matches legacy pattern
   */
  generateSequenceName(options: GenerationOptions): string {
    const timestamp = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const difficulty =
      options.difficulty.charAt(0).toUpperCase() + options.difficulty.slice(1);
    return `${difficulty} ${options.length}-Beat (${timestamp})`;
  }

  /**
   * Calculate word from beat letters
   */
  calculateWordFromBeats(beats: BeatData[]): string {
    return beats
      .filter((beat) => beat.letter)
      .map((beat) => beat.letter)
      .join("");
  }

  /**
   * Map difficulty to level - legacy mapping
   */
  mapDifficultyToLevel(difficulty: DifficultyLevel): number {
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

  /**
   * Create metadata object for generated sequence
   */
  createGenerationMetadata(options: {
    beatsGenerated: number;
    propContinuity: string;
    blueRotationDirection: string;
    redRotationDirection: string;
    turnIntensity: number;
    level: number;
  }): Record<string, unknown> {
    return {
      generated: true,
      generatedAt: new Date().toISOString(),
      algorithm: "freeform",
      beatsGenerated: options.beatsGenerated,
      propContinuity: options.propContinuity,
      blueRotationDirection: options.blueRotationDirection,
      redRotationDirection: options.redRotationDirection,
      turnIntensity: options.turnIntensity,
      level: options.level,
    };
  }
}
