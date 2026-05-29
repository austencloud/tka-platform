/**
 * TKA Database - Dexie Configuration
 *
 * This is your main database configuration using Dexie.js
 * Think of this as your "database schema" - it defines what tables you have
 * and how they're indexed for fast queries.
 */

import type { AppSettings } from "../../settings/domain/AppSettings";
import type { PictographData } from "../../pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "../../foundation/domain/models/SequenceData";
import Dexie, { type EntityTable } from "dexie";
import type {
  AchievementNotification,
  DailyChallenge,
  UserAchievement,
  UserChallengeProgress,
  UserStreak,
  UserXP,
  XPGainEvent,
} from "../../gamification/domain/models/achievement-models";
import type {
  WeeklyChallenge,
  UserWeeklyChallengeProgress,
  SkillProgression,
  UserSkillProgress,
} from "../../gamification/domain/models/challenge-models";
import type {
  StoredPerformance,
  StoredCalibrationProfile,
} from "$lib/shared/train/domain/TrainDatabaseModels";
import type { Composition } from "$lib/shared/animation-engine/domain/compose-types";
import type {
  GalleryCacheEntry,
  GalleryCacheMeta,
} from "$lib/shared/offline/domain/offline-cache-types";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  DEFAULT_USER_WORK_VERSION,
  TABLE_INDEXES,
} from "../domain/constants/DATABASE_CONSTANTS";
import type { UserProject } from "../domain/models/user-project";
import type { UserWorkData } from "../domain/models/user-work-data";

// ============================================================================
// DATABASE CLASS
// ============================================================================

/**
 * TKA Database Class
 *
 * This extends Dexie and defines your database structure.
 * Each property represents a "table" in your database.
 */
export class TKADatabase extends Dexie {
  // Define your tables with TypeScript types
  sequences!: EntityTable<SequenceData, "id">;
  pictographs!: EntityTable<PictographData, "id">;
  userWork!: EntityTable<UserWorkData, "id">;
  userProjects!: EntityTable<UserProject, "id">;
  settings!: EntityTable<AppSettings & { id: string }, "id">;

  // Gamification tables (v2)
  userAchievements!: EntityTable<UserAchievement, "id">;
  userXP!: EntityTable<UserXP, "id">;
  xpEvents!: EntityTable<XPGainEvent, "id">;
  dailyChallenges!: EntityTable<DailyChallenge, "id">;
  userChallengeProgress!: EntityTable<UserChallengeProgress, "id">;
  userStreaks!: EntityTable<UserStreak, "id">;
  achievementNotifications!: EntityTable<AchievementNotification, "id">;

  // Challenge extension tables (v3)
  weeklyChallenges!: EntityTable<WeeklyChallenge, "id">;
  userWeeklyProgress!: EntityTable<UserWeeklyChallengeProgress, "id">;
  skillProgressions!: EntityTable<SkillProgression, "id">;
  userSkillProgress!: EntityTable<UserSkillProgress, "id">;

  // Train module tables (v4)
  trainPerformances!: EntityTable<StoredPerformance, "id">;
  trainCalibrationProfiles!: EntityTable<StoredCalibrationProfile, "id">;

  // Compose module tables (v5)
  compositions!: EntityTable<Composition, "id">;

  // Offline cache tables (v6)
  galleryCache!: EntityTable<GalleryCacheEntry, "id">;
  galleryCacheMeta!: EntityTable<GalleryCacheMeta, "id">;

  constructor() {
    super(DATABASE_NAME);

    // Version 1 schema - this is like a database migration
    this.version(DATABASE_VERSION).stores(TABLE_INDEXES);

    // Optional: Add hooks for automatic timestamps
    this.userWork.hook("creating", function (_primKey, obj, _trans) {
      obj.lastModified = new Date();
      obj.version = obj.version || DEFAULT_USER_WORK_VERSION;
    });

    this.userWork.hook(
      "updating",
      function (modifications, _primKey, _obj, _trans) {
        (modifications as Partial<UserWorkData>).lastModified = new Date();
      }
    );
  }
}

// ============================================================================
// DATABASE INSTANCE
// ============================================================================

/**
 * Single database instance for your entire app
 * Import this wherever you need database access
 */
export const db = new TKADatabase();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Initialize database - call this when your app starts
 */
export async function initializeDatabase(): Promise<void> {
  await db.open();
}

/**
 * Clear all data (useful for development/testing)
 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.sequences,
      db.pictographs,
      db.userWork,
      db.userProjects,
      db.settings,
      db.userAchievements,
      db.userXP,
      db.xpEvents,
      db.dailyChallenges,
      db.userChallengeProgress,
      db.userStreaks,
      db.achievementNotifications,
      db.weeklyChallenges,
      db.userWeeklyProgress,
      db.skillProgressions,
      db.userSkillProgress,
      db.trainPerformances,
      db.trainCalibrationProfiles,
      db.compositions,
      db.galleryCache,
      db.galleryCacheMeta,
    ],
    async () => {
      await db.sequences.clear();
      await db.pictographs.clear();
      await db.userWork.clear();
      await db.userProjects.clear();
      await db.settings.clear();
      await db.userAchievements.clear();
      await db.userXP.clear();
      await db.xpEvents.clear();
      await db.dailyChallenges.clear();
      await db.userChallengeProgress.clear();
      await db.userStreaks.clear();
      await db.achievementNotifications.clear();
      await db.weeklyChallenges.clear();
      await db.userWeeklyProgress.clear();
      await db.skillProgressions.clear();
      await db.userSkillProgress.clear();
      await db.trainPerformances.clear();
      await db.trainCalibrationProfiles.clear();
      await db.compositions.clear();
      await db.galleryCache.clear();
      await db.galleryCacheMeta.clear();
    }
  );
}

/**
 * Get database info for debugging
 */
export async function getDatabaseInfo() {
  const info = {
    sequences: await db.sequences.count(),
    pictographs: await db.pictographs.count(),
    userWork: await db.userWork.count(),
    userProjects: await db.userProjects.count(),
    settings: await db.settings.count(),
    // Gamification stats (v2)
    userAchievements: await db.userAchievements.count(),
    userXP: await db.userXP.count(),
    xpEvents: await db.xpEvents.count(),
    dailyChallenges: await db.dailyChallenges.count(),
    userChallengeProgress: await db.userChallengeProgress.count(),
    userStreaks: await db.userStreaks.count(),
    achievementNotifications: await db.achievementNotifications.count(),
    // Challenge extension stats (v3)
    weeklyChallenges: await db.weeklyChallenges.count(),
    userWeeklyProgress: await db.userWeeklyProgress.count(),
    skillProgressions: await db.skillProgressions.count(),
    userSkillProgress: await db.userSkillProgress.count(),
    // Train module stats (v4)
    trainPerformances: await db.trainPerformances.count(),
    trainCalibrationProfiles: await db.trainCalibrationProfiles.count(),
    // Compose module stats (v5)
    compositions: await db.compositions.count(),
    // Offline cache stats (v6)
    galleryCache: await db.galleryCache.count(),
    galleryCacheMeta: await db.galleryCacheMeta.count(),
  };
  return info;
}
