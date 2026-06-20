/**
 * Gamification Initialization Helper
 *
 * Call this once on app startup to initialize all gamification services.
 */

import { getAchievementManager } from "../get-achievement-manager";
import { getDailyChallengeManager } from "../get-daily-challenge-manager";
import { getStreakTracker } from "../get-streak-tracker";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import type { XPEventMetadata } from "../domain/models/achievement-models";

// ITI containers are loaded synchronously, no need for async loading

export async function initializeGamification(): Promise<void> {
  try {
    // CRITICAL: Initialize Firestore before any services try to use it
    // This prevents race condition errors with the lazy-loaded Firestore Proxy
    const { getFirestoreInstance } = await import("../../auth/firebase");
    await getFirestoreInstance();

    // Resolve services from ITI container
    const achievementService = getAchievementManager();
    const challengeService = getDailyChallengeManager();
    const streakService = getStreakTracker();

    // Initialize in parallel
    await Promise.all([
      achievementService.initialize(),
      challengeService.initialize(),
      streakService.initialize(),
    ]);

    // Only record daily activity if user is logged in
    const { auth } = await import("../../auth/firebase");
    const user = auth.currentUser;

    if (user) {
      // Record daily activity (for streak tracking)
      const streakResult = await streakService.recordDailyActivity();

      if (streakResult.streakIncremented) {
        // Award daily login XP
        await achievementService.trackAction("daily_login");

        // Check for streak milestone achievements
        if (
          streakResult.currentStreak === 3 ||
          streakResult.currentStreak === 7 ||
          streakResult.currentStreak === 30 ||
          streakResult.currentStreak === 100
        ) {
          await achievementService.trackAction("daily_login", {
            currentStreak: streakResult.currentStreak,
          });
        }
      }
    }
  } catch (error) {
    console.error("❌ Failed to initialize gamification:", error);
    // Surface a non-blocking error so a silent gamification failure is at least
    // observable to the user. Still don't throw — the app must continue running
    // even when XP/streaks/achievements can't initialize.
    toast.error("Couldn't load XP and achievements. Some progress may not be tracked.");
  }
}

/**
 * Track XP helper function
 * Use this throughout your app to track user actions
 */
export async function trackXP(
  action:
    | "sequence_created"
    | "concept_learned"
    | "drill_completed"
    | "daily_login"
    | "daily_challenge_completed"
    | "feedback_submitted",
  metadata?: XPEventMetadata
): Promise<void> {
  try {
    // CRITICAL: Ensure Firestore is initialized
    const { getFirestoreInstance } = await import("../../auth/firebase");
    await getFirestoreInstance();

    const achievementService = getAchievementManager();
    await achievementService.trackAction(action, metadata);
  } catch (error) {
    console.error("Failed to track XP:", error);
    // Surface a non-blocking error so the user knows this action's XP wasn't
    // recorded. Still don't throw — the caller's primary action must succeed
    // regardless of whether XP tracking does.
    toast.error("Couldn't record XP for that action.");
  }
}
