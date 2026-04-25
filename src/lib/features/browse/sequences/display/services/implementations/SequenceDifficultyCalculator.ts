/**
 * Sequence Difficulty Calculator Implementation
 *
 * Analyzes sequence step data to determine difficulty level based on:
 * - Turn values (0, whole numbers, half values, floats)
 * - Orientation types (radial IN/OUT vs non-radial CLOCK/COUNTER)
 */

import type { StepData } from "../../../../../create/shared/domain/models/StepData";
import {
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type {
  DifficultyAnalysis,
  ISequenceDifficultyCalculator,
} from "../contracts/ISequenceDifficultyCalculator";

export class SequenceDifficultyCalculator implements ISequenceDifficultyCalculator {
  analyzeDifficulty(steps: StepData[]): DifficultyAnalysis {
    if (!steps || steps.length === 0) {
      return { level: 1, trigger: "none" };
    }

    let hasNonRadial = false;
    let hasTurns = false;

    for (const step of steps) {
      if (!step.motions) continue;

      const blueMotion = step.motions[MotionColor.BLUE];
      const redMotion = step.motions[MotionColor.RED];

      if (this.hasNonRadialOrientation(blueMotion, redMotion)) {
        hasNonRadial = true;
      }
      if (this.hasTurns(blueMotion, redMotion)) {
        hasTurns = true;
      }
    }

    if (hasNonRadial) return { level: 3, trigger: "nonRadial" };
    if (hasTurns) return { level: 2, trigger: "turns" };
    return { level: 1, trigger: "none" };
  }

  calculateDifficultyLevel(steps: StepData[]): number {
    return this.analyzeDifficulty(steps).level;
  }

  levelToString(level: number): string {
    switch (level) {
      case 1: return "beginner";
      case 2: return "intermediate";
      case 3: return "advanced";
      default: return "beginner";
    }
  }

  private hasNonRadialOrientation(
    blueMotion: unknown,
    redMotion: unknown,
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
        orientation === Orientation.CLOCK || orientation === Orientation.COUNTER,
    );
  }

  private hasTurns(blueMotion: unknown, redMotion: unknown): boolean {
    return this.motionHasTurns(blueMotion) || this.motionHasTurns(redMotion);
  }

  private motionHasTurns(motion: unknown): boolean {
    const motionObj = motion as Record<string, unknown> | undefined;

    if (motionObj?.turns === undefined || motionObj?.turns === null) {
      return false;
    }
    if (motionObj.turns === "fl") return true;
    if (typeof motionObj.turns === "number") return motionObj.turns > 0;
    return false;
  }
}
