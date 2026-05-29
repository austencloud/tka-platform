<!-- QuizResultsView - Refactored with service architecture -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onDestroy, onMount } from "svelte";
  import * as quizResultsAnalyzerModule from "$lib/features/learn/quiz/quiz-results-analyzer";
  import type { QuizResults } from "../domain/models/quiz-models";
  import type { AchievementDefinition } from "../domain/achievement-definitions";
  import QuizResultsHeader from "./QuizResultsHeader.svelte";
  import QuizPerformanceGrade from "./QuizPerformanceGrade.svelte";
  import QuizAchievementsBadges from "./QuizAchievementsBadges.svelte";
  import QuizStatsGrid from "./QuizStatsGrid.svelte";
  import QuizResultsActions from "./QuizResultsActions.svelte";
  import QuizMisconceptionSummary from "./QuizMisconceptionSummary.svelte";
  import AchievementUnlockOverlay from "./AchievementUnlockOverlay.svelte";
  import PerfectQuizCelebration from "./PerfectQuizCelebration.svelte";
  import type { DetectedGap } from "../../services/types";

  // Props
  let {
    results = null,
    detectedGaps = [],
    onBackToSelector,
    onRetryLesson,
    onReturnToSelector,
    onRestartQuiz,
  } = $props<{
    results?: QuizResults | null;
    detectedGaps?: DetectedGap[];
    onBackToSelector?: () => void;
    onRetryLesson?: () => void;
    onReturnToSelector?: () => void;
    onRestartQuiz?: () => void;
  }>();

  // Services
  let hapticService = $state<HapticFeedback | null>(null);
  const analyzer = quizResultsAnalyzerModule;

  // Celebration overlay states
  let showPerfectCelebration = $state(false);
  let currentAchievement = $state<AchievementDefinition | null>(null);

  let perfectTimer: ReturnType<typeof setTimeout> | null = null;
  let achievementTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (perfectTimer !== null) clearTimeout(perfectTimer);
    if (achievementTimer !== null) clearTimeout(achievementTimer);
  });

  // Check if this was a perfect quiz
  const isPerfectQuiz = $derived(results?.accuracyPercentage === 100);

  // Initialize services and queue celebrations
  onMount(() => {
    hapticService = getHapticFeedback();

    if (results && analyzer) {
      // Show perfect quiz celebration first if applicable
      if (isPerfectQuiz) {
        perfectTimer = setTimeout(() => {
          showPerfectCelebration = true;
        }, 300);
      } else {
        // Otherwise, check for achievements
        queueAchievementCelebration();
      }
    }
  });

  function queueAchievementCelebration() {
    if (!results || !analyzer) return;

    const achievements = analyzer.getAchievementDefinitions(results);
    // Sort by tier: gold first, then silver, then bronze
    const tierOrder = { gold: 0, silver: 1, bronze: 2 };
    achievements.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

    // Only show the top achievement to avoid overwhelming
    if (achievements.length > 0) {
      // Show gold/silver achievements, skip bronze (too common)
      const worthyAchievement = achievements.find(
        (a) => a.tier === "gold" || a.tier === "silver"
      );
      if (worthyAchievement) {
        achievementTimer = setTimeout(() => {
          currentAchievement = worthyAchievement;
        }, 500);
      }
    }
  }

  function handlePerfectDismiss() {
    showPerfectCelebration = false;
    // After perfect celebration, show any remaining achievements
    queueAchievementCelebration();
  }

  function handleAchievementDismiss() {
    currentAchievement = null;
  }

  // Handle navigation
  function handleBackClick() {
    hapticService?.trigger("selection");
    onBackToSelector?.();
    onReturnToSelector?.();
  }

  function handleRetryClick() {
    hapticService?.trigger("selection");
    onRetryLesson?.();
    onRestartQuiz?.();
  }
</script>

