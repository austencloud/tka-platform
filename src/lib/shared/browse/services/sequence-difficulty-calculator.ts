/**
 * Sequence Difficulty Calculator
 *
 * Analyzes sequence step data to determine difficulty level based on:
 * - Turn values (0, whole numbers, half values, floats)
 * - Orientation types (radial IN/OUT vs non-radial CLOCK/COUNTER)
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  Orientation,
  HandSide,
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

    // Invisible placeholders (blank beats / stripped hands after the
    // 2026-07-02 both-required flip) must not contribute — a decode-path
    // placeholder carrying a non-radial last-known orientation would
    // silently inflate the difficulty badge (Wave 0 straggler fix).
    const leftRaw = step.motions[HandSide.LEFT];
    const rightRaw = step.motions[HandSide.RIGHT];
    const leftMotion = isVisibleMotion(leftRaw) ? leftRaw : undefined;
    const rightMotion = isVisibleMotion(rightRaw) ? rightRaw : undefined;

    if (hasNonRadialOrientation(leftMotion, rightMotion)) {
      hasNonRadial = true;
    }
    if (checkHasTurns(leftMotion, rightMotion)) {
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

function hasNonRadialOrientation(
  leftMotion: unknown,
  rightMotion: unknown
): boolean {
  const leftObj = leftMotion as Record<string, unknown> | undefined;
  const rightObj = rightMotion as Record<string, unknown> | undefined;

  const orientationsToCheck = [
    leftObj?.startOrientation,
    leftObj?.endOrientation,
    rightObj?.startOrientation,
    rightObj?.endOrientation,
  ];

  return orientationsToCheck.some(
    (orientation) =>
      orientation === Orientation.CLOCK || orientation === Orientation.COUNTER
  );
}

function checkHasTurns(leftMotion: unknown, rightMotion: unknown): boolean {
  return motionHasTurns(leftMotion) || motionHasTurns(rightMotion);
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
