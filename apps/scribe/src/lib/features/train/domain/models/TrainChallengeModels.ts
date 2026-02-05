/**
 * Train Challenge Models
 *
 * Domain models for training-specific challenges.
 * These are challenges focused on practicing sequences with specific goals.
 */

import type { PracticeMode } from "../enums/TrainEnums";
import type { ChallengeDifficulty } from "$lib/shared/gamification/domain/models/achievement-models";

// ============================================================================
// TRAIN CHALLENGE REQUIREMENT TYPES
// ============================================================================

export type TrainChallengeRequirementType =
  | "complete_sequence" // Complete a specific sequence X times
  | "achieve_accuracy" // Achieve X% accuracy on a sequence
  | "achieve_combo" // Achieve a combo of X or higher
  | "complete_mode" // Complete using specific practice mode
  | "complete_bpm" // Complete in timed mode at X BPM
  | "complete_time" // Complete within X seconds/minutes
  | "complete_multiple" // Complete multiple different sequences
  | "perfect_run"; // Complete with 100% accuracy

export interface TrainChallengeRequirement {
  type: TrainChallengeRequirementType;
  target: number; // Target value (e.g., 5 completions, 90% accuracy)
  metadata?: TrainChallengeMetadata;
}

export interface TrainChallengeMetadata {
  sequenceId?: string; // Specific sequence ID
  sequenceIds?: string[]; // Multiple sequence IDs
  mode?: PracticeMode; // Required practice mode
  bpm?: number; // Required BPM for timed mode
  minAccuracy?: number; // Minimum accuracy percentage
  minCombo?: number; // Minimum combo
  timeLimit?: number; // Time limit in seconds
  [key: string]: unknown;
}

// ============================================================================
// TRAIN CHALLENGE MODELS
// ============================================================================

export interface TrainChallenge {
  id: string; // Firestore document ID
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  xpReward: number;
  requirement: TrainChallengeRequirement;

  // Challenge availability
  isActive: boolean;
  startDate?: Date; // When challenge becomes available
  endDate?: Date; // When challenge expires (null = permanent)

  // Metadata
  createdAt: Date;
  createdBy?: string; // Admin user who created it
  order: number; // Display order

  // Optional features
  bonusXP?: number; // Bonus XP for exceptional completion
  bonusCondition?: string; // Description of bonus condition
  thumbnailUrl?: string; // Optional challenge image
  tags?: string[]; // Tags for filtering (e.g., "beginner", "letters", "timing")
}

export interface UserTrainChallengeProgress {
  id: string; // Auto-generated
  challengeId: string; // Reference to TrainChallenge.id
  userId?: string;

  // Progress tracking
  progress: number; // Current progress toward target
  isCompleted: boolean;
  completedAt?: Date;
  startedAt: Date;
  lastProgressAt: Date;

  // Performance tracking
  bestScore?: TrainChallengeScore;
  attempts: number; // Number of attempts made
  bonusEarned: boolean; // Did they earn bonus XP?
}

export interface TrainChallengeScore {
  accuracy: number; // Percentage (0-100)
  combo: number; // Max combo achieved
  grade: string; // S, A, B, C, D, F
  completionTime?: number; // Time in seconds
  mode: PracticeMode; // Mode used
  achievedAt: Date;
}

// ============================================================================
// TRAIN CHALLENGE FILTERS
// ============================================================================

export type TrainChallengeFilter = "all" | "active" | "completed" | "available";
export type TrainChallengeSortBy = "difficulty" | "xp" | "newest" | "expiring";

export interface TrainChallengeFilters {
  filter: TrainChallengeFilter;
  sortBy: TrainChallengeSortBy;
  difficulty?: ChallengeDifficulty;
  mode?: PracticeMode;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate progress percentage for a challenge
 */
export function calculateChallengeProgress(
  progress: number,
  target: number
): number {
  return Math.min(100, (progress / target) * 100);
}

/**
 * Check if a challenge is expired
 */
export function isChallengeExpired(challenge: TrainChallenge): boolean {
  if (!challenge.endDate) return false;
  return new Date() > challenge.endDate;
}

/**
 * Check if a challenge is available
 */
export function isChallengeAvailable(challenge: TrainChallenge): boolean {
  if (!challenge.isActive) return false;
  if (challenge.startDate && new Date() < challenge.startDate) return false;
  if (isChallengeExpired(challenge)) return false;
  return true;
}

/**
 * Get difficulty color for UI
 */
export function getDifficultyColor(difficulty: ChallengeDifficulty): string {
  switch (difficulty) {
    case "easy":
    case "beginner":
      return "#22c55e"; // Green
    case "medium":
    case "intermediate":
      return "#3b82f6"; // Blue
    case "hard":
    case "advanced":
      return "#ef4444"; // Red
    default:
      return "#9ca3af"; // Gray
  }
}

/**
 * Format challenge requirement as readable text
 */
export function formatChallengeRequirement(
  requirement: TrainChallengeRequirement
): string {
  const { type, target, metadata } = requirement;

  switch (type) {
    case "complete_sequence":
      return `Complete ${metadata?.sequenceId ? "this sequence" : "sequence"} ${target} time${target > 1 ? "s" : ""}`;
    case "achieve_accuracy":
      return `Achieve ${target}% accuracy`;
    case "achieve_combo":
      return `Achieve a combo of ${target} or higher`;
    case "complete_mode":
      return `Complete using ${metadata?.mode || "specific"} mode`;
    case "complete_bpm":
      return `Complete at ${metadata?.bpm || target} BPM`;
    case "complete_time":
      return `Complete within ${target} seconds`;
    case "complete_multiple":
      return `Complete ${target} different sequences`;
    case "perfect_run":
      return "Achieve 100% accuracy";
    default:
      return "Complete challenge";
  }
}
