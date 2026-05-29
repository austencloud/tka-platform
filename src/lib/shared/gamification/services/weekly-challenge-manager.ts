/**
 * Weekly Challenge Service Implementation
 *
 * Manages weekly challenges with Firebase/Firestore.
 * Weekly challenges span Monday-Sunday and offer larger rewards than daily challenges.
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
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "../../auth/firebase";
import { db } from "../../persistence/database/TKADatabase";
import {
  getWeeklyChallengesPath,
  getUserWeeklyProgressPath,
} from "../data/firestore-collections";
import { toast } from "../../toast/state/toast-state.svelte";
import type {
  WeeklyChallenge,
  UserWeeklyChallengeProgress,
} from "../domain/models/challenge-models";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const debug = createComponentLogger("WeeklyChallengeManager");
import {
  getWeeklyChallengeId,
  getCurrentWeekNumber,
} from "../domain/models/challenge-models";
import type { AchievementManager } from '$lib/shared/gamification/services/achievement-manager'

export class WeeklyChallengeManager {
  private _initialized = false;
  private _achievementService: AchievementManager | null = null;

  constructor(achievementService: AchievementManager) {
    this._achievementService = achievementService;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      return;
    }

    // Load current week's challenge
    await this.getCurrentWeekChallenge();

    this._initialized = true;
  }

  // ============================================================================
  // CHALLENGE RETRIEVAL
  // ============================================================================

  async getCurrentWeekChallenge(): Promise<WeeklyChallenge | null> {
    const { year, weekNumber } = getCurrentWeekNumber();
    return this.getWeekChallenge(year, weekNumber);
  }

  async getWeekChallenge(
    year: number,
    weekNumber: number
  ): Promise<WeeklyChallenge | null> {
    const challengeId = getWeeklyChallengeId(year, weekNumber);

    // Check local cache first
    const localChallenge = await db.weeklyChallenges.get(challengeId);
    if (localChallenge) {
      return localChallenge;
    }

    // Read from Firestore
    try {
      const firestore = await getFirestoreInstance();
      const challengesPath = getWeeklyChallengesPath();
      const challengeDocRef = doc(
        firestore,
        `${challengesPath}/${challengeId}`
      );
      const challengeDoc = await getDoc(challengeDocRef);

      if (challengeDoc.exists()) {
        const firestoreChallenge = challengeDoc.data() as WeeklyChallenge;

        // Cache locally
        await db.weeklyChallenges.put(firestoreChallenge);

        return firestoreChallenge;
      } else {
        debug.log(
          `No weekly challenge found for week ${weekNumber}/${year}. Admin needs to create it.`
        );
        return null;
      }
    } catch (error) {
      console.error(
        "❌ Failed to read weekly challenge from Firestore:",
        error
      );
      return null;
    }
  }

  // ============================================================================
  // PROGRESS TRACKING
  // ============================================================================

  async getWeeklyProgress(): Promise<UserWeeklyChallengeProgress | null> {
    const user = auth.currentUser;
    if (!user) return null;

    const challenge = await this.getCurrentWeekChallenge();
    if (!challenge) return null;

    try {
      const firestore = await getFirestoreInstance();
      const progressPath = getUserWeeklyProgressPath(user.uid);
      const progressDocRef = doc(firestore, `${progressPath}/${challenge.id}`);
      const progressDoc = await getDoc(progressDocRef);

      if (!progressDoc.exists()) {
        // Initialize progress
        const { year, weekNumber } = getCurrentWeekNumber();
        const initialProgress: UserWeeklyChallengeProgress = {
          id: challenge.id,
          challengeId: challenge.id,
          userId: user.uid,
          weekNumber,
          year,
          progress: 0,
          isCompleted: false,
          startedAt: new Date(),
          bonusEarned: false,
        };

        await setDoc(progressDocRef, {
          ...initialProgress,
          startedAt: serverTimestamp(),
        });

        // Cache locally
        await db.userWeeklyProgress.put(initialProgress);

        return initialProgress;
      }

      const data = progressDoc.data() as Record<string, unknown>;
      const startedAt = data["startedAt"] as
        | { toDate?: () => Date }
        | undefined;
      const completedAt = data["completedAt"] as
        | { toDate?: () => Date }
        | undefined;
      return {
        ...data,
        startedAt: startedAt?.toDate?.() || new Date(),
        completedAt: completedAt?.toDate?.(),
      } as UserWeeklyChallengeProgress;
    } catch (error) {
      console.error(
        "[WeeklyChallengeManager] Failed to get weekly progress:",
        error
      );
      toast.error("Failed to load weekly challenge progress.");
      return null;
    }
  }

  async updateWeeklyProgress(progressDelta: number, _metadata?: unknown): Promise<{
    completed: boolean;
    progress: UserWeeklyChallengeProgress;
    bonusEarned: boolean;
  }> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    const challenge = await this.getCurrentWeekChallenge();
    if (!challenge) {
      throw new Error("No weekly challenge available");
    }

    const currentProgress = await this.getWeeklyProgress();
    if (!currentProgress) {
      throw new Error("Weekly progress not found");
    }

    // Already completed
    if (currentProgress.isCompleted) {
      return {
        completed: false,
        progress: currentProgress,
        bonusEarned: currentProgress.bonusEarned,
      };
    }

    const newProgress = currentProgress.progress + progressDelta;
    const isNowCompleted = newProgress >= challenge.requirement.target;

    // Check if bonus should be earned
    let bonusEarned = false;
    if (isNowCompleted && challenge.bonusDeadline) {
      bonusEarned = new Date() < new Date(challenge.bonusDeadline);
    }

    try {
      const firestore = await getFirestoreInstance();
      const progressPath = getUserWeeklyProgressPath(user.uid);
      const progressDocRef = doc(firestore, `${progressPath}/${challenge.id}`);

      if (isNowCompleted) {
        // Mark as completed
        const updatedProgress: UserWeeklyChallengeProgress = {
          ...currentProgress,
          progress: challenge.requirement.target,
          isCompleted: true,
          completedAt: new Date(),
          bonusEarned,
        };

        await updateDoc(progressDocRef, {
          progress: challenge.requirement.target,
          isCompleted: true,
          completedAt: serverTimestamp(),
          bonusEarned,
        });

        // Cache locally
        await db.userWeeklyProgress.put(updatedProgress);

        // Award XP via AchievementManager
        if (this._achievementService) {
          await this._achievementService.trackAction(
            "weekly_challenge_completed",
            {
              challengeId: challenge.id,
              weekNumber: challenge.weekNumber,
              year: challenge.year,
              bonusEarned,
            }
          );

          // Award bonus XP if earned
          if (bonusEarned) {
            await this._achievementService.trackAction(
              "weekly_challenge_bonus",
              {
                challengeId: challenge.id,
                weekNumber: challenge.weekNumber,
                year: challenge.year,
              }
            );
          }
        }

        return { completed: true, progress: updatedProgress, bonusEarned };
      } else {
        // Update progress
        const updatedProgress: UserWeeklyChallengeProgress = {
          ...currentProgress,
          progress: newProgress,
        };

        await updateDoc(progressDocRef, {
          progress: newProgress,
        });

        // Cache locally
        await db.userWeeklyProgress.put(updatedProgress);

        return {
          completed: false,
          progress: updatedProgress,
          bonusEarned: false,
        };
      }
    } catch (error) {
      console.error(
        "[WeeklyChallengeManager] Failed to update weekly progress:",
        error
      );
      toast.error("Failed to update weekly challenge progress.");
      throw error;
    }
  }

  async completeWeeklyChallenge(): Promise<{
    xpAwarded: number;
    bonusXP: number;
    challenge: WeeklyChallenge;
  }> {
    const challenge = await this.getCurrentWeekChallenge();
    if (!challenge) {
      throw new Error("No weekly challenge available");
    }

    const result = await this.updateWeeklyProgress(
      challenge.requirement.target
    );

    const bonusXP = result.bonusEarned
      ? Math.floor(challenge.xpReward * (challenge.bonusMultiplier || 0.5))
      : 0;

    return {
      xpAwarded: challenge.xpReward,
      bonusXP,
      challenge,
    };
  }

  async isCurrentWeekChallengeComplete(): Promise<boolean> {
    const progress = await this.getWeeklyProgress();
    return progress?.isCompleted ?? false;
  }

  async isBonusDeadlinePassed(): Promise<boolean> {
    const challenge = await this.getCurrentWeekChallenge();
    if (!challenge?.bonusDeadline) {
      return true; // No bonus deadline means it's "passed"
    }
    return new Date() > new Date(challenge.bonusDeadline);
  }

  // ============================================================================
  // CHALLENGE HISTORY
  // ============================================================================

  async getWeeklyChallengeHistory(weeks: number = 8): Promise<
    Array<{
      challenge: WeeklyChallenge;
      progress: UserWeeklyChallengeProgress | null;
    }>
  > {
    const user = auth.currentUser;
    if (!user) return [];

    const history: Array<{
      challenge: WeeklyChallenge;
      progress: UserWeeklyChallengeProgress | null;
    }> = [];

    const { year, weekNumber } = getCurrentWeekNumber();

    for (let i = 0; i < weeks; i++) {
      let targetWeek = weekNumber - i;
      let targetYear = year;

      // Handle year rollover
      while (targetWeek <= 0) {
        targetYear--;
        targetWeek += 52; // Approximate
      }

      const challengeId = getWeeklyChallengeId(targetYear, targetWeek);

      // Get challenge
      const challenge = await this.getWeekChallenge(targetYear, targetWeek);
      if (!challenge) continue;

      // Get progress from local cache
      const progress = await db.userWeeklyProgress.get(challengeId);

      history.push({
        challenge,
        progress: progress ?? null,
      });
    }

    return history;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  async getWeeklyStats(): Promise<{
    totalWeeklyChallengesCompleted: number;
    currentWeeklyStreak: number;
    longestWeeklyStreak: number;
    totalBonusesEarned: number;
  }> {
    const user = auth.currentUser;
    if (!user) {
      return {
        totalWeeklyChallengesCompleted: 0,
        currentWeeklyStreak: 0,
        longestWeeklyStreak: 0,
        totalBonusesEarned: 0,
      };
    }

    try {
      const firestore = await getFirestoreInstance();
      const progressPath = getUserWeeklyProgressPath(user.uid);
      const completedQuery = query(
        collection(firestore, progressPath),
        where("isCompleted", "==", true),
        orderBy("year", "desc"),
        orderBy("weekNumber", "desc")
      );

      const snapshot = await getDocs(completedQuery);
      const totalWeeklyChallengesCompleted = snapshot.size;

      // Count bonuses earned
      let totalBonusesEarned = 0;
      const completedWeeks: Array<{ year: number; weekNumber: number }> = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as Record<string, unknown>;
        if (data["bonusEarned"]) {
          totalBonusesEarned++;
        }
        completedWeeks.push({
          year: data["year"] as number,
          weekNumber: data["weekNumber"] as number,
        });
      });

      // Calculate streaks
      let currentWeeklyStreak = 0;
      let longestWeeklyStreak = 0;
      let tempStreak = 0;

      const { year, weekNumber } = getCurrentWeekNumber();
      let checkYear = year;
      let checkWeek = weekNumber;

      // Calculate current streak
      for (let i = 0; i < 100; i++) {
        const found = completedWeeks.some(
          (w) => w.year === checkYear && w.weekNumber === checkWeek
        );

        if (found) {
          currentWeeklyStreak++;
          tempStreak++;
        } else {
          if (i === 0) {
            // Current week not completed yet, check previous
            currentWeeklyStreak = 0;
          } else {
            break;
          }
        }

        // Move to previous week
        checkWeek--;
        if (checkWeek <= 0) {
          checkYear--;
          checkWeek = 52;
        }
      }

      longestWeeklyStreak = Math.max(currentWeeklyStreak, tempStreak);

      return {
        totalWeeklyChallengesCompleted,
        currentWeeklyStreak,
        longestWeeklyStreak,
        totalBonusesEarned,
      };
    } catch (error) {
      console.error(
        "[WeeklyChallengeManager] Failed to get weekly stats:",
        error
      );
      toast.error("Failed to load weekly challenge statistics.");
      return {
        totalWeeklyChallengesCompleted: 0,
        currentWeeklyStreak: 0,
        longestWeeklyStreak: 0,
        totalBonusesEarned: 0,
      };
    }
  }

  // ============================================================================
  // TIME REMAINING
  // ============================================================================

  async getTimeRemaining(): Promise<{
    days: number;
    hours: number;
    minutes: number;
    totalMilliseconds: number;
  } | null> {
    const challenge = await this.getCurrentWeekChallenge();
    if (!challenge) return null;

    const now = new Date();
    const endDate = new Date(challenge.endDate);
    const totalMilliseconds = endDate.getTime() - now.getTime();

    if (totalMilliseconds <= 0) return null;

    const days = Math.floor(totalMilliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (totalMilliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor(
      (totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60)
    );

    return { days, hours, minutes, totalMilliseconds };
  }

  async getBonusTimeRemaining(): Promise<{
    days: number;
    hours: number;
    minutes: number;
    totalMilliseconds: number;
  } | null> {
    const challenge = await this.getCurrentWeekChallenge();
    if (!challenge?.bonusDeadline) return null;

    const now = new Date();
    const bonusDeadline = new Date(challenge.bonusDeadline);
    const totalMilliseconds = bonusDeadline.getTime() - now.getTime();

    if (totalMilliseconds <= 0) return null;

    const days = Math.floor(totalMilliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (totalMilliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor(
      (totalMilliseconds % (1000 * 60 * 60)) / (1000 * 60)
    );

    return { days, hours, minutes, totalMilliseconds };
  }
}
