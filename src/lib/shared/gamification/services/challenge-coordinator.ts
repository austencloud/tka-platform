/**
 * Challenge Coordinator Implementation
 *
 * Provides a unified facade for managing all challenge types.
 * Coordinates Daily Challenges, Weekly Challenges, and Skill Progressions.
 */

import type {
  DailyChallenge,
  UserChallengeProgress,
  XPActionType,
  XPEventMetadata,
} from "../domain/models/achievement-models";
import type {
  WeeklyChallenge,
  UserWeeklyChallengeProgress,
  SkillProgression,
  UserSkillProgress,
  SkillCategory,
  ChallengeDashboard,
  LeaderboardCategory,
  LeaderboardTimeframe,
  LeaderboardData,
} from "../domain/models/challenge-models";
import type { DailyChallengeManager } from "./daily-challenge-manager";
import type { WeeklyChallengeManager } from "./weekly-challenge-manager";
import type { SkillProgressionTracker } from "./skill-progression-tracker";
import type { AchievementManager } from '$lib/shared/gamification/services/achievement-manager'
import type { StreakTracker } from '$lib/shared/gamification/services/streak-tracker'
import type { SkillProgressActionType } from "./types";

export class ChallengeCoordinator {
  private _initialized = false;

  constructor(
    private _dailyChallengeService: DailyChallengeManager,
    private _weeklyChallengeService: WeeklyChallengeManager,
    private _skillProgressionService: SkillProgressionTracker,
    private _achievementService: AchievementManager,
    private _streakService: StreakTracker
  ) {}

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize(): Promise<void> {
    if (this._initialized) return;

    // Initialize all services in parallel
    await Promise.all([
      this._dailyChallengeService.initialize(),
      this._weeklyChallengeService.initialize(),
      this._skillProgressionService.initialize(),
      this._streakService.initialize(),
    ]);

    this._initialized = true;
  }

  // ============================================================================
  // UNIFIED DASHBOARD
  // ============================================================================

  async getDashboard(): Promise<ChallengeDashboard> {
    const [
      todayChallenge,
      todayProgress,
      weekChallenge,
      weekProgress,
      skillsInProgress,
      skillProgress,
      recentSkills,
      streakStats,
      challengeStats,
      weeklyStats,
      skillStats,
    ] = await Promise.all([
      this._dailyChallengeService.getTodayChallenge(),
      this._dailyChallengeService.getChallengeProgress(),
      this._weeklyChallengeService.getCurrentWeekChallenge(),
      this._weeklyChallengeService.getWeeklyProgress(),
      this._skillProgressionService.getSkillsInProgress(),
      this._skillProgressionService.getAllUserProgress(),
      this._skillProgressionService.getRecentCompletions(),
      this._streakService.getStreakStats(),
      this._dailyChallengeService.getChallengeStats(),
      this._weeklyChallengeService.getWeeklyStats(),
      this._skillProgressionService.getStats(),
    ]);

    // Get recently completed skills
    const recentlyCompletedSkills = recentSkills.map((r) => r.skill);

    return {
      daily: {
        challenge: todayChallenge,
        progress: todayProgress,
      },
      weekly: {
        challenge: weekChallenge,
        progress: weekProgress,
      },
      skills: {
        inProgressSkills: skillsInProgress.map((s) => s.skill),
        userProgress: skillProgress,
        recentlyCompleted: recentlyCompletedSkills,
      },
      stats: {
        dailyStreak: streakStats.currentStreak,
        weeklyStreak: weeklyStats.currentWeeklyStreak,
        totalChallengesCompleted:
          challengeStats.totalChallengesCompleted +
          weeklyStats.totalWeeklyChallengesCompleted,
        totalSkillLevels: skillStats.totalLevelsCompleted,
        totalSkillsCompleted: skillStats.skillsMastered,
      },
    };
  }

