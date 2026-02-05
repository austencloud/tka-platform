/**
 * Skill Progression Service Interface
 *
 * Handles skill progression tracking, level advancement, and mastery.
 * Skills are organized by category: Letter Mastery, Concept Mastery, Practice Goals.
 */

import type {
  SkillProgression,
  UserSkillProgress,
  SkillCategory,
  SkillLevel,
} from "../../domain/models/challenge-models";
import type { XPEventMetadata } from "../../domain/models/achievement-models";

export interface ISkillProgressionTracker {
  /**
   * Initialize the skill progression system
   * Loads skill definitions and user progress
   */
  initialize(): Promise<void>;

  // ============================================================================
  // SKILL RETRIEVAL
  // ============================================================================

  /**
   * Get all available skill progressions
   */
  getAllSkills(): Promise<SkillProgression[]>;

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: SkillCategory): Promise<SkillProgression[]>;

  /**
   * Get a specific skill by ID
   */
  getSkillById(skillId: string): Promise<SkillProgression | null>;

  /**
   * Get all skills available to current user (based on prerequisites and level)
   */
  getAvailableSkills(): Promise<SkillProgression[]>;

  /**
   * Get skills that are locked for current user
   */
  getLockedSkills(): Promise<
    Array<{
      skill: SkillProgression;
      reason: "prerequisite" | "level" | "not_active";
      missingPrerequisites?: string[];
      requiredLevel?: number;
    }>
  >;

  // ============================================================================
  // PROGRESS TRACKING
  // ============================================================================

  /**
   * Get user's progress for all skills
   */
  getAllUserProgress(): Promise<Map<string, UserSkillProgress>>;

  /**
   * Get user's progress for a specific skill
   */
  getUserProgress(skillId: string): Promise<UserSkillProgress | null>;

  /**
   * Get user's progress for skills in a category
   */
  getUserProgressByCategory(
    category: SkillCategory
  ): Promise<Map<string, UserSkillProgress>>;

  /**
   * Start tracking progress for a skill (unlock it)
   */
  startSkill(skillId: string): Promise<UserSkillProgress>;

  /**
   * Update progress for a skill
   * Returns updated progress and whether level was completed
   */
  updateSkillProgress(
    skillId: string,
    progressDelta: number,
    metadata?: XPEventMetadata
  ): Promise<{
    progress: UserSkillProgress;
    levelCompleted: boolean;
    skillCompleted: boolean;
    xpAwarded: number;
  }>;

  /**
   * Track an action that may contribute to skill progress
   * Automatically finds relevant skills and updates progress
   */
  trackAction(
    actionType: SkillProgressActionType,
    metadata: SkillProgressMetadata
  ): Promise<
    Array<{
      skillId: string;
      progressDelta: number;
      levelCompleted: boolean;
      skillCompleted: boolean;
    }>
  >;

  // ============================================================================
  // LEVEL MANAGEMENT
  // ============================================================================

  /**
   * Get current level details for a skill
   */
  getCurrentLevel(skillId: string): Promise<SkillLevel | null>;

  /**
   * Get next level details for a skill (null if maxed)
   */
  getNextLevel(skillId: string): Promise<SkillLevel | null>;

  /**
   * Check if user can level up a skill
   */
  canLevelUp(skillId: string): Promise<boolean>;

  /**
   * Level up a skill (if requirements are met)
   */
  levelUp(skillId: string): Promise<{
    success: boolean;
    newLevel: number;
    xpAwarded: number;
    skillCompleted: boolean;
  }>;

  // ============================================================================
  // COMPLETION & MASTERY
  // ============================================================================

  /**
   * Check if a skill is fully mastered (all levels complete)
   */
  isSkillMastered(skillId: string): Promise<boolean>;

  /**
   * Get all mastered skills
   */
  getMasteredSkills(): Promise<SkillProgression[]>;

  /**
   * Get skills in progress (started but not mastered)
   */
  getSkillsInProgress(): Promise<
    Array<{
      skill: SkillProgression;
      progress: UserSkillProgress;
    }>
  >;

  /**
   * Get recently completed levels (last 7 days)
   */
  getRecentCompletions(): Promise<
    Array<{
      skill: SkillProgression;
      level: number;
      completedAt: Date;
    }>
  >;

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get overall skill statistics
   */
  getStats(): Promise<{
    totalSkills: number;
    skillsStarted: number;
    skillsInProgress: number;
    skillsMastered: number;
    totalLevelsCompleted: number;
    totalPossibleLevels: number;
    completionPercentage: number;
    xpFromSkills: number;
    byCategory: Map<
      SkillCategory,
      {
        total: number;
        started: number;
        mastered: number;
        levelsCompleted: number;
      }
    >;
  }>;

  /**
   * Get stats for a specific category
   */
  getCategoryStats(category: SkillCategory): Promise<{
    total: number;
    started: number;
    mastered: number;
    levelsCompleted: number;
    totalPossibleLevels: number;
    completionPercentage: number;
  }>;

  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================

  /**
   * Get recommended skills to start or continue
   */
  getRecommendedSkills(limit?: number): Promise<
    Array<{
      skill: SkillProgression;
      reason: "continue" | "new" | "almost_complete" | "trending";
      progress?: UserSkillProgress;
    }>
  >;
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

/**
 * Action types that can contribute to skill progress
 */
export type SkillProgressActionType =
  | "sequence_created"
  | "sequence_with_letter"
  | "drill_completed"
  | "quiz_completed"
  | "daily_practice"
  | "challenge_completed"
  | "exploration_complete";

/**
 * Metadata for skill progress tracking
 */
export interface SkillProgressMetadata {
  letter?: string; // For letter-specific actions
  conceptId?: string; // For concept-specific actions
  quizScore?: number; // Score from 0-100
  practiceMinutes?: number; // Duration of practice
  sequenceId?: string; // Created sequence
  challengeType?: "daily" | "weekly";
  [key: string]: unknown;
}
