/**
 * Sequence Difficulty Calculator
 *
 * Analyzes sequence step data to determine difficulty level based on:
 * - Turn values (0, whole numbers, half values, floats)
 * - Orientation types (radial IN/OUT vs non-radial CLOCK/COUNTER)
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export type DifficultyTrigger = "none" | "turns" | "nonRadial";
export interface DifficultyAnalysis {
  readonly level: 1 | 2 | 3;
  readonly trigger: DifficultyTrigger;
}

export function analyzeDifficulty(steps: StepData[]): DifficultyAnalysis {
  if (!steps || steps.length === 0) {
    return { level: 1, trigger: "none" };
  }

  let hasNonRadial = false;
  let hasTurns = false;

  for (const step of steps) {
    if (!step.motions) continue;

    const blueMotion = step.motions[MotionColor.BLUE];
    const redMotion = step.motions[MotionColor.RED];

    if (hasNonRadialOrientation(blueMotion, redMotion)) {
      hasNonRadial = true;
    }
    if (checkHasTurns(blueMotion, redMotion)) {
      hasTurns = true;
    }
  }

  if (hasNonRadial) return { level: 3, trigger: "nonRadial" };
  if (hasTurns) return { level: 2, trigger: "turns" };
  return { level: 1, trigger: "none" };
}

export function calculateDifficultyLevel(steps: StepData[]): number {
  return analyzeDifficulty(steps).level;
}

export function levelToString(level: number): string {
  switch (level) {
    case 1: return "beginner";
    case 2: return "intermediate";
    case 3: return "advanced";
    default: return "beginner";
  }
}

function hasNonRadialOrientation(
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

function checkHasTurns(blueMotion: unknown, redMotion: unknown): boolean {
  return motionHasTurns(blueMotion) || motionHasTurns(redMotion);
}

function motionHasTurns(motion: unknown): boolean {
  const motionObj = motion as Record<string, unknown> | undefined;

  if (motionObj?.turns === undefined || motionObj?.turns === null) {
    return false;
  }
  if (motionObj.turns === "fl") return true;
  if (typeof motionObj.turns === "number") return motionObj.turns > 0;
  return false;
}
