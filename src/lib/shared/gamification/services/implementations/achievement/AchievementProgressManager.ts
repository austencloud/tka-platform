/**
 * Achievement Progress Manager
 *
 * Handles achievement progress tracking and unlock logic.
 * Single Responsibility: Achievement progress business logic
 */

import {
  doc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "../../../../auth/firebase";
import { db } from "../../../../persistence/database/TKADatabase";
import { getUserAchievementsPath } from "../../../data/firestore-collections";
import { ALL_ACHIEVEMENTS } from "../../../domain/constants/achievement-definitions";
import type {
  Achievement,
  UserAchievement,
  XPActionType,
  XPEventMetadata,
} from "../../../domain/models/achievement-models";

export class AchievementProgressManager {
  /**
   * Get achievements relevant to a specific action
   */
  getRelevantAchievements(action: XPActionType): Achievement[] {
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
   * Calculate progress delta for achievement based on action
   */
  calculateProgressDelta(
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
        // One-time achievements, triggered by specific metadata or action
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

  /**
   * Update progress for a specific achievement
   * Returns true if achievement was newly unlocked
   */
  async updateAchievementProgress(
    userId: string,
    achievement: Achievement,
    action: XPActionType,
    metadata?: XPEventMetadata
  ): Promise<boolean> {
    const firestore = await getFirestoreInstance();
    const achievementsPath = getUserAchievementsPath(userId);
    const achievementDocRef = doc(
      firestore,
      `${achievementsPath}/${achievement.id}`
    );

    const achievementDoc = await getDoc(achievementDocRef);
    if (!achievementDoc.exists()) {
      console.warn(`⚠️ Achievement progress not found: ${achievement.id}`);
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
  }
}
