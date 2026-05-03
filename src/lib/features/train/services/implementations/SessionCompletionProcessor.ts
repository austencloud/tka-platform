/**
 * SessionCompletionProcessor
 *
 * Handles all post-session processing for training sessions:
 * - Calculates and awards XP
 * - Saves performance to history
 * - Tracks achievements
 * - Processes challenge progression
 */

import type {
  ISessionCompletionProcessor,
  SessionCompletionParams,
  SessionCompletionResult,
  XPBreakdown,
  ChallengeProgressResult,
} from "../contracts/ISessionCompletionProcessor";
import type { IPerformanceHistoryTracker } from "../contracts/IPerformanceHistoryTracker";
import type { AchievementManager } from '$lib/shared/gamification/services/implementations/AchievementManager'
import type { TrainChallengeManager } from "./TrainChallengeManager";
import type { StoredPerformance } from "../../domain/models/TrainDatabaseModels";
import type { TrainChallenge } from "../../domain/models/TrainChallengeModels";
import { PracticeMode } from "../../domain/enums/TrainEnums";
import {
  calculateSessionXP,
  checkChallengeRequirement,
  sessionResultToScore,
  type SessionResult,
} from "../../utils/challenge-completion-detector";
import { activeChallengeState } from "../../state/active-challenge-state.svelte";
import { addNotification } from "$lib/shared/gamification/state/notification-state.svelte";

export class SessionCompletionProcessor implements ISessionCompletionProcessor {
  constructor(
    private historyTracker: IPerformanceHistoryTracker,
    private achievementManager: AchievementManager,
    private challengeManager: TrainChallengeManager
  ) {}

  async processCompletion(
    params: SessionCompletionParams
  ): Promise<SessionCompletionResult> {
    const accuracy =
      params.totalSteps > 0
        ? (params.totalHits / params.totalSteps) * 100
        : 0;

    const grade = this.calculateGrade(accuracy);
    const xpBreakdown = this.calculateXP(params, accuracy);

    // Build session result for challenge processing
    const sessionResult: SessionResult = {
      totalSteps: params.totalSteps,
      hits: params.totalHits,
      misses: params.totalMisses,
      maxCombo: params.maxCombo,
      finalScore: params.currentScore,
      accuracy,
      mode: params.practiceMode,
      sequenceId: params.sequenceId,
      bpm: params.bpm,
      duration: params.sessionDuration,
    };

    // Save to history
    await this.savePerformanceHistory(params, accuracy, grade, xpBreakdown);

    // Track achievements
    await this.trackAchievements(sessionResult);

    // Process active challenge
    const challengeProgress = await this.processActiveChallenge(sessionResult);

    return {
      xpBreakdown,
      grade,
      accuracy,
      challengeProgress,
    };
  }

  private calculateGrade(accuracy: number): "S" | "A" | "B" | "C" | "D" | "F" {
    if (accuracy >= 95) return "S";
    if (accuracy >= 85) return "A";
    if (accuracy >= 70) return "B";
    if (accuracy >= 55) return "C";
    if (accuracy >= 40) return "D";
    return "F";
  }

  private calculateXP(
    params: SessionCompletionParams,
    accuracy: number
  ): XPBreakdown {
    const sessionResult: SessionResult = {
      totalSteps: params.totalSteps,
      hits: params.totalHits,
      misses: params.totalMisses,
      maxCombo: params.maxCombo,
      finalScore: params.currentScore,
      accuracy,
      mode: params.practiceMode,
      sequenceId: params.sequenceId,
      bpm: params.bpm,
      duration: params.sessionDuration,
    };
    return calculateSessionXP(sessionResult);
  }

  private async savePerformanceHistory(
    params: SessionCompletionParams,
    accuracy: number,
    grade: "S" | "A" | "B" | "C" | "D" | "F",
    xpBreakdown: XPBreakdown
  ): Promise<void> {
    try {
      const storedPerformance: StoredPerformance = {
        id: crypto.randomUUID(),
        sequenceId: params.sequenceId ?? "unknown",
        sequenceName: params.sequenceName ?? "Unknown Sequence",
        performedAt: new Date(),
        detectionMethod: "mediapipe",
        bpm: params.bpm,
        beatResultsJson: "[]",
        score: {
          percentage: Math.round(accuracy * 10) / 10,
          grade,
          perfectHits: params.totalHits,
          goodHits: 0,
          misses: params.totalMisses,
          maxCombo: params.maxCombo,
          xpEarned: xpBreakdown.totalXP,
        },
        metadata: {
          sessionDuration: params.sessionDuration,
        },
      };

      await this.historyTracker.savePerformance(storedPerformance);
    } catch (error) {
      console.error("Failed to save session to history:", error);
    }
  }

