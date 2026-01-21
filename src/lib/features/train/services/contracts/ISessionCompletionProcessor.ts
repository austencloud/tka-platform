/**
 * ISessionCompletionProcessor
 *
 * Handles all post-session processing including:
 * - XP calculation and awarding
 * - Performance history persistence
 * - Achievement tracking
 * - Challenge progression
 */

import type { PracticeMode } from "../../domain/enums/TrainEnums";

/**
 * Input parameters for session completion processing
 */
export interface SessionCompletionParams {
  // Session metrics
  totalSteps: number;
  totalHits: number;
  totalMisses: number;
  maxCombo: number;
  currentScore: number;
  bpm: number;

  // Session context
  practiceMode: PracticeMode;
  sequenceId?: string;
  sequenceName?: string;
  sessionDuration: number; // milliseconds

  // Optional active challenge
  activeChallengeId?: string;
}

/**
 * XP breakdown returned after session processing
 */
export interface XPBreakdown {
  baseXP: number;
  accuracyBonus: number;
  comboBonus: number;
  totalXP: number;
}

/**
 * Challenge progress info returned after session processing
 */
export interface ChallengeProgressResult {
  challenge: {
    id: string;
    title: string;
    requirement: { target: number };
    xpReward: number;
  };
  currentProgress: number;
  isComplete: boolean;
  xpAwarded?: number;
}

/**
 * Result returned from session completion processing
 */
export interface SessionCompletionResult {
  xpBreakdown: XPBreakdown;
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  accuracy: number;
  challengeProgress?: ChallengeProgressResult;
}

export interface ISessionCompletionProcessor {
  /**
   * Process a completed training session.
   * Handles XP, history persistence, achievements, and challenges.
   */
  processCompletion(
    params: SessionCompletionParams
  ): Promise<SessionCompletionResult>;
}