<div class="lesson-results">
  <!-- Perfect quiz celebration (shown first for 100% scores) -->
  {#if showPerfectCelebration}
    <PerfectQuizCelebration onDismiss={handlePerfectDismiss} />
  {/if}

  <!-- Achievement unlock overlay -->
  {#if currentAchievement}
    <AchievementUnlockOverlay
      achievement={currentAchievement}
      onDismiss={handleAchievementDismiss}
    />
  {/if}

  {#if results}
    <QuizResultsHeader
      lessonName={analyzer?.getLessonDisplayName(results.lessonType) ||
        "Unknown Quiz"}
      onBack={handleBackClick}
    />

    <div class="results-content">
      <div class="results-card glass-surface">
        <QuizPerformanceGrade
          grade={analyzer?.getPerformanceGrade(results.accuracyPercentage) || {
            grade: "F",
            color: "var(--semantic-error)",
            message: "Try again!",
          }}
          accuracy={results.accuracyPercentage}
        />

        <!-- Performance Feedback -->
        <div class="feedback-section">
          <p class="feedback-text">
            {analyzer?.getPerformanceFeedback(results) || "Keep practicing!"}
          </p>
        </div>

        {#if detectedGaps.length > 0}
          <QuizMisconceptionSummary gaps={detectedGaps} />
        {/if}

        <QuizAchievementsBadges
          achievements={analyzer?.getAchievements(results) || []}
        />

        <QuizStatsGrid
          correctAnswers={results.correctAnswers}
          incorrectGuesses={results.incorrectGuesses}
          totalQuestions={results.totalQuestions}
          completionTime={analyzer?.formatTime(results.completionTimeSeconds) ||
            "0:00"}
        />

        <div class="lesson-details">
          <p>
            <strong>Mode:</strong>
            {analyzer?.getQuizModeDisplayName(results.quizMode) || "Unknown"}
          </p>
          <p>
            <strong>Completed:</strong>
            {analyzer?.formatDate(results.completedAt) || "Unknown"}
          </p>
        </div>
      </div>

      <QuizResultsActions
        onRetry={handleRetryClick}
        onChooseNew={handleBackClick}
      />
    </div>
  {:else}
    <QuizResultsHeader lessonName="No Results" onBack={handleBackClick} />

    <div class="results-content">
      <div class="placeholder-results glass-surface">
        <div class="placeholder-icon">🏆</div>
        <h3>Quiz Results</h3>
        <p>Quiz completion results will be displayed here.</p>
        <div class="coming-soon">
          <p>🚧 Coming Soon:</p>
          <ul>
            <li>Accuracy Percentage</li>
            <li>Time Tracking</li>
            <li>Performance Grades</li>
            <li>Progress Statistics</li>
            <li>Achievement Badges</li>
          </ul>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .lesson-results {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
  }

  .results-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    flex: 1;
  }

  .results-card {
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    overflow: hidden;
  }

  .feedback-section {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    text-align: center;
  }

  .feedback-text {
    margin: 0;
    font-size: var(--font-size-lg);
    color: var(--text-color);
    font-weight: 500;
  }

  .lesson-details {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .lesson-details p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .lesson-details strong {
    color: var(--text-color);
  }

  /* Placeholder */
  .placeholder-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-3xl);
    text-align: center;
    border-radius: 12px;
    min-height: 400px;
  }

  .placeholder-icon {
    font-size: var(--font-size-3xl);
    margin-bottom: var(--spacing-lg);
  }

  .placeholder-results h3 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-2xl);
    color: var(--text-color);
  }

  .placeholder-results p {
    margin: 0 0 var(--spacing-lg) 0;
    color: var(--text-secondary);
  }

  .coming-soon {
    margin-top: var(--spacing-xl);
    text-align: left;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    padding: var(--spacing-lg);
    border-radius: 8px;
  }

  .coming-soon p {
    margin: 0 0 var(--spacing-sm) 0;
    font-weight: 600;
    color: var(--text-color);
  }

  .coming-soon ul {
    margin: 0;
    padding-left: var(--spacing-lg);
    color: var(--text-secondary);
  }

  .coming-soon li {
    margin: var(--spacing-xs) 0;
  }
</style>
