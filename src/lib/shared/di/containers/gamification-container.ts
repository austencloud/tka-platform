/**
 * Gamification ITI Container
 *
 * Provides all gamification services including achievements, challenges,
 * streaks, and skill progression tracking.
 *
 * Dependency graph:
 * - GamificationNotifier, StreakTracker: no dependencies
 * - AchievementManager: depends on GamificationNotifier
 * - DailyChallengeManager, WeeklyChallengeManager, SkillProgressionTracker: depend on AchievementManager
 * - ChallengeCoordinator: depends on all challenge services
 */

import { createContainer } from "iti";
import { GamificationNotifier } from "$lib/shared/gamification/services/implementations/GamificationNotifier";
import { StreakTracker } from "$lib/shared/gamification/services/implementations/StreakTracker";
import { AchievementManager } from "$lib/shared/gamification/services/implementations/AchievementManager";
import { DailyChallengeManager } from "$lib/shared/gamification/services/implementations/DailyChallengeManager";
import { WeeklyChallengeManager } from "$lib/shared/gamification/services/implementations/WeeklyChallengeManager";
import { SkillProgressionTracker } from "$lib/shared/gamification/services/implementations/SkillProgressionTracker";
import { ChallengeCoordinator } from "$lib/shared/gamification/services/implementations/ChallengeCoordinator";

/**
 * Creates the gamification container.
 * Services are added in dependency order using chained .add() calls.
 */
export function createGamificationContainer() {
  return (
    createContainer()
      // Layer 1: No dependencies
      .add({
        gamificationNotifier: () => new GamificationNotifier(),
        streakTracker: () => new StreakTracker(),
      })
      // Layer 2: Depends on GamificationNotifier
      .add((ctx) => ({
        achievementManager: () =>
          new AchievementManager(ctx.gamificationNotifier),
      }))
      // Layer 3: Depends on AchievementManager
      .add((ctx) => ({
        dailyChallengeManager: () =>
          new DailyChallengeManager(ctx.achievementManager),
        weeklyChallengeManager: () =>
          new WeeklyChallengeManager(ctx.achievementManager),
        skillProgressionTracker: () =>
          new SkillProgressionTracker(ctx.achievementManager),
      }))
      // Layer 4: Depends on all challenge services
      .add((ctx) => ({
        challengeCoordinator: () =>
          new ChallengeCoordinator(
            ctx.dailyChallengeManager,
            ctx.weeklyChallengeManager,
            ctx.skillProgressionTracker,
            ctx.achievementManager,
            ctx.streakTracker
          ),
      }))
  );
}

export type GamificationContainer = ReturnType<typeof createGamificationContainer>;
