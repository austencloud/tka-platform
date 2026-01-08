/**
 * Sequence Difficulty Calculator Implementation
 *
 * Analyzes sequence beat data to determine difficulty level based on:
 * - Turn values (0, whole numbers, half values, floats)
 * - Orientation types (radial IN/OUT vs non-radial CLOCK/COUNTER)
 *
 * This replaces storing difficulty in metadata and calculates it on-the-fly.
 */

import { injectable } from "inversify";
import type { BeatData } from "../../../../../create/shared/domain/models/BeatData";
import {
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { ISequenceDifficultyCalculator } from "../contracts/ISequenceDifficultyCalculator";

@injectable()
export class SequenceDifficultyCalculator implements ISequenceDifficultyCalculator {
  /**
   * Calculate difficulty level by analyzing all beats in the sequence
   */
  calculateDifficultyLevel(beats: BeatData[]): number {
    if (!beats || beats.length === 0) {
      return 1; // Default to beginner for empty sequences
    }

    let hasNonRadialOrientation = false;
    let hasTurns = false;

    // Analyze all beats
    for (const beat of beats) {
      if (!beat.motions) continue;

      // Check both blue and red motions
      const blueMotion = beat.motions[MotionColor.BLUE];
      const redMotion = beat.motions[MotionColor.RED];

      // Check for non-radial orientations
      if (this.hasNonRadialOrientation(blueMotion, redMotion)) {
        hasNonRadialOrientation = true;
      }

      // Check for turns
      if (this.hasTurns(blueMotion, redMotion)) {
        hasTurns = true;
      }
    }

    // Determine level based on findings
    if (hasNonRadialOrientation) {
      return 3; // Level 3: Contains non-radial orientations
    } else if (hasTurns) {
      return 2; // Level 2: Contains turns with radial orientations only
    } else {
      return 1; // Level 1: No turns, only radial orientations
    }
  }

  /**
   * Convert numeric level to difficulty string
   */
  levelToString(level: number): string {
    switch (level) {
      case 1:
        return "beginner";
      case 2:
        return "intermediate";
      case 3:
        return "advanced";
      default:
        return "beginner";
    }
  }

  /**
   * Check if any motion has non-radial orientations (CLOCK or COUNTER)
   */
  private hasNonRadialOrientation(
    blueMotion: unknown,
    redMotion: unknown
  ): boolean {
    const blueObj = blueMotion as Record<string, unknown> | undefined;
    const redObj = redMotion as Record<string, unknown> | undefined;

    const orientationsToCheck = [
      blueObj?.startOrientation,
      blueObj?.endOrientation,
      redObj?.startOrientation,
      redObj?.endOrientation,
    ];

    return orientationsToCheck.some(
      (orientation) =>
        orientation === Orientation.CLOCK || orientation === Orientation.COUNTER
    );
  }

  /**
   * Check if any motion has turns greater than 0
   * Handles both numeric turns and "fl" (float) values
   */
  private hasTurns(blueMotion: unknown, redMotion: unknown): boolean {
    return this.motionHasTurns(blueMotion) || this.motionHasTurns(redMotion);
  }

  /**
   * Check if a single motion has turns
   */
  private motionHasTurns(motion: unknown): boolean {
    const motionObj = motion as Record<string, unknown> | undefined;

    if (motionObj?.turns === undefined || motionObj?.turns === null) {
      return false;
    }

    // Handle "fl" (float) case - this is considered a turn
    if (motionObj.turns === "fl") {
      return true;
    }

    // Handle numeric turns
    if (typeof motionObj.turns === "number") {
      return motionObj.turns > 0;
    }

    return false;
  }
}
