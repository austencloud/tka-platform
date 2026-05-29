/**
 * Challenge Completion Detector
 *
 * Utilities for detecting when a training session meets challenge requirements.
 */

import type {
  TrainChallenge,
  TrainChallengeScore,
} from "../domain/models/train-challenge-models";
import { PracticeMode } from "../domain/enums/train-enums";

export interface SessionResult {
  totalSteps: number;
  hits: number;
  misses: number;
  maxCombo: number;
  finalScore: number;
  accuracy: number; // percentage 0-100
  mode: PracticeMode;
  sequenceId?: string;
  bpm?: number;
  duration?: number; // in milliseconds
}

/**
 * Convert session results to TrainChallengeScore format
 */
export function sessionResultToScore(
  result: SessionResult
): TrainChallengeScore {
  // Calculate grade based on accuracy
  let grade = "F";
  if (result.accuracy >= 95) grade = "S";
  else if (result.accuracy >= 90) grade = "A";
  else if (result.accuracy >= 80) grade = "B";
  else if (result.accuracy >= 70) grade = "C";
  else if (result.accuracy >= 60) grade = "D";

  return {
    accuracy: result.accuracy,
    combo: result.maxCombo,
    grade,
    completionTime: result.duration,
    mode: result.mode,
    achievedAt: new Date(),
  };
}

/**
 * Check if a session result meets a challenge requirement
 * Returns the progress increment (usually 1, or 0 if not met)
 */
export function checkChallengeRequirement(
  challenge: TrainChallenge,
  result: SessionResult
): number {
  const { requirement } = challenge;
  const { type, target, metadata } = requirement;

  switch (type) {
    case "complete_sequence":
      // Check if mode matches (if specified)
      if (metadata?.mode && result.mode !== metadata.mode) {
        return 0;
      }
      // Check if BPM matches (if specified for timed mode)
      if (metadata?.bpm && result.bpm && result.bpm < metadata.bpm) {
        return 0;
      }
      // Check if sequence ID matches (if specified)
      if (metadata?.sequenceId && result.sequenceId !== metadata.sequenceId) {
        return 0;
      }
      // Completion counts if session finished (even with low accuracy)
      return 1;

    case "achieve_accuracy":
      // Only count if accuracy meets or exceeds target
      if (result.accuracy >= target) {
        return 1;
      }
      return 0;

    case "achieve_combo":
      // Only count if combo meets or exceeds target
      if (result.maxCombo >= target) {
        return 1;
      }
      return 0;

    case "complete_mode":
      // Check if mode matches
      if (metadata?.mode && result.mode === metadata.mode) {
        return 1;
      }
      return 0;

    case "complete_bpm":
      // Check BPM requirement
      if (
        result.mode === PracticeMode.TIMED &&
        result.bpm &&
        result.bpm >= (metadata?.bpm || target)
      ) {
        return 1;
      }
      return 0;

    case "complete_time":
      // Check if completed within time limit
      if (result.duration && result.duration <= target * 1000) {
        // target is in seconds
        return 1;
      }
      return 0;

    case "complete_multiple":
      // This requires tracking across sessions - just return 1 per unique sequence
      // The service will handle tracking unique sequences
      return 1;

    case "perfect_run":
      // Only count perfect runs (100% accuracy)
      if (result.accuracy === 100) {
        return 1;
      }
      return 0;

    default:
      console.warn(`Unknown requirement type: ${type}`);
      return 0;
  }
}

/**
 * Calculate total XP earned from a training session
 * Includes base XP, accuracy bonuses, and combo bonuses
 */
export function calculateSessionXP(result: SessionResult): {
  baseXP: number;
  accuracyBonus: number;
  comboBonus: number;
  totalXP: number;
} {
  const baseXP = 10; // TRAINING_SESSION_COMPLETED

  let accuracyBonus = 0;
  if (result.accuracy === 100) {
    accuracyBonus = 25; // TRAINING_PERFECT_RUN
  } else if (result.accuracy >= 85) {
    accuracyBonus = 15; // TRAINING_HIGH_ACCURACY
  } else if (result.accuracy >= 70) {
    accuracyBonus = 5; // TRAINING_GOOD_ACCURACY
  }

  const comboBonus = result.maxCombo * 2; // TRAINING_COMBO_BONUS = 2 XP per combo

  const totalXP = baseXP + accuracyBonus + comboBonus;

  return {
    baseXP,
    accuracyBonus,
    comboBonus,
    totalXP,
  };
}
