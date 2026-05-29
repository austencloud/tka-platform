/**
 * Daily Challenge Service Implementation
 *
 * Generates and tracks daily challenges with Firebase/Firestore.
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
  serverTimestamp,
} from "firebase/firestore";
import { auth, getFirestoreInstance } from "../../auth/firebase";
import { db } from "../../persistence/database/TKADatabase";
import {
  getDailyChallengesPath,
  getUserChallengeProgressPath,
} from "../data/firestore-collections";
import { toast } from "../../toast/state/toast-state.svelte";
import type {
  DailyChallenge,
  UserChallengeProgress,
  XPEventMetadata,
} from "../domain/models/achievement-models";
import type { AchievementManager } from '$lib/shared/gamification/services/achievement-manager'
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const debug = createComponentLogger("DailyChallengeManager");

export class DailyChallengeManager {
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

    // Generate today's challenge if it doesn't exist
    await this.getTodayChallenge();

    this._initialized = true;
  }

  // ============================================================================
  // CHALLENGE GENERATION
  // ============================================================================

  async getTodayChallenge(): Promise<DailyChallenge | null> {
    const today = new Date().toISOString().split("T")[0];
    const challengeId = `challenge_${today}`;

    // Check local cache first
    const localChallenge = await db.dailyChallenges.get(challengeId);
    if (localChallenge) {
      return localChallenge;
    }

    // Read from Firestore (admin pre-created challenges only)
    try {
      const firestore = await getFirestoreInstance();
      const challengesPath = getDailyChallengesPath();
      const challengeDocRef = doc(
        firestore,
        `${challengesPath}/${challengeId}`
      );
      const challengeDoc = await getDoc(challengeDocRef);

      if (challengeDoc.exists()) {
        const firestoreChallenge = challengeDoc.data() as DailyChallenge;

        // Cache locally
        await db.dailyChallenges.put(firestoreChallenge);

        return firestoreChallenge;
      } else {
        debug.log(
          "No daily challenge found for today. Admin needs to create it."
        );
        return null;
      }
    } catch (error) {
      console.error("❌ Failed to read challenge from Firestore:", error);
      return null;
    }
  }

  // ============================================================================
  // CHALLENGE PROGRESS
  // ============================================================================

  async getChallengeProgress(): Promise<UserChallengeProgress | null> {
    const user = auth.currentUser;
    if (!user) return null;

    const challenge = await this.getTodayChallenge();

    if (!challenge) return null;

    try {
      const firestore = await getFirestoreInstance();
      const progressPath = getUserChallengeProgressPath(user.uid);
      const progressDocRef = doc(firestore, `${progressPath}/${challenge.id}`);
      const progressDoc = await getDoc(progressDocRef);

      if (!progressDoc.exists()) {
        // Initialize progress
        const initialProgress: UserChallengeProgress = {
          id: challenge.id,
          challengeId: challenge.id,
          userId: user.uid,
          progress: 0,
          isCompleted: false,
          startedAt: new Date(),
        };

        await setDoc(progressDocRef, {
          ...initialProgress,
          startedAt: serverTimestamp(),
        });

        // Cache locally
        await db.userChallengeProgress.put(initialProgress);

        return initialProgress;
      }

      return progressDoc.data() as UserChallengeProgress;
    } catch (error) {
      console.error(
        "[DailyChallengeManager] Failed to get challenge progress:",
        error
      );
      toast.error("Failed to load challenge progress.");
      return null;
    }
  }

  async updateChallengeProgress(
    progressDelta: number,
    _metadata?: XPEventMetadata
  ): Promise<{
    completed: boolean;
    progress: UserChallengeProgress;
  }> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    const challenge = await this.getTodayChallenge();
    if (!challenge) {
      throw new Error("No daily challenge available");
    }

    const currentProgress = await this.getChallengeProgress();

    if (!currentProgress) {
      throw new Error("Challenge progress not found");
    }

    // Already completed
    if (currentProgress.isCompleted) {
      return { completed: false, progress: currentProgress };
    }

    const newProgress = currentProgress.progress + progressDelta;
    const isNowCompleted = newProgress >= challenge.requirement.target;

    try {
      const firestore = await getFirestoreInstance();
      const progressPath = getUserChallengeProgressPath(user.uid);
      const progressDocRef = doc(firestore, `${progressPath}/${challenge.id}`);

      if (isNowCompleted) {
        // Mark as completed
        const updatedProgress: UserChallengeProgress = {
          ...currentProgress,
          progress: challenge.requirement.target,
          isCompleted: true,
          completedAt: new Date(),
        };

        await updateDoc(progressDocRef, {
          progress: challenge.requirement.target,
          isCompleted: true,
          completedAt: serverTimestamp(),
        });

        // Cache locally
        await db.userChallengeProgress.put(updatedProgress);

        // Award XP via AchievementManager
        if (this._achievementService) {
          await this._achievementService.trackAction(
            "daily_challenge_completed",
            {
              challengeId: challenge.id,
              challengeType: challenge.type,
            }
          );
        }

        return { completed: true, progress: updatedProgress };
      } else {
        // Update progress
        const updatedProgress: UserChallengeProgress = {
          ...currentProgress,
          progress: newProgress,
        };

        await updateDoc(progressDocRef, {
          progress: newProgress,
        });

        // Cache locally
        await db.userChallengeProgress.put(updatedProgress);

        return { completed: false, progress: updatedProgress };
      }
    } catch (error) {
      console.error(
        "[DailyChallengeManager] Failed to update challenge progress:",
        error
      );
      toast.error("Failed to update challenge progress.");
      throw error;
    }
  }

  async completeChallenge(): Promise<{
    xpAwarded: number;
    challenge: DailyChallenge;
  }> {
    const challenge = await this.getTodayChallenge();

    if (!challenge) {
      throw new Error("No daily challenge available");
    }

    await this.updateChallengeProgress(challenge.requirement.target, {
      manualCompletion: true,
    });

    return {
      xpAwarded: challenge.xpReward,
      challenge,
    };
  }

  async isTodayChallengeComplete(): Promise<boolean> {
    const progress = await this.getChallengeProgress();
    return progress?.isCompleted ?? false;
  }

  // ============================================================================
  // CHALLENGE HISTORY
  // ============================================================================

  async getChallengeHistory(days: number = 7): Promise<
    Array<{
      challenge: DailyChallenge;
      progress: UserChallengeProgress | null;
    }>
  > {
    const user = auth.currentUser;
    if (!user) return [];

    const history: Array<{
      challenge: DailyChallenge;
      progress: UserChallengeProgress | null;
    }> = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const challengeId = `challenge_${dateStr}`;

      // Get challenge
      const challengeDoc = await db.dailyChallenges.get(challengeId);
      if (!challengeDoc) continue;

      // Get progress
      const progressDoc = await db.userChallengeProgress.get(challengeId);

      history.push({
        challenge: challengeDoc,
        progress: progressDoc ?? null,
      });
    }

    return history;
  }

  async getChallengeStats(): Promise<{
    totalChallengesCompleted: number;
    currentStreak: number;
    longestStreak: number;
  }> {
    const user = auth.currentUser;
    if (!user) {
      return {
        totalChallengesCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }

    try {
      const firestore = await getFirestoreInstance();
      const progressPath = getUserChallengeProgressPath(user.uid);
      const completedQuery = query(
        collection(firestore, progressPath),
        where("isCompleted", "==", true)
      );

      const snapshot = await getDocs(completedQuery);
      const totalChallengesCompleted = snapshot.size;

      // Calculate streaks (simplified - could be more sophisticated)
      const completedDates = snapshot.docs
        .map((doc) => doc.id.replace("challenge_", ""))
        .sort()
        .reverse();

      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;

      const checkDate = new Date();

      // Calculate current streak
      for (let i = 0; i < 100; i++) {
        const dateStr = checkDate.toISOString().split("T")[0]!;
        if (completedDates.includes(dateStr)) {
          currentStreak++;
          tempStreak++;
        } else {
          if (i === 0) {
            // Today not completed yet, check yesterday
            currentStreak = 0;
          } else {
            break;
          }
        }
        checkDate.setDate(checkDate.getDate() - 1);
      }

      // Longest streak would require full history scan
      longestStreak = Math.max(currentStreak, tempStreak);

      return {
        totalChallengesCompleted,
        currentStreak,
        longestStreak,
      };
    } catch (error) {
      console.error(
        "[DailyChallengeManager] Failed to get challenge stats:",
        error
      );
      toast.error("Failed to load challenge statistics.");
      return {
        totalChallengesCompleted: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
    }
  }
}
