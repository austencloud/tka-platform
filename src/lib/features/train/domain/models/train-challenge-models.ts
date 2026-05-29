import type { PracticeMode } from "../enums/train-enums";
import type { ChallengeDifficulty } from "$lib/shared/gamification/domain/models/achievement-models";

export type TrainChallengeRequirementType =
  | "complete_sequence" 
  | "achieve_accuracy" 
  | "achieve_combo" 
  | "complete_mode" 
  | "complete_bpm" 
  | "complete_time" 
  | "complete_multiple" 
  | "perfect_run"; 

export interface TrainChallengeRequirement {
  type: TrainChallengeRequirementType;
  target: number; 
  metadata?: TrainChallengeMetadata;
}

export interface TrainChallengeMetadata {
  sequenceId?: string; 
  sequenceIds?: string[]; 
  mode?: PracticeMode; 
  bpm?: number; 
  minAccuracy?: number; 
  minCombo?: number; 
  timeLimit?: number; 
  [key: string]: unknown;
}

export interface TrainChallenge {
  id: string; 
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  xpReward: number;
  requirement: TrainChallengeRequirement;

  isActive: boolean;
  startDate?: Date; 
  endDate?: Date; 

  createdAt: Date;
  createdBy?: string; 
  order: number; 

  bonusXP?: number; 
  bonusCondition?: string; 
  thumbnailUrl?: string; 
  tags?: string[]; 
}

export interface UserTrainChallengeProgress {
  id: string; 
  challengeId: string; 
  userId?: string;

  progress: number; 
  isCompleted: boolean;
  completedAt?: Date;
  startedAt: Date;
  lastProgressAt: Date;

  bestScore?: TrainChallengeScore;
  attempts: number; 
  bonusEarned: boolean; 
}

export interface TrainChallengeScore {
  accuracy: number; 
  combo: number; 
  grade: string; 
  completionTime?: number; 
  mode: PracticeMode; 
  achievedAt: Date;
}

export type TrainChallengeFilter = "all" | "active" | "completed" | "available";
export type TrainChallengeSortBy = "difficulty" | "xp" | "newest" | "expiring";

export interface TrainChallengeFilters {
  filter: TrainChallengeFilter;
  sortBy: TrainChallengeSortBy;
  difficulty?: ChallengeDifficulty;
  mode?: PracticeMode;
}

export function calculateChallengeProgress(
  progress: number,
  target: number
): number {
  return Math.min(100, (progress / target) * 100);
}

export function isChallengeExpired(challenge: TrainChallenge): boolean {
  if (!challenge.endDate) return false;
  return new Date() > challenge.endDate;
}

export function isChallengeAvailable(challenge: TrainChallenge): boolean {
  if (!challenge.isActive) return false;
  if (challenge.startDate && new Date() < challenge.startDate) return false;
  if (isChallengeExpired(challenge)) return false;
  return true;
}

export function getDifficultyColor(difficulty: ChallengeDifficulty): string {
  switch (difficulty) {
    case "easy":
    case "beginner":
      return "#22c55e"; 
    case "medium":
    case "intermediate":
      return "#3b82f6"; 
    case "hard":
    case "advanced":
      return "#ef4444"; 
    default:
      return "#9ca3af"; 
  }
}

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
