/**
 * Streak Service Implementation
 *
 * Tracks daily login/activity streaks with Firebase/Firestore.
 */

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, getFirestoreInstance } from "../../auth/firebase";
import { db } from "../../persistence/database/tka-database";
import { getUserStreakPath } from "../data/firestore-collections";
import { toast } from "../../toast/state/toast-state.svelte";
import type { UserStreak } from "../domain/models/achievement-models";

export class StreakTracker {
  private _initialized = false;

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

    // Initialize user streak record if it doesn't exist
    await this.initializeUserStreak(user.uid);

    this._initialized = true;
  }

  /**
   * Initialize user streak document in Firestore if it doesn't exist
   */
  private async initializeUserStreak(userId: string): Promise<void> {
    try {
      const firestore = await getFirestoreInstance();
      const streakDocRef = doc(firestore, getUserStreakPath(userId));
      const streakDoc = await getDoc(streakDocRef);

      if (!streakDoc.exists()) {
        const today = new Date().toISOString().split("T")[0]!;
        const initialStreak: UserStreak = {
          id: "current",
          userId,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: today,
          streakStartDate: today,
        };

        await setDoc(streakDocRef, initialStreak);

        // Cache locally
        await db.userStreaks.add(initialStreak);

      } else {
        // Cache existing Firestore data locally
        const firestoreStreak = streakDoc.data() as UserStreak;
        await db.userStreaks.put(firestoreStreak);
      }
    } catch (error) {
      console.error("[StreakTracker] Failed to initialize user streak:", error);
      toast.error("Failed to initialize streak tracking.");
      throw error;
    }
  }

  // ============================================================================
  // STREAK TRACKING
  // ============================================================================

  async recordDailyActivity(): Promise<{
    streakIncremented: boolean;
    currentStreak: number;
    isNewRecord: boolean;
  }> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    try {
      const today = new Date().toISOString().split("T")[0]!;

      // Get current streak
      const firestore = await getFirestoreInstance();
      const streakDocRef = doc(firestore, getUserStreakPath(user.uid));
      const streakDoc = await getDoc(streakDocRef);

      if (!streakDoc.exists()) {
        await this.initializeUserStreak(user.uid);
        return {
          streakIncremented: false,
          currentStreak: 0,
          isNewRecord: false,
        };
      }

      const currentData = streakDoc.data() as UserStreak;

      // Already checked in today
      if (currentData.lastActivityDate === today) {
        return {
          streakIncremented: false,
          currentStreak: currentData.currentStreak,
          isNewRecord: false,
        };
      }

      // Calculate days difference
      const lastDate = new Date(currentData.lastActivityDate);
      const todayDate = new Date(today);
      const daysDiff = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let newStreak: number;
      let streakStartDate: string;

      if (daysDiff === 1) {
        // Consecutive day - increment streak
        newStreak = currentData.currentStreak + 1;
        streakStartDate = currentData.streakStartDate;
      } else if (daysDiff > 1) {
        // Streak broken - reset to 1
        newStreak = 1;
        streakStartDate = today;
      } else {
        // Same day (shouldn't happen due to check above)
        newStreak = currentData.currentStreak;
        streakStartDate = currentData.streakStartDate;
      }

      const newLongestStreak = Math.max(newStreak, currentData.longestStreak);
      const isNewRecord = newStreak > currentData.longestStreak;

      // Update Firestore subcollection
      await updateDoc(streakDocRef, {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastActivityDate: today,
        streakStartDate,
      });

      // Sync to main user document for leaderboards (denormalized)
      const userDocRef = doc(firestore, `users/${user.uid}`);
      await updateDoc(userDocRef, {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
      });

      // Update local cache
      await db.userStreaks.put({
        id: "current",
        userId: user.uid,
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastActivityDate: today,
        streakStartDate,
      });

      return {
        streakIncremented: daysDiff === 1,
        currentStreak: newStreak,
        isNewRecord,
      };
    } catch (error) {
      console.error("[StreakTracker] Failed to record daily activity:", error);
      toast.error("Failed to update streak. Please try again.");
      throw error;
    }
  }

  async getCurrentStreak(): Promise<UserStreak> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    try {
      // Try local cache first
      const localStreak = await db.userStreaks.get("current");
      if (localStreak) {
        return localStreak;
      }

      // Fall back to Firestore
      const firestore = await getFirestoreInstance();
      const streakDocRef = doc(firestore, getUserStreakPath(user.uid));
      const streakDoc = await getDoc(streakDocRef);

      if (!streakDoc.exists()) {
        throw new Error("User streak record not found");
      }

      const firestoreStreak = streakDoc.data() as UserStreak;

      // Cache it locally
      await db.userStreaks.put(firestoreStreak);

      return firestoreStreak;
    } catch (error) {
      console.error("[StreakTracker] Failed to get current streak:", error);
      toast.error("Failed to load streak data.");
      throw error;
    }
  }

  async hasCheckedInToday(): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;

    const today = new Date().toISOString().split("T")[0]!;
    const streak = await this.getCurrentStreak();

    return streak.lastActivityDate === today;
  }

  async getStreakStats(): Promise<{
    currentStreak: number;
    longestStreak: number;
    totalDaysActive: number;
    lastActivityDate: string;
  }> {
    const user = auth.currentUser;
    if (!user) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalDaysActive: 0,
        lastActivityDate: new Date().toISOString().split("T")[0]!,
      };
    }

    const streak = await this.getCurrentStreak();

    // Calculate total days active (current streak + any historical activity)
    // For now, just use current streak as approximation
    const totalDaysActive = streak.currentStreak;

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      totalDaysActive,
      lastActivityDate: streak.lastActivityDate,
    };
  }

  async checkStreakStatus(): Promise<{
    isActive: boolean;
    daysSinceLastActivity: number;
  }> {
    const user = auth.currentUser;
    if (!user) {
      return { isActive: false, daysSinceLastActivity: 0 };
    }

    const today = new Date().toISOString().split("T")[0]!;
    const streak = await this.getCurrentStreak();

    const lastDate = new Date(streak.lastActivityDate);
    const todayDate = new Date(today);
    const daysDiff = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isActive = daysDiff <= 1; // Active if checked in today or yesterday

    return {
      isActive,
      daysSinceLastActivity: daysDiff,
    };
  }
}
