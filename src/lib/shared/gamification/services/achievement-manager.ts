/**
 * Achievement Service Implementation (Firebase + Firestore)
 *
 * Handles XP tracking, achievement unlocking, and progress monitoring.
 * Uses Firestore as source of truth with IndexedDB caching for performance.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  increment,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "../../auth/firebase";
import { db } from "../../persistence/database/TKADatabase";
import {
  getUserAchievementsPath,
  getUserXPPath,
  getUserXPEventsPath,
} from "../data/firestore-collections";
import {
  calculateLevelFromXP,
  XP_REWARDS,
} from "../domain/constants/xp-constants";
import { ALL_ACHIEVEMENTS } from "../domain/constants/achievement-definitions";
import type {
  Achievement,
  UserAchievement,
  UserXP,
  XPActionType,
  XPGainEvent,
  XPEventMetadata,
} from "../domain/models/achievement-models";
import {
  showXPGain,
  showLevelUp,
  showAchievementUnlock,
} from "$lib/shared/gamification/services/gamification-notifier";

export class AchievementManager {
  private _initialized = false;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    try {
      const user = auth.currentUser;

      if (!user) {
        return;
      }

      // Initialize user XP record if it doesn't exist
      await this.initializeUserXP(user.uid);

      // Initialize achievement progress for all achievements
      await this.initializeUserAchievements(user.uid);

      this._initialized = true;
    } catch (error) {
      console.error("❌ Failed to initialize AchievementManager:", error);
      throw error;
    }
  }

  /**
   * Initialize user XP document in Firestore if it doesn't exist
   */
  private async initializeUserXP(userId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const xpDocRef = doc(firestore, getUserXPPath(userId));
      const xpDoc = await getDoc(xpDocRef);

      if (!xpDoc.exists()) {
        const initialXP: UserXP = {
          id: "current",
          userId,
          totalXP: 0,
          currentLevel: 1,
          xpToNextLevel: 100,
          lastUpdated: new Date(),
        };

        await setDoc(xpDocRef, {
          ...initialXP,
          lastUpdated: serverTimestamp(),
        });

        // Also cache locally
        await db.userXP.add(initialXP);

      } else {
        // Cache existing Firestore data locally
        const firestoreXP = xpDoc.data() as UserXP;
        await db.userXP.put({
          ...firestoreXP,
          lastUpdated:
            firestoreXP.lastUpdated instanceof Timestamp
              ? firestoreXP.lastUpdated.toDate()
              : new Date(firestoreXP.lastUpdated),
        });
      }
    } catch (error) {
      console.error(
        "❌ [AchievementManager] Failed to initialize user XP:",
        error
      );
      throw error;
    }
  }

  /**
   * Initialize user achievement progress for all achievements
   * Uses a single batch query instead of individual reads for each achievement
   */
  private async initializeUserAchievements(userId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const achievementsPath = getUserAchievementsPath(userId);
      const achievementsCollectionRef = collection(firestore, achievementsPath);

      // Fetch ALL existing achievements in a single query (1 DB call instead of 22+)
      const existingSnapshot = await getDocs(achievementsCollectionRef);
      const existingAchievementIds = new Set(
        existingSnapshot.docs.map((d) => d.id)
      );

      // Only create achievements that don't exist yet
      const missingAchievements = ALL_ACHIEVEMENTS.filter(
        (a) => !existingAchievementIds.has(a.id)
      );

      // Batch create missing achievements
      for (const achievement of missingAchievements) {
        const achievementDocRef = doc(
          firestore,
          `${achievementsPath}/${achievement.id}`
        );

        const userAchievement: Omit<UserAchievement, "id"> = {
          achievementId: achievement.id,
          userId,
          unlockedAt: new Date(),
          progress: 0,
          isCompleted: false,
          notificationShown: false,
        };

        await setDoc(achievementDocRef, {
          ...userAchievement,
          unlockedAt: serverTimestamp(),
        });

        // Cache locally
        await db.userAchievements.add({
          id: achievement.id,
          ...userAchievement,
        });
      }

    } catch (error) {
      console.error(
        "❌ [AchievementManager] Failed to initialize user achievements:",
        error
      );
      throw error;
    }
  }

  // ============================================================================
  // XP TRACKING
  // ============================================================================

  async trackAction(
    action: XPActionType,
    metadata?: XPEventMetadata
  ): Promise<{
    xpGained: number;
    newLevel?: number;
    achievementsUnlocked: Achievement[];
  }> {
    const user = auth.currentUser;
    if (!user) {
      console.warn("⚠️ Cannot track action: No user logged in");
      return { xpGained: 0, achievementsUnlocked: [] };
    }

    try {
      // Calculate XP to award
      const xpGained = this.calculateXPForAction(action, metadata);

      if (xpGained === 0) {
        return { xpGained: 0, achievementsUnlocked: [] };
      }

      // Award XP and check for level up
      const { newLevel } = await this.awardXPInternal(
        user.uid,
        xpGained,
        action,
        metadata
      );

      // Show quick XP toast (non-blocking)
      {
        showXPGain(xpGained);
      }

      // Check for achievement progress
      const achievementsUnlocked = await this.checkAchievementProgress(
        action,
        metadata
      );

      const result: {
        xpGained: number;
        achievementsUnlocked: Achievement[];
        newLevel?: number;
      } = {
        xpGained,
        achievementsUnlocked,
      };
      if (newLevel !== undefined) {
        result.newLevel = newLevel;
      }
      return result;
    } catch (error) {
      console.error(`❌ Failed to track action ${action}:`, error);
      throw error;
    }
  }

  /**
   * Calculate XP reward for an action
   */
  private calculateXPForAction(
    action: XPActionType,
    metadata?: XPEventMetadata
  ): number {
    switch (action) {
      case "sequence_created":
        return XP_REWARDS.SEQUENCE_CREATED;
      case "sequence_published":
        return XP_REWARDS.SEQUENCE_PUBLISHED;
      case "concept_learned":
        return XP_REWARDS.CONCEPT_LEARNED;
      case "drill_completed":
        return XP_REWARDS.DRILL_COMPLETED;
      case "daily_login":
        return XP_REWARDS.DAILY_LOGIN;
      case "daily_challenge_completed":
        return XP_REWARDS.DAILY_CHALLENGE_COMPLETED;
      case "achievement_unlocked": {
        // Variable XP based on achievement tier (passed in metadata)
        const tier = metadata?.tier;
        if (tier === "bronze") return XP_REWARDS.ACHIEVEMENT_UNLOCKED_BRONZE;
        if (tier === "silver") return XP_REWARDS.ACHIEVEMENT_UNLOCKED_SILVER;
        if (tier === "gold") return XP_REWARDS.ACHIEVEMENT_UNLOCKED_GOLD;
        if (tier === "platinum")
          return XP_REWARDS.ACHIEVEMENT_UNLOCKED_PLATINUM;
        return 0;
      }
      // Weekly challenges
      case "weekly_challenge_completed":
        return XP_REWARDS.WEEKLY_CHALLENGE_COMPLETED ?? 150;
      case "weekly_challenge_bonus":
        return XP_REWARDS.WEEKLY_CHALLENGE_BONUS ?? 50;
      // Training actions
      case "training_session_completed": {
        const accuracy = metadata?.accuracy ?? 0;
        const combo = metadata?.combo ?? 0;
        let xp = XP_REWARDS.TRAINING_SESSION_COMPLETED;

        if (accuracy === 100) {
          xp += XP_REWARDS.TRAINING_PERFECT_RUN;
        } else if (accuracy >= 85) {
          xp += XP_REWARDS.TRAINING_HIGH_ACCURACY;
        } else if (accuracy >= 70) {
          xp += XP_REWARDS.TRAINING_GOOD_ACCURACY;
        }

        if (combo > 0) {
          xp += combo * XP_REWARDS.TRAINING_COMBO_BONUS;
        }

        return xp;
      }
      case "perfect_training_run":
        return XP_REWARDS.TRAINING_PERFECT_RUN;
      case "training_combo_20": {
        const combo = metadata?.combo ?? 20;
        return combo * XP_REWARDS.TRAINING_COMBO_BONUS;
      }
      case "timed_150bpm":
        return XP_REWARDS.TRAINING_SESSION_COMPLETED;
      case "train_challenge_completed":
        return XP_REWARDS.TRAIN_CHALLENGE_COMPLETED ?? 0;
      // Skill progressions
      case "skill_level_completed":
        return XP_REWARDS.SKILL_LEVEL_COMPLETED ?? 100;
      case "skill_mastery_achieved":
        return XP_REWARDS.SKILL_MASTERY_ACHIEVED ?? 250;
      case "feedback_submitted":
        return XP_REWARDS.FEEDBACK_SUBMITTED ?? 25;
      default:
        return 0;
    }
  }

  /**
   * Award XP to user (internal method)
   */
  private async awardXPInternal(
    userId: string,
    amount: number,
    action: XPActionType,
    metadata?: XPEventMetadata
  ): Promise<{ newLevel?: number }> {
    try {
      const firestore = await getFirestoreInstance();
      const xpDocRef = doc(firestore, getUserXPPath(userId));

      // Get current XP
      const xpDoc = await getDoc(xpDocRef);
      const currentXP = xpDoc.exists() ? (xpDoc.data() as UserXP) : null;

      if (!currentXP) {
        throw new Error("User XP record not found");
      }

      const oldTotalXP = currentXP.totalXP;
      const newTotalXP = oldTotalXP + amount;

      // Calculate new level
      const oldLevel = calculateLevelFromXP(oldTotalXP);
      const newLevel = calculateLevelFromXP(newTotalXP);

      const leveledUp = newLevel.currentLevel > oldLevel.currentLevel;

      // Update Firestore subcollection
      await updateDoc(xpDocRef, {
        totalXP: increment(amount),
        currentLevel: newLevel.currentLevel,
        xpToNextLevel: newLevel.xpToNextLevel,
        lastUpdated: serverTimestamp(),
      });

      // Sync to main user document for leaderboards (denormalized)
      const userDocRef = doc(firestore, `users/${userId}`);
      await updateDoc(userDocRef, {
        totalXP: increment(amount),
        currentLevel: newLevel.currentLevel,
      });

      // Log XP event
      await this.logXPEvent(userId, action, amount, metadata);

      // Update local cache
      await db.userXP.put({
        id: "current",
        userId,
        totalXP: newTotalXP,
        currentLevel: newLevel.currentLevel,
        xpToNextLevel: newLevel.xpToNextLevel,
        lastUpdated: new Date(),
      });

      // Show level up notification if applicable
      if (leveledUp) {
        await showLevelUp(newLevel.currentLevel);
      }

      const result: { newLevel?: number } = {};
      if (leveledUp) {
        result.newLevel = newLevel.currentLevel;
      }
      return result;
    } catch (error) {
      console.error("❌ [AchievementManager] Failed to award XP:", error);
      throw error;
    }
  }

  /**
   * Log XP gain event to Firestore and local DB
   */
  private async logXPEvent(
    userId: string,
    action: XPActionType,
    xpGained: number,
    metadata?: XPEventMetadata
  ): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const eventsPath = getUserXPEventsPath(userId);
      const eventRef = doc(collection(firestore, eventsPath));

      const event: Omit<XPGainEvent, "id"> = {
        action,
        xpGained,
        timestamp: new Date(),
      };
      if (metadata !== undefined) {
        event.metadata = metadata;
      }

      await setDoc(eventRef, {
        ...event,
        timestamp: serverTimestamp(),
      });

      // Cache locally
      await db.xpEvents.add({
        id: eventRef.id,
        ...event,
      });
    } catch (error) {
      // Silent failure - XP event logging is non-critical
      console.error("❌ [AchievementManager] Failed to log XP event:", error);
    }
  }

  async awardXP(amount: number, reason?: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      console.warn("⚠️ Cannot award XP: No user logged in");
      return;
    }

    await this.awardXPInternal(user.uid, amount, "achievement_unlocked", {
      reason: reason ?? "Manual XP award",
    });
  }

  // ============================================================================
  // ACHIEVEMENT TRACKING
  // ============================================================================

  async checkAchievementProgress(
    action: XPActionType,
    metadata?: XPEventMetadata
  ): Promise<Achievement[]> {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const unlockedAchievements: Achievement[] = [];

      // Get all achievements that could be affected by this action
      const relevantAchievements = this.getRelevantAchievements(action);

      for (const achievement of relevantAchievements) {
        const wasUnlocked = await this.updateAchievementProgress(
          user.uid,
          achievement,
          action,
          metadata
        );

        if (wasUnlocked) {
          unlockedAchievements.push(achievement);

          // Show unlock notification
          await showAchievementUnlock(
            achievement.id,
            achievement.title,
            achievement.icon,
            achievement.xpReward
          );

          // Award bonus XP for unlocking achievement
          await this.awardXPInternal(
            user.uid,
            achievement.xpReward,
            "achievement_unlocked",
            { achievementId: achievement.id, tier: achievement.tier }
          );
        }
      }

      return unlockedAchievements;
    } catch (error) {
      console.error(
        "❌ [AchievementManager] Failed to check achievement progress:",
        error
      );
      return [];
    }
  }

  /**
   * Get achievements relevant to a specific action
   */
  private getRelevantAchievements(action: XPActionType): Achievement[] {
    const typeMapping: Record<
      XPActionType,
      Achievement["requirement"]["type"][]
    > = {
      sequence_created: ["sequence_count", "letter_usage", "sequence_length"],
      sequence_published: ["specific_action"],
      concept_learned: ["concept_completion"],
      drill_completed: ["specific_action"],
      daily_login: ["daily_streak"],
      daily_challenge_completed: ["specific_action"],
      achievement_unlocked: [],
      training_session_completed: ["specific_action"],
      perfect_training_run: ["specific_action"],
      training_combo_20: ["specific_action"],
      timed_150bpm: ["specific_action"],
      train_challenge_completed: ["challenge_count", "specific_action"],
      // Weekly challenges and skill progressions
      weekly_challenge_completed: ["specific_action"],
      weekly_challenge_bonus: ["specific_action"],
      skill_level_completed: ["specific_action"],
      skill_mastery_achieved: ["specific_action"],
      // Feedback
      feedback_submitted: ["feedback_count"],
    };

    const relevantTypes = typeMapping[action];

    return ALL_ACHIEVEMENTS.filter((achievement) =>
      relevantTypes.includes(achievement.requirement.type)
    );
  }

  /**
   * Update progress for a specific achievement
   * Returns true if achievement was newly unlocked
   */
  private async updateAchievementProgress(
    userId: string,
    achievement: Achievement,
    action: XPActionType,
    metadata?: XPEventMetadata
  ): Promise<boolean> {
    try {
      const firestore = await getFirestoreInstance();
      const achievementsPath = getUserAchievementsPath(userId);
      const achievementDocRef = doc(
        firestore,
        `${achievementsPath}/${achievement.id}`
      );

      const achievementDoc = await getDoc(achievementDocRef);
      if (!achievementDoc.exists()) {
        console.warn(
          `⚠️ Achievement progress not found: ${achievement.id}, initializing...`
        );
        await this.initializeUserAchievements(userId);
        return false;
      }

      const userAchievement = achievementDoc.data() as UserAchievement;

      // Already completed
      if (userAchievement.isCompleted) {
        return false;
      }

      // Calculate new progress based on achievement type
      const progressDelta = this.calculateProgressDelta(
        achievement,
        action,
        metadata
      );

      if (progressDelta === 0) {
        return false;
      }

      const newProgress = userAchievement.progress + progressDelta;
      const isNowCompleted = newProgress >= achievement.requirement.target;

      // Update Firestore
      if (isNowCompleted) {
        await updateDoc(achievementDocRef, {
          progress: achievement.requirement.target,
          isCompleted: true,
          unlockedAt: serverTimestamp(),
          notificationShown: false,
        });

        // Sync to main user document for leaderboards (denormalized)
        const userDocRef = doc(firestore, `users/${userId}`);
        await updateDoc(userDocRef, {
          achievementCount: increment(1),
        });

        // Update local cache
        await db.userAchievements.put({
          ...userAchievement,
          id: achievement.id,
          progress: achievement.requirement.target,
          isCompleted: true,
          unlockedAt: new Date(),
          notificationShown: false,
        });

        return true;
      } else {
        // Just update progress
        await updateDoc(achievementDocRef, {
          progress: increment(progressDelta),
        });

        // Update local cache
        await db.userAchievements.put({
          ...userAchievement,
          id: achievement.id,
          progress: newProgress,
        });

        return false;
      }
    } catch (error) {
      console.error(
        "❌ [AchievementManager] Failed to update achievement progress:",
        error
      );
      return false;
    }
  }

  /**
   * Calculate progress delta for achievement based on action
   */
  private calculateProgressDelta(
    achievement: Achievement,
    action: XPActionType,
    metadata?: XPEventMetadata
  ): number {
    const req = achievement.requirement;

    switch (req.type) {
      case "sequence_count":
        return action === "sequence_created" ? 1 : 0;

      case "concept_completion":
        return action === "concept_learned" ? 1 : 0;

      case "daily_streak":
        // Handled by StreakTracker, check metadata
        return metadata?.currentStreak === req.target ? req.target : 0;

      case "letter_usage":
        // Check if sequence contains unique letters
        if (action === "sequence_created" && metadata?.letters) {
          const uniqueLetters = new Set(metadata.letters);
          return uniqueLetters.size >= req.target ? 1 : 0;
        }
        return 0;

      case "sequence_length":
        // Check if sequence meets length requirement
        if (action === "sequence_created" && metadata?.stepCount) {
          return metadata.stepCount >= req.target ? 1 : 0;
        }
        return 0;

      case "specific_action":
        // One-time achievements, triggered by specific metadata or matching action
        if (metadata?.achievementId === achievement.id) return 1;
        if (req.metadata?.action && action === req.metadata.action) return 1;
        return 0;

      case "challenge_count": {
        if (action !== "train_challenge_completed") return 0;
        const requiredType = req.metadata?.challengeType;
        if (!requiredType) return 1;
        return metadata?.challengeType === requiredType ? 1 : 0;
      }

      case "feedback_count":
        return action === "feedback_submitted" ? 1 : 0;

      default:
        return 0;
    }
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  async getUserXP(): Promise<UserXP> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    try {
      // Try local cache first
      const localXP = await db.userXP.get("current");
      if (localXP) {
        return localXP;
      }

      // Fall back to Firestore
      const firestore = await getFirestoreInstance();
      const xpDocRef = doc(firestore, getUserXPPath(user.uid));
      const xpDoc = await getDoc(xpDocRef);

      if (!xpDoc.exists()) {
        throw new Error("User XP record not found");
      }

      const firestoreXP = xpDoc.data() as UserXP;

      // Cache it locally
      await db.userXP.put({
        ...firestoreXP,
        lastUpdated:
          firestoreXP.lastUpdated instanceof Timestamp
            ? firestoreXP.lastUpdated.toDate()
            : new Date(firestoreXP.lastUpdated),
      });

      return firestoreXP;
    } catch (error) {
      console.error("❌ [AchievementManager] Failed to get user XP:", error);
      throw error;
    }
  }

  async getAllAchievements(): Promise<
    Array<Achievement & { userProgress: UserAchievement | null }>
  > {
    const user = auth.currentUser;
    if (!user) {
      return ALL_ACHIEVEMENTS.map((a) => ({ ...a, userProgress: null }));
    }

    try {
      const firestore = await getFirestoreInstance();
      const achievementsPath = getUserAchievementsPath(user.uid);
      const achievementsSnapshot = await getDocs(
        collection(firestore, achievementsPath)
      );

      const userProgressMap = new Map<string, UserAchievement>();
      achievementsSnapshot.docs.forEach((doc) => {
        const data = doc.data() as UserAchievement;
        userProgressMap.set(doc.id, { ...data, id: doc.id });
      });

      return ALL_ACHIEVEMENTS.map((achievement) => ({
        ...achievement,
        userProgress: userProgressMap.get(achievement.id) ?? null,
      }));
    } catch (error) {
      console.error(
        "❌ [AchievementManager] Failed to get all achievements:",
        error
      );
      return ALL_ACHIEVEMENTS.map((a) => ({ ...a, userProgress: null }));
    }
  }

  async getAchievementsByCategory(
    category: Achievement["category"]
  ): Promise<Array<Achievement & { userProgress: UserAchievement | null }>> {
    const allAchievements = await this.getAllAchievements();
    return allAchievements.filter((a) => a.category === category);
  }

  async getRecentAchievements(): Promise<UserAchievement[]> {
    const user = auth.currentUser;
    if (!user) return [];

    try {
      const firestore = await getFirestoreInstance();
      const achievementsPath = getUserAchievementsPath(user.uid);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const recentQuery = query(
        collection(firestore, achievementsPath),
        where("isCompleted", "==", true),
        where("unlockedAt", ">=", Timestamp.fromDate(sevenDaysAgo)),
        orderBy("unlockedAt", "desc"),
        limit(10)
      );

      const snapshot = await getDocs(recentQuery);
      return snapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id }) as UserAchievement
      );
    } catch (error) {
      console.error(
        "❌ [AchievementManager] Failed to get recent achievements:",
        error
      );
      return [];
    }
  }

  async getAchievementProgress(
    achievementId: string
  ): Promise<UserAchievement | null> {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      const firestore = await getFirestoreInstance();
      const achievementsPath = getUserAchievementsPath(user.uid);
      const achievementDocRef = doc(
        firestore,
        `${achievementsPath}/${achievementId}`
      );
      const achievementDoc = await getDoc(achievementDocRef);

      if (!achievementDoc.exists()) {
        return null;
      }

      return {
        ...achievementDoc.data(),
        id: achievementDoc.id,
      } as UserAchievement;
    } catch (error) {
      console.error(
        "❌ [AchievementManager] Failed to get achievement progress:",
        error
      );
      return null;
    }
  }

  async getStats(): Promise<{
    totalXP: number;
    currentLevel: number;
    achievementsUnlocked: number;
    totalAchievements: number;
    completionPercentage: number;
  }> {
    const defaultStats = {
      totalXP: 0,
      currentLevel: 1,
      achievementsUnlocked: 0,
      totalAchievements: ALL_ACHIEVEMENTS.length,
      completionPercentage: 0,
    };

    const user = auth.currentUser;
    if (!user) {
      return defaultStats;
    }

    try {
      const xp = await this.getUserXP();
      const achievements = await this.getAllAchievements();

      const unlockedCount = achievements.filter(
        (a) => a.userProgress?.isCompleted
      ).length;

      return {
        totalXP: xp.totalXP,
        currentLevel: xp.currentLevel,
        achievementsUnlocked: unlockedCount,
        totalAchievements: ALL_ACHIEVEMENTS.length,
        completionPercentage: Math.round(
          (unlockedCount / ALL_ACHIEVEMENTS.length) * 100
        ),
      };
    } catch (error) {
      console.error("❌ [AchievementManager] Failed to get stats:", error);
      return defaultStats;
    }
  }
}
