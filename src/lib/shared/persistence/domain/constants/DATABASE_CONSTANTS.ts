/**
 * Database Constants
 *
 * Centralized configuration for the TKA database including
 * database name, table names, indexes, and version information.
 */

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

/**
 * Main database name in IndexedDB
 */
export const DATABASE_NAME = "TKADatabase";

/**
 * Current database schema version
 * Version 2: Added gamification tables (achievements, XP, challenges, streaks, notifications)
 * Version 3: Added weekly challenges and skill progressions
 * Version 4: Added train module tables (performances, calibration profiles)
 * Version 5: Added compositions table for Compose module
 * Version 6: Added galleryCache and galleryCacheMeta tables for offline browse gallery
 */
export const DATABASE_VERSION = 6;

// ============================================================================
// TABLE NAMES
// ============================================================================

export const TABLE_NAMES = {
  SEQUENCES: "sequences",
  PICTOGRAPHS: "pictographs",
  USER_WORK: "userWork",
  USER_PROJECTS: "userProjects",
  SETTINGS: "settings",
  // Gamification tables (v2)
  USER_ACHIEVEMENTS: "userAchievements",
  USER_XP: "userXP",
  XP_EVENTS: "xpEvents",
  DAILY_CHALLENGES: "dailyChallenges",
  USER_CHALLENGE_PROGRESS: "userChallengeProgress",
  USER_STREAKS: "userStreaks",
  ACHIEVEMENT_NOTIFICATIONS: "achievementNotifications",
  // Challenge extension tables (v3)
  WEEKLY_CHALLENGES: "weeklyChallenges",
  USER_WEEKLY_PROGRESS: "userWeeklyProgress",
  SKILL_PROGRESSIONS: "skillProgressions",
  USER_SKILL_PROGRESS: "userSkillProgress",
  // Train module tables (v4)
  TRAIN_PERFORMANCES: "trainPerformances",
  TRAIN_CALIBRATION_PROFILES: "trainCalibrationProfiles",
  // Compose module tables (v5)
  COMPOSITIONS: "compositions",
  // Offline cache tables (v6)
  GALLERY_CACHE: "galleryCache",
  GALLERY_CACHE_META: "galleryCacheMeta",
} as const;

// ============================================================================
// INDEX CONFIGURATIONS
// ============================================================================

/**
 * Index definitions for each table
 * Format: '++primaryKey, index1, index2, *multiValueIndex'
 */
export const TABLE_INDEXES = {
  [TABLE_NAMES.SEQUENCES]:
    "++id, name, word, author, dateAdded, level, isFavorite, difficultyLevel, *tags",
  [TABLE_NAMES.PICTOGRAPHS]: "++id, letter, startPosition, endPosition",
  [TABLE_NAMES.USER_WORK]:
    "++id, type, tabId, [type+tabId], userId, lastModified",
  [TABLE_NAMES.USER_PROJECTS]:
    "++id, name, userId, createdAt, lastModified, isPublic, *tags",
  [TABLE_NAMES.SETTINGS]: "++id, userId",
  // Gamification tables (v2)
  [TABLE_NAMES.USER_ACHIEVEMENTS]:
    "++id, achievementId, userId, isCompleted, unlockedAt",
  [TABLE_NAMES.USER_XP]: "++id, userId, totalXP, currentLevel, lastUpdated",
  [TABLE_NAMES.XP_EVENTS]: "++id, action, timestamp, userId",
  [TABLE_NAMES.DAILY_CHALLENGES]: "++id, date, difficulty, expiresAt",
  [TABLE_NAMES.USER_CHALLENGE_PROGRESS]:
    "++id, challengeId, userId, isCompleted, completedAt",
  [TABLE_NAMES.USER_STREAKS]: "++id, userId, currentStreak, longestStreak",
  [TABLE_NAMES.ACHIEVEMENT_NOTIFICATIONS]: "++id, type, timestamp, isRead",
  // Challenge extension tables (v3)
  [TABLE_NAMES.WEEKLY_CHALLENGES]:
    "++id, weekNumber, year, [year+weekNumber], isActive, startDate, endDate",
  [TABLE_NAMES.USER_WEEKLY_PROGRESS]:
    "++id, challengeId, userId, [year+weekNumber], isCompleted, completedAt",
  [TABLE_NAMES.SKILL_PROGRESSIONS]:
    "++id, skillId, skillCategory, isActive, order",
  [TABLE_NAMES.USER_SKILL_PROGRESS]:
    "++id, skillId, userId, currentLevel, isCompleted, lastProgressAt",
  // Train module tables (v4)
  [TABLE_NAMES.TRAIN_PERFORMANCES]:
    "++id, sequenceId, performedAt, grade, [sequenceId+performedAt], score.percentage",
  [TABLE_NAMES.TRAIN_CALIBRATION_PROFILES]: "++id, name, createdAt, isDefault",
  // Compose module tables (v5)
  [TABLE_NAMES.COMPOSITIONS]:
    "++id, name, createdAt, updatedAt, creator, isFavorite",
  // Offline cache tables (v6)
  [TABLE_NAMES.GALLERY_CACHE]: "id, data.word, data.ownerId, cachedAt",
  [TABLE_NAMES.GALLERY_CACHE_META]: "id",
} as const;

// ============================================================================
// DATA VERSIONING
// ============================================================================

/**
 * Default version for new user work data
 */
export const DEFAULT_USER_WORK_VERSION = 1;

/**
 * Default version for new user projects
 */
export const DEFAULT_USER_PROJECT_VERSION = 1;

// ============================================================================
// PERFORMANCE SETTINGS
// ============================================================================

/**
 * Maximum number of items to return in a single query
 */
export const MAX_QUERY_LIMIT = 1000;

/**
 * Default page size for paginated queries
 */
export const DEFAULT_PAGE_SIZE = 50;
