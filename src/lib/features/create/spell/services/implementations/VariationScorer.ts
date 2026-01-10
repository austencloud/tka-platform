/**
 * Variation Scorer Implementation
 *
 * Scores sequence variations based on user preferences.
 * Higher scores indicate better matches to user preferences.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { SpellPreferences } from "../../domain/models/spell-models";
import type {
  IVariationScorer,
  VariationScore,
} from "../contracts/IVariationScorer";
import {
  MotionType,
  RotationDirection,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/** Score weights for different factors */
const WEIGHTS = {
  REVERSAL_PENALTY: -10, // Points lost per reversal
  CONTINUITY_BONUS: 5, // Points per beat in a consistent rotation streak
  MOTION_TYPE_BONUS: 3, // Points per motion matching preference
};

export class VariationScorer implements IVariationScorer {
  /**
   * Score a sequence based on user preferences.
   *
   * Scoring factors:
   * - minimizeReversals: Penalizes sequences with more prop reversals
   * - preferContinuous: Rewards sequences with consistent rotation direction
   * - favorMotionType: Rewards sequences matching the dash preference
   */
  scoreSequence(
    sequence: SequenceData,
    preferences: SpellPreferences
  ): VariationScore {
    const reversalCount = this.countReversals(sequence);
    const continuityScore = this.calculateContinuityScore(sequence);
    const motionTypeScore = this.calculateMotionTypeScore(
      sequence,
      preferences.favorMotionType
    );

    // Calculate weighted total
    let total = 0;

    if (preferences.minimizeReversals) {
      total += reversalCount * WEIGHTS.REVERSAL_PENALTY;
    }

    if (preferences.preferContinuous) {
      total += continuityScore * WEIGHTS.CONTINUITY_BONUS;
    }

    if (preferences.favorMotionType !== null) {
      total += motionTypeScore * WEIGHTS.MOTION_TYPE_BONUS;
    }

    return {
      total,
      reversalCount,
      continuityScore,
      motionTypeScore,
    };
  }

  /**
   * Count the number of prop reversals in the sequence.
   * A reversal occurs when blueReversal or redReversal is true on a beat.
   */
  private countReversals(sequence: SequenceData): number {
    let count = 0;

    for (const beat of sequence.beats) {
      if (beat.blueReversal) count++;
      if (beat.redReversal) count++;
    }

    return count;
  }

  /**
   * Calculate continuity score based on rotation direction consistency.
   * Longer streaks of the same rotation direction score higher.
   * Returns the total continuity points earned.
   */
  private calculateContinuityScore(sequence: SequenceData): number {
    if (sequence.beats.length === 0) return 0;

    let score = 0;
    let currentStreak = 1;
    let lastDirection: RotationDirection | null = null;

    for (const beat of sequence.beats) {
      const direction = this.getDominantRotationDirection(beat);

      if (direction === null) {
        // No rotation, reset streak
        score += currentStreak;
        currentStreak = 1;
        lastDirection = null;
      } else if (lastDirection === null) {
        // Starting a new potential streak
        lastDirection = direction;
      } else if (direction === lastDirection) {
        // Continuing streak
        currentStreak++;
      } else {
        // Direction changed, score previous streak and reset
        score += currentStreak;
        currentStreak = 1;
        lastDirection = direction;
      }
    }

    // Add final streak
    score += currentStreak;

    return score;
  }

  /**
   * Get the dominant rotation direction for a beat.
   * If both props have the same direction, return that.
   * If they differ, return the non-NO_ROTATION one (or null if both are NO_ROTATION).
   */
  private getDominantRotationDirection(
    beat: BeatData
  ): RotationDirection | null {
    const blueDir = beat.motions?.[MotionColor.BLUE]?.rotationDirection;
    const redDir = beat.motions?.[MotionColor.RED]?.rotationDirection;

    // Filter out NO_ROTATION
    const validDirs = [blueDir, redDir].filter(
      (d) => d && d !== RotationDirection.NO_ROTATION
    );

    if (validDirs.length === 0) return null;
    if (validDirs.length === 1) return validDirs[0]!;

    // Both have rotation - return blue's direction as dominant (arbitrary choice)
    return blueDir || redDir || null;
  }

  /**
   * Calculate motion type score based on dash preference.
   * - 'dash': Count DASH motions (more is better)
   * - 'no-dash': Count non-DASH motions (more is better)
   * - null: Return 0 (no preference)
   */
  private calculateMotionTypeScore(
    sequence: SequenceData,
    preference: "dash" | "no-dash" | null
  ): number {
    if (preference === null) return 0;

    let matchingMotionCount = 0;

    for (const beat of sequence.beats) {
      const blueType = beat.motions?.[MotionColor.BLUE]?.motionType;
      const redType = beat.motions?.[MotionColor.RED]?.motionType;

      if (preference === "dash") {
        // Favor dashes
        if (blueType === MotionType.DASH) matchingMotionCount++;
        if (redType === MotionType.DASH) matchingMotionCount++;
      } else {
        // Avoid dashes (favor PRO, ANTI, FLOAT)
        if (
          blueType &&
          blueType !== MotionType.DASH &&
          blueType !== MotionType.STATIC
        ) {
          matchingMotionCount++;
        }
        if (
          redType &&
          redType !== MotionType.DASH &&
          redType !== MotionType.STATIC
        ) {
          matchingMotionCount++;
        }
      }
    }

    return matchingMotionCount;
  }
}