  async getQuickStats(): Promise<{
    dailyProgress: { current: number; target: number; isComplete: boolean };
    weeklyProgress: { current: number; target: number; isComplete: boolean };
    currentStreak: number;
    totalXP: number;
    currentLevel: number;
  }> {
    const [
      todayChallenge,
      todayProgress,
      weekChallenge,
      weekProgress,
      streak,
      xp,
    ] = await Promise.all([
      this._dailyChallengeService.getTodayChallenge(),
      this._dailyChallengeService.getChallengeProgress(),
      this._weeklyChallengeService.getCurrentWeekChallenge(),
      this._weeklyChallengeService.getWeeklyProgress(),
      this._streakService.getCurrentStreak(),
      this._achievementService.getUserXP(),
    ]);

    return {
      dailyProgress: {
        current: todayProgress?.progress ?? 0,
        target: todayChallenge?.requirement.target ?? 1,
        isComplete: todayProgress?.isCompleted ?? false,
      },
      weeklyProgress: {
        current: weekProgress?.progress ?? 0,
        target: weekChallenge?.requirement.target ?? 1,
        isComplete: weekProgress?.isCompleted ?? false,
      },
      currentStreak: streak.currentStreak,
      totalXP: xp.totalXP,
      currentLevel: xp.currentLevel,
    };
  }

  // ============================================================================
  // DAILY CHALLENGES
  // ============================================================================

