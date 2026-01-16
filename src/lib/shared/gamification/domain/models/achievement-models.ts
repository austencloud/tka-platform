/**
 * Gamification Domain Models
 *
 * These models define the structure for achievements, XP, and daily challenges.
 */

// ============================================================================
// ACHIEVEMENT MODELS
// ============================================================================

export type AchievementCategory =
  | "creator" // Building sequences
  | "scholar" // Learning concepts
  | "practitioner" // Daily streaks & practice
  | "explorer" // Browsing gallery
  | "performer" // Video submissions (Phase 3)
  | "trainer" // Training challenges
  | "contributor"; // Feedback submission

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  xpReward: number;
  icon: string; // Emoji or icon identifier
  requirement: AchievementRequirement;
}

/**
 * Metadata for achievement requirements
 */
export interface AchievementMetadata {
  // For letter_usage type
  requiredLetters?: string[];
  // For specific_action type
  conceptId?: string;
  // For generation_count type
  generationCriteria?: string;
  // Generic additional properties
  [key: string]: unknown;
}

export interface AchievementRequirement {
  type:
    | "sequence_count" // Create X sequences
    | "concept_completion" // Complete X concepts
    | "daily_streak" // Login/practice X days in a row
    | "gallery_exploration" // Discover X sequences
    | "letter_usage" // Create sequence with specific letters
    | "sequence_length" // Create sequence of X steps
    | "generation_count" // Generate X sequences
    | "challenge_count" // Complete training challenges
    | "feedback_count" // Submit X feedback items
    | "specific_action"; // Complete specific action once
  target: number; // How many to complete (1 for one-time achievements)
  metadata?: AchievementMetadata; // Additional data (e.g., required letters, specific concept ID)
}

export interface UserAchievement {
  id: string; // Auto-generated
  achievementId: string; // Reference to Achievement
  userId?: string; // Optional: For future multi-user support
  unlockedAt: Date;
  progress: number; // Current progress toward completion
  isCompleted: boolean;
  notificationShown: boolean; // Track if user has seen the unlock notification
}

// ============================================================================
// XP & LEVEL MODELS
// ============================================================================

export interface UserXP {
  id: string; // "xp_progress" (single record per user)
  userId?: string; // Optional: For future multi-user support
  totalXP: number;
  currentLevel: number;
  xpToNextLevel: number;
  lastUpdated: Date;
}

/**
 * Metadata for XP gain events
 */
export interface XPEventMetadata {
  // For sequence_created
  stepCount?: number;
  letters?: string[];
  // For achievement_unlocked
  achievementId?: string;
  tier?: AchievementTier;
  // For drill_completed
  drillId?: string;
  score?: number;
  // For daily_challenge_completed
  challengeId?: string;
  challengeType?: ChallengeType | "train";
  // For concept_learned
  conceptId?: string;
  // For daily_login
  currentStreak?: number;
  // For weekly_challenge_completed / weekly_challenge_bonus
  weekNumber?: number;
  year?: number;
  bonusEarned?: boolean;
  // For skill_level_completed / skill_mastery_achieved
  skillId?: string;
  skillLevel?: number;
  skillCategory?: string;
  // For training_session_completed / training_combo_20
  accuracy?: number;
  combo?: number;
  // Generic timestamp
  timestamp?: number;
  // Generic reason
  reason?: string;
  // Generic additional properties
  [key: string]: unknown;
}

export interface XPGainEvent {
  id: string;
  action: XPActionType;
  xpGained: number;
  timestamp: Date;
  metadata?: XPEventMetadata;
}

export type XPActionType =
  | "sequence_created"
  | "sequence_published"
  | "concept_learned"
  | "drill_completed"
  | "daily_challenge_completed"
  | "achievement_unlocked"
  | "daily_login"
  // Weekly challenges
  | "weekly_challenge_completed"
  | "weekly_challenge_bonus"
  // Training
  | "training_session_completed"
  | "perfect_training_run"
  | "training_combo_20"
  | "timed_150bpm"
  | "train_challenge_completed"
  // Skill progressions
  | "skill_level_completed"
  | "skill_mastery_achieved"
  // Feedback
  | "feedback_submitted";

// ============================================================================
// DAILY CHALLENGE MODELS
// ============================================================================

export type ChallengeType =
  | "build_sequence" // Build specific sequence
  | "use_letters" // Use specific letters
  | "sequence_length" // Create X-beat sequence
  | "complete_concept" // Complete specific concept
  | "explore_gallery" // Discover X sequences
  | "generation_challenge"; // Generate sequences with criteria

export type ChallengeDifficulty =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "easy"
  | "medium"
  | "hard"
  | "expert";

/**
 * Canonical difficulty ordering from easiest to hardest.
 * Use this array for consistent sorting across the application.
 * Maps both naming conventions (easy/medium/hard and beginner/intermediate/advanced)
 */
export const DIFFICULTY_ORDER: ChallengeDifficulty[] = [
  "easy",
  "beginner",
  "medium",
  "intermediate",
  "hard",
  "advanced",
  "expert",
];

/**
 * Get the sort index for a difficulty level.
 * Lower index = easier difficulty.
 */
export function getDifficultySortIndex(
  difficulty: ChallengeDifficulty
): number {
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  return index >= 0 ? index : DIFFICULTY_ORDER.length;
}

export interface DailyChallenge {
  id: string; // Date-based: e.g., "challenge_2025-11-01"
  date: string; // ISO date string (YYYY-MM-DD)
  type: ChallengeType;
  difficulty: ChallengeDifficulty;
  title: string;
  description: string;
  xpReward: number;
  requirement: ChallengeRequirement;
  expiresAt: Date; // End of day
}

/**
 * Metadata for challenge requirements
 */
export interface ChallengeMetadata {
  // For build_sequence type
  requiredSequence?: string;
  // For use_letters type
  requiredLetters?: string[];
  // For complete_concept type
  conceptId?: string;
  // For generation_challenge type
  generationCriteria?: string;
  // Generic additional properties
  [key: string]: unknown;
}

export interface ChallengeRequirement {
  type: ChallengeType;
  target: number;
  metadata?: ChallengeMetadata; // Challenge-specific data
}

export interface UserChallengeProgress {
  id: string; // Auto-generated
  challengeId: string;
  userId?: string;
  progress: number;
  isCompleted: boolean;
  completedAt?: Date;
  startedAt: Date;
}

// ============================================================================
// STREAK MODELS
// ============================================================================

export interface UserStreak {
  id: string; // "streak_data" (single record per user)
  userId?: string;
  currentStreak: number; // Days in a row
  longestStreak: number;
  lastActivityDate: string; // ISO date string (YYYY-MM-DD)
  streakStartDate: string; // ISO date string
}

// ============================================================================
// NOTIFICATION MODELS
// ============================================================================

/**
 * Metadata for achievement notifications
 */
export interface NotificationData {
  // For achievement type
  achievementId?: string;
  xpGained?: number;
  // For level_up type
  newLevel?: number;
  milestoneTitle?: string;
  // For challenge_complete type
  challengeTitle?: string;
  // For streak_milestone type
  streakDays?: number;
  // Generic additional properties
  [key: string]: unknown;
}

export interface AchievementNotification {
  id: string;
  type:
    | "achievement"
    | "level_up"
    | "challenge_complete"
    | "streak_milestone"
    | "xp_gain";
  title: string;
  message: string;
  icon?: string;
  timestamp: Date;
  isRead: boolean;
  data?: NotificationData; // Additional notification data
}