  private async trackAchievements(sessionResult: SessionResult): Promise<void> {
    try {
      await this.achievementManager.trackAction("training_session_completed", {
        accuracy: sessionResult.accuracy,
        combo: sessionResult.maxCombo,
        mode: sessionResult.mode,
      });

      if (sessionResult.accuracy === 100) {
        await this.achievementManager.trackAction("perfect_training_run", {});
      }

      if (sessionResult.maxCombo >= 20) {
        await this.achievementManager.trackAction("training_combo_20", {});
      }

      if (
        sessionResult.mode === PracticeMode.TIMED &&
        sessionResult.bpm &&
        sessionResult.bpm >= 150
      ) {
        await this.achievementManager.trackAction("timed_150bpm", {});
      }
    } catch (error) {
      console.error("Failed to track achievements:", error);
    }
  }

  private async processActiveChallenge(
    sessionResult: SessionResult
  ): Promise<ChallengeProgressResult | undefined> {
    const activeChallenge = activeChallengeState.activeChallenge;
    if (!activeChallenge) return undefined;

    try {
      const increment = checkChallengeRequirement(activeChallenge, sessionResult);
      if (increment <= 0) return undefined;

      const score = sessionResultToScore(sessionResult);
      await this.challengeManager.recordProgress(
        activeChallenge.id,
        increment,
        score
      );

      const progress = await this.challengeManager.getUserProgressForChallenge(
        activeChallenge.id
      );

      if (!progress) return undefined;

      const isComplete =
        progress.progress >= activeChallenge.requirement.target &&
        !progress.isCompleted;

      if (isComplete) {
        return await this.handleChallengeCompletion(
          activeChallenge,
          progress.progress,
          score
        );
      }

      // Show progress notification
      this.showProgressNotification(activeChallenge, progress.progress);

      return {
        challenge: {
          id: activeChallenge.id,
          title: activeChallenge.title,
          requirement: { target: activeChallenge.requirement.target },
          xpReward: activeChallenge.xpReward,
        },
        currentProgress: progress.progress,
        isComplete: false,
      };
    } catch (error) {
      console.error("Failed to process challenge progress:", error);
      return undefined;
    }
  }

  private async handleChallengeCompletion(
    challenge: TrainChallenge,
    currentProgress: number,
    score: ReturnType<typeof sessionResultToScore>
  ): Promise<ChallengeProgressResult> {
    const challengeXP = await this.challengeManager.completeChallenge(
      challenge.id,
      score
    );

    // Show completion notification
    addNotification({
      id: `challenge-${challenge.id}-${Date.now()}`,
      type: "challenge_complete",
      title: "Challenge Completed!",
      message: `${challenge.title} - +${challengeXP} XP`,
      icon: "fa-trophy",
      timestamp: new Date(),
      isRead: false,
      data: {
        xpGained: challengeXP,
        challengeTitle: challenge.title,
      },
    });

    // Track challenge completion achievement
    await this.achievementManager.trackAction("train_challenge_completed", {
      challengeId: challenge.id,
      difficulty: challenge.difficulty,
      challengeType: "train",
    });

    // Clear active challenge
    activeChallengeState.clearActiveChallenge();

    return {
      challenge: {
        id: challenge.id,
        title: challenge.title,
        requirement: { target: challenge.requirement.target },
        xpReward: challenge.xpReward,
      },
      currentProgress,
      isComplete: true,
      xpAwarded: challengeXP,
    };
  }

  private showProgressNotification(
    challenge: TrainChallenge,
    currentProgress: number
  ): void {
    addNotification({
      id: `progress-${challenge.id}-${Date.now()}`,
      type: "challenge_complete",
      title: "Challenge Progress",
      message: `${challenge.title}: ${currentProgress}/${challenge.requirement.target}`,
      icon: "fa-dumbbell",
      timestamp: new Date(),
      isRead: false,
      data: { challengeTitle: challenge.title },
    });
  }
}