  async getTodaysChallenge(): Promise<{
    challenge: DailyChallenge | null;
    progress: UserChallengeProgress | null;
    timeRemaining: { hours: number; minutes: number } | null;
  }> {
    const [challenge, progress] = await Promise.all([
      this._dailyChallengeService.getTodayChallenge(),
      this._dailyChallengeService.getChallengeProgress(),
    ]);

    let timeRemaining: { hours: number; minutes: number } | null = null;

    if (challenge) {
      // Calculate time until midnight
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const msRemaining = midnight.getTime() - now.getTime();

      if (msRemaining > 0) {
        timeRemaining = {
          hours: Math.floor(msRemaining / (1000 * 60 * 60)),
          minutes: Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60)),
        };
      }
    }

    return { challenge, progress, timeRemaining };
  }

  async updateDailyProgress(
    progressDelta: number,
    metadata?: XPEventMetadata
  ): Promise<{
    completed: boolean;
    xpAwarded: number;
    newStreak?: number;
  }> {
    const result = await this._dailyChallengeService.updateChallengeProgress(
      progressDelta,
      metadata
    );

    let xpAwarded = 0;
    let newStreak: number | undefined;

    if (result.completed) {
      // Get challenge to know XP reward
      const challenge = await this._dailyChallengeService.getTodayChallenge();
      xpAwarded = challenge?.xpReward ?? 0;

      // Check streak
      const streakResult = await this._streakService.recordDailyActivity();
      if (streakResult.streakIncremented) {
        newStreak = streakResult.currentStreak;
      }
    }

    return {
      completed: result.completed,
      xpAwarded,
      newStreak,
    };
  }

  // ============================================================================
  // WEEKLY CHALLENGES
  // ============================================================================

  async getWeeklyChallenge(): Promise<{
    challenge: WeeklyChallenge | null;
    progress: UserWeeklyChallengeProgress | null;
    timeRemaining: { days: number; hours: number } | null;
    bonusTimeRemaining: { days: number; hours: number } | null;
  }> {
    const [challenge, progress, timeRemaining, bonusTimeRemaining] =
      await Promise.all([
        this._weeklyChallengeService.getCurrentWeekChallenge(),
        this._weeklyChallengeService.getWeeklyProgress(),
        this._weeklyChallengeService.getTimeRemaining(),
        this._weeklyChallengeService.getBonusTimeRemaining(),
      ]);

    return {
      challenge,
      progress,
      timeRemaining: timeRemaining
        ? { days: timeRemaining.days, hours: timeRemaining.hours }
        : null,
      bonusTimeRemaining: bonusTimeRemaining
        ? { days: bonusTimeRemaining.days, hours: bonusTimeRemaining.hours }
        : null,
    };
  }

  async updateWeeklyProgress(
    progressDelta: number,
    metadata?: XPEventMetadata
  ): Promise<{
    completed: boolean;
    xpAwarded: number;
    bonusEarned: boolean;
  }> {
    const result = await this._weeklyChallengeService.updateWeeklyProgress(
      progressDelta,
      metadata
    );

    let xpAwarded = 0;
    if (result.completed) {
      const challenge =
        await this._weeklyChallengeService.getCurrentWeekChallenge();
      xpAwarded = challenge?.xpReward ?? 0;
      if (result.bonusEarned && challenge?.bonusMultiplier) {
        xpAwarded += Math.floor(xpAwarded * challenge.bonusMultiplier);
      }
    }

    return {
      completed: result.completed,
      xpAwarded,
      bonusEarned: result.bonusEarned,
    };
  }

  async getWeeklyHistory(weeks: number = 8): Promise<
    Array<{
      challenge: WeeklyChallenge;
      progress: UserWeeklyChallengeProgress | null;
    }>
  > {
    return this._weeklyChallengeService.getWeeklyChallengeHistory(weeks);
  }

  // ============================================================================
  // SKILL PROGRESSIONS
  // ============================================================================

  async getSkillsOverview(): Promise<{
    inProgress: Array<{ skill: SkillProgression; progress: UserSkillProgress }>;
    available: SkillProgression[];
    completed: SkillProgression[];
    recommendations: Array<{
      skill: SkillProgression;
      reason: string;
      progress?: UserSkillProgress;
    }>;
  }> {
    const [inProgress, available, completed, recommendations] =
      await Promise.all([
        this._skillProgressionService.getSkillsInProgress(),
        this._skillProgressionService.getAvailableSkills(),
        this._skillProgressionService.getMasteredSkills(),
        this._skillProgressionService.getRecommendedSkills(5),
      ]);

    // Filter out in-progress and completed from available
    const inProgressIds = new Set(inProgress.map((s) => s.skill.skillId));
    const completedIds = new Set(completed.map((s) => s.skillId));
    const filteredAvailable = available.filter(
      (s) => !inProgressIds.has(s.skillId) && !completedIds.has(s.skillId)
    );

    return {
      inProgress,
      available: filteredAvailable,
      completed,
      recommendations,
    };
  }

  async getSkillsByCategory(category: SkillCategory): Promise<{
    skills: SkillProgression[];
    progressMap: Map<string, UserSkillProgress>;
    categoryStats: {
      total: number;
      started: number;
      mastered: number;
      completionPercentage: number;
    };
  }> {
    const [skills, progressMap, stats] = await Promise.all([
      this._skillProgressionService.getSkillsByCategory(category),
      this._skillProgressionService.getUserProgressByCategory(category),
      this._skillProgressionService.getCategoryStats(category),
    ]);

    return {
      skills,
      progressMap,
      categoryStats: {
        total: stats.total,
        started: stats.started,
        mastered: stats.mastered,
        completionPercentage: stats.completionPercentage,
      },
    };
  }

  async startSkill(skillId: string): Promise<UserSkillProgress> {
    return this._skillProgressionService.startSkill(skillId);
  }

  async updateSkillProgress(
    skillId: string,
    progressDelta: number,
    metadata?: XPEventMetadata
  ): Promise<{
    levelCompleted: boolean;
    skillCompleted: boolean;
    xpAwarded: number;
    progress: UserSkillProgress;
  }> {
    return this._skillProgressionService.updateSkillProgress(
      skillId,
      progressDelta,
      metadata
    );
  }

  // ============================================================================
  // UNIFIED ACTION TRACKING
  // ============================================================================

  async trackAction(
    action: XPActionType,
    metadata?: XPEventMetadata
  ): Promise<{
    xpGained: number;
    dailyChallengeProgress?: { completed: boolean; progress: number };
    weeklyChallengeProgress?: { completed: boolean; progress: number };
    skillsUpdated: Array<{
      skillId: string;
      levelCompleted: boolean;
      skillCompleted: boolean;
    }>;
  }> {
    // Track with achievement service for XP
    const xpResult = await this._achievementService.trackAction(
      action,
      metadata
    );

    // Track daily challenge progress if applicable
    let dailyChallengeProgress:
      | { completed: boolean; progress: number }
      | undefined;
    const dailyChallenge =
      await this._dailyChallengeService.getTodayChallenge();
    if (
      dailyChallenge &&
      this._matchesChallengeType(dailyChallenge.type, action)
    ) {
      const dailyResult =
        await this._dailyChallengeService.updateChallengeProgress(1, metadata);
      dailyChallengeProgress = {
        completed: dailyResult.completed,
        progress: dailyResult.progress.progress,
      };
    }

    // Track weekly challenge progress if applicable
    let weeklyChallengeProgress:
      | { completed: boolean; progress: number }
      | undefined;
    const weeklyChallenge =
      await this._weeklyChallengeService.getCurrentWeekChallenge();
    if (
      weeklyChallenge &&
      this._matchesChallengeType(weeklyChallenge.type, action)
    ) {
      const weeklyResult =
        await this._weeklyChallengeService.updateWeeklyProgress(1, metadata);
      weeklyChallengeProgress = {
        completed: weeklyResult.completed,
        progress: weeklyResult.progress.progress,
      };
    }

    // Track skill progress
    const skillResults = await this._skillProgressionService.trackAction(
      this._mapActionTypeToSkillAction(action),
      {
        letter: metadata?.["letter"] as string | undefined,
        conceptId: metadata?.["conceptId"] as string | undefined,
        quizScore: metadata?.["quizScore"] as number | undefined,
        sequenceId: metadata?.["sequenceId"] as string | undefined,
      }
    );

    return {
      xpGained: xpResult.xpGained,
      dailyChallengeProgress,
      weeklyChallengeProgress,
      skillsUpdated: skillResults,
    };
  }

  // ============================================================================
  // LEADERBOARDS
  // ============================================================================

  async getLeaderboard(
    category: LeaderboardCategory,
    timeframe: LeaderboardTimeframe,
    _limit: number = 50
  ): Promise<LeaderboardData> {
    // Placeholder - LeaderboardManager will be extended in Phase 5
    return {
      category,
      timeframe,
      entries: [],
      totalUsers: 0,
      lastUpdated: new Date(),
    };
  }

  async getUserRank(
    _category: LeaderboardCategory,
    _timeframe: LeaderboardTimeframe
  ): Promise<{
    rank: number;
    totalUsers: number;
    percentile: number;
  }> {
    // Placeholder - LeaderboardManager will be extended in Phase 5
    return {
      rank: 0,
      totalUsers: 0,
      percentile: 0,
    };
  }

  // ============================================================================
  // NOTIFICATIONS & REMINDERS
  // ============================================================================

  async getPendingNotifications(): Promise<
    Array<{
      type:
        | "daily_reminder"
        | "weekly_reminder"
        | "streak_at_risk"
        | "bonus_expiring";
      message: string;
      actionLabel?: string;
      priority: "low" | "medium" | "high";
    }>
  > {
    const notifications: Array<{
      type:
        | "daily_reminder"
        | "weekly_reminder"
        | "streak_at_risk"
        | "bonus_expiring";
      message: string;
      actionLabel?: string;
      priority: "low" | "medium" | "high";
    }> = [];

    // Check daily challenge status
    const dailyComplete =
      await this._dailyChallengeService.isTodayChallengeComplete();
    if (!dailyComplete) {
      const { timeRemaining } = await this.getTodaysChallenge();
      if (timeRemaining && timeRemaining.hours < 4) {
        notifications.push({
          type: "daily_reminder",
          message: `Daily challenge ends in ${timeRemaining.hours}h ${timeRemaining.minutes}m!`,
          actionLabel: "Complete Now",
          priority: "high",
        });
      }
    }

    // Check streak status
    const streakStatus = await this._streakService.checkStreakStatus();
    if (!streakStatus.isActive && streakStatus.daysSinceLastActivity === 1) {
      const streak = await this._streakService.getCurrentStreak();
      if (streak.currentStreak > 0) {
        notifications.push({
          type: "streak_at_risk",
          message: `Your ${streak.currentStreak}-day streak is at risk! Log in to keep it going.`,
          actionLabel: "Save Streak",
          priority: "high",
        });
      }
    }

    // Check weekly bonus deadline
    const bonusRemaining =
      await this._weeklyChallengeService.getBonusTimeRemaining();
    const weeklyComplete =
      await this._weeklyChallengeService.isCurrentWeekChallengeComplete();
    if (bonusRemaining && !weeklyComplete && bonusRemaining.days === 0) {
      notifications.push({
        type: "bonus_expiring",
        message: `Weekly challenge bonus expires in ${bonusRemaining.hours}h! Complete now for extra XP.`,
        actionLabel: "Earn Bonus",
        priority: "medium",
      });
    }

    return notifications;
  }

  async dismissNotification(): Promise<void> {
    // Notifications are ephemeral in this implementation
    // Could be stored in local storage if persistence is needed
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  async getFullStats(): Promise<{
    challenges: {
      dailyCompleted: number;
      weeklyCompleted: number;
      currentDailyStreak: number;
      longestDailyStreak: number;
      currentWeeklyStreak: number;
      bonusesEarned: number;
    };
    skills: {
      totalSkills: number;
      skillsStarted: number;
      skillsMastered: number;
      levelsCompleted: number;
      completionPercentage: number;
    };
    xp: {
      totalXP: number;
      currentLevel: number;
      xpToNextLevel: number;
      xpFromChallenges: number;
      xpFromSkills: number;
    };
  }> {
    const [challengeStats, weeklyStats, skillStats, xp] = await Promise.all([
      this._dailyChallengeService.getChallengeStats(),
      this._weeklyChallengeService.getWeeklyStats(),
      this._skillProgressionService.getStats(),
      this._achievementService.getUserXP(),
    ]);

    return {
      challenges: {
        dailyCompleted: challengeStats.totalChallengesCompleted,
        weeklyCompleted: weeklyStats.totalWeeklyChallengesCompleted,
        currentDailyStreak: challengeStats.currentStreak,
        longestDailyStreak: challengeStats.longestStreak,
        currentWeeklyStreak: weeklyStats.currentWeeklyStreak,
        bonusesEarned: weeklyStats.totalBonusesEarned,
      },
      skills: {
        totalSkills: skillStats.totalSkills,
        skillsStarted: skillStats.skillsStarted,
        skillsMastered: skillStats.skillsMastered,
        levelsCompleted: skillStats.totalLevelsCompleted,
        completionPercentage: skillStats.completionPercentage,
      },
      xp: {
        totalXP: xp.totalXP,
        currentLevel: xp.currentLevel,
        xpToNextLevel: xp.xpToNextLevel,
        xpFromChallenges: 0, // Would need separate tracking
        xpFromSkills: skillStats.xpFromSkills,
      },
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private _matchesChallengeType(
    challengeType: string,
    action: XPActionType
  ): boolean {
    const mappings: Record<string, XPActionType[]> = {
      sequence_creation: ["sequence_created"],
      learning: ["concept_learned", "drill_completed"],
      practice: ["sequence_created", "daily_login"],
    };

    return mappings[challengeType]?.includes(action) ?? false;
  }

  private _mapActionTypeToSkillAction(
    action: XPActionType
  ): SkillProgressActionType {
    const mappings: Record<XPActionType, SkillProgressActionType> = {
      sequence_created: "sequence_created",
      sequence_published: "sequence_created",
      concept_learned: "drill_completed",
      drill_completed: "drill_completed",
      daily_challenge_completed: "challenge_completed",
      weekly_challenge_completed: "challenge_completed",
      weekly_challenge_bonus: "challenge_completed",
      achievement_unlocked: "challenge_completed",
      daily_login: "daily_practice",
      skill_level_completed: "challenge_completed",
      skill_mastery_achieved: "challenge_completed",
      training_session_completed: "daily_practice",
      perfect_training_run: "daily_practice",
      training_combo_20: "daily_practice",
      timed_150bpm: "daily_practice",
      train_challenge_completed: "challenge_completed",
      feedback_submitted: "challenge_completed",
    };

    return mappings[action] || "sequence_created";
  }
}
