/**
 * Challenge Domain Models
 *
 * Extended challenge types for Weekly Challenges and Skill Progressions.
 * Builds on the existing DailyChallenge system in achievement-models.ts.
 */

import type {
  ChallengeType,
  ChallengeDifficulty,
  ChallengeRequirement,
} from "./achievement-models";

// ============================================================================
// CHALLENGE SCOPE
// ============================================================================

export type ChallengeScope =
  | "daily"
  | "weekly"
  | "skill_progression"
  | "community_event"; // Future

// ============================================================================
// WEEKLY CHALLENGE MODELS
// ============================================================================

export interface WeeklyChallenge {
  id: string; // Format: "week_YYYY_WW" e.g., "week_2025_48"
  weekNumber: number; // ISO week number (1-53)
  year: number;
  startDate: Date; // Monday 00:00:00
  endDate: Date; // Sunday 23:59:59
  type: ChallengeType;
  difficulty: ChallengeDifficulty;
  title: string;
  description: string;
  xpReward: number;
  bonusMultiplier?: number; // XP multiplier for early completion (e.g., 1.5)
  bonusDeadline?: Date; // Complete before this for bonus
  requirement: ChallengeRequirement;
  isActive: boolean;
  createdAt: Date;
}

export interface UserWeeklyChallengeProgress {
  id: string; // Auto-generated
  challengeId: string; // Reference to WeeklyChallenge.id
  userId?: string;
  weekNumber: number;
  year: number;
  progress: number;
  isCompleted: boolean;
  completedAt?: Date;
  startedAt: Date;
  bonusEarned: boolean; // Did they complete before bonus deadline?
}

// ============================================================================
// SKILL PROGRESSION MODELS
// ============================================================================

export type SkillCategory =
  | "letter_mastery" // A-Z individual letter skills
  | "concept_mastery" // Learning concepts
  | "practice_goals"; // Streak and time-based

export interface SkillLevel {
  level: number; // 1, 2, 3, 4...
  title: string; // e.g., "Novice", "Apprentice", "Expert", "Master"
  description: string;
  requirement: SkillRequirement;
  xpReward: number;
}

export interface SkillRequirement {
  type: SkillRequirementType;
  target: number;
  metadata?: SkillRequirementMetadata;
}

export type SkillRequirementType =
  | "sequence_with_letter" // Create sequences containing specific letter
  | "unique_sequences_with_letter" // Create unique sequences with letter
  | "concept_drills_completed" // Complete drills for concept
  | "concept_quiz_score" // Achieve score on concept quiz
  | "consecutive_days" // Practice X days in a row
  | "total_practice_time" // Accumulate X minutes
  | "sequences_created_total" // Total sequences created
  | "challenges_completed"; // Complete X challenges

export interface SkillRequirementMetadata {
  letter?: string; // For letter_mastery skills
  conceptId?: string; // For concept_mastery skills
  minScore?: number; // Minimum score required
  timeUnit?: "minutes" | "hours" | "days" | string; // For time-based requirements
  [key: string]: unknown;
}

export interface SkillProgression {
  id: string; // e.g., "skill_letter_A", "skill_concept_timing"
  skillId: string; // Unique identifier
  skillName: string; // Display name
  skillCategory: SkillCategory;
  description: string;
  icon: string; // Emoji or icon identifier
  levels: SkillLevel[];
  totalLevels: number;
  prerequisiteSkillIds?: string[]; // Skills that must be completed first
  minimumUserLevel?: number; // Minimum user level required to start
  xpPerLevel: number; // Base XP per level (can vary by level)
  completionBadgeId?: string; // Badge awarded on completion
  isActive: boolean;
  order: number; // Display order within category
  createdAt: Date;
}

export interface UserSkillProgress {
  id: string; // Auto-generated
  skillId: string; // Reference to SkillProgression.skillId
  userId?: string;
  currentLevel: number; // Current level (0 = not started, 1 = on level 1, etc.)
  levelProgress: number; // Progress within current level (0 to target)
  isCompleted: boolean; // All levels completed
  startedAt: Date;
  lastProgressAt: Date;
  completedLevels: number[]; // Array of completed level numbers
  completedAt?: Date; // When all levels were completed
}

// ============================================================================
// LEADERBOARD MODELS (Extended)
// ============================================================================

export type LeaderboardCategory =
  | "xp"
  | "level"
  | "sequences"
  | "achievements"
  | "streak"
  | "weekly_challenges"
  | "skill_mastery";

export type LeaderboardTimeframe = "week" | "month" | "all_time";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  username: string;
  avatar?: string;
  // Category-specific values
  totalXP?: number;
  currentLevel?: number;
  sequenceCount?: number;
  achievementCount?: number;
  currentStreak?: number;
  longestStreak?: number;
  weeklyChallengesCompleted?: number;
  skillsCompleted?: number;
  // Metadata
  rankChange?: number; // +5 or -2 since last period
  isCurrentUser?: boolean;
  tier?: "gold" | "silver" | "bronze"; // Top 3 get tiers
}

export interface LeaderboardData {
  category: LeaderboardCategory;
  timeframe: LeaderboardTimeframe;
  entries: LeaderboardEntry[];
  currentUserRank?: number;
  totalUsers: number;
  lastUpdated: Date;
}

// ============================================================================
// CHALLENGE DASHBOARD MODELS
// ============================================================================

import type {
  DailyChallenge,
  UserChallengeProgress,
} from "./achievement-models";

export interface ChallengeDashboard {
  daily: {
    challenge: DailyChallenge | null;
    progress: UserChallengeProgress | null;
  };
  weekly: {
    challenge: WeeklyChallenge | null;
    progress: UserWeeklyChallengeProgress | null;
  };
  skills: {
    inProgressSkills: SkillProgression[];
    userProgress: Map<string, UserSkillProgress>;
    recentlyCompleted: SkillProgression[];
  };
  stats: {
    dailyStreak: number;
    weeklyStreak: number;
    totalChallengesCompleted: number;
    totalSkillLevels: number;
    totalSkillsCompleted: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a weekly challenge ID from year and week number
 */
export function getWeeklyChallengeId(year: number, weekNumber: number): string {
  return `week_${year}_${weekNumber.toString().padStart(2, "0")}`;
}

/**
 * Get the current ISO week number
 */
export function getCurrentWeekNumber(): { year: number; weekNumber: number } {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return { year: now.getFullYear(), weekNumber };
}

/**
 * Get week start and end dates from year and week number
 */
export function getWeekDates(
  year: number,
  weekNumber: number
): { startDate: Date; endDate: Date } {
  // Get January 1st of the year
  const jan1 = new Date(year, 0, 1);
  // Calculate the first Monday of the year
  const dayOfWeek = jan1.getDay();
  const daysToMonday =
    dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const firstMonday = new Date(year, 0, 1 + daysToMonday);

  // Calculate the Monday of the requested week
  const startDate = new Date(firstMonday);
  startDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  startDate.setHours(0, 0, 0, 0);

  // Calculate Sunday (end of week)
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

/**
 * Check if a skill is unlocked based on prerequisites
 */
export function isSkillUnlocked(
  skill: SkillProgression,
  completedSkillIds: string[],
  userLevel: number
): boolean {
  // Check minimum user level
  if (skill.minimumUserLevel && userLevel < skill.minimumUserLevel) {
    return false;
  }

  // Check prerequisites
  if (skill.prerequisiteSkillIds && skill.prerequisiteSkillIds.length > 0) {
    return skill.prerequisiteSkillIds.every((prereqId) =>
      completedSkillIds.includes(prereqId)
    );
  }

  return true;
}
