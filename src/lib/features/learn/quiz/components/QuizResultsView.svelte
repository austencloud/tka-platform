<!-- QuizResultsView - Refactored with service architecture -->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import type { QuizResults } from "../domain/models/quiz-models";
  import type { IQuizResultsAnalyzer } from "../QuizResultsAnalyzer";
  import QuizResultsHeader from "./QuizResultsHeader.svelte";
  import QuizPerformanceGrade from "./QuizPerformanceGrade.svelte";
  import QuizAchievementsBadges from "./QuizAchievementsBadges.svelte";
  import QuizStatsGrid from "./QuizStatsGrid.svelte";
  import QuizResultsActions from "./QuizResultsActions.svelte";

  // Props
  let {
    results = null,
    onBackToSelector,
    onRetryLesson,
    onReturnToSelector,
    onRestartQuiz,
  } = $props<{
    results?: QuizResults | null;
    onBackToSelector?: () => void;
    onRetryLesson?: () => void;
    onReturnToSelector?: () => void;
    onRestartQuiz?: () => void;
  }>();

  // Services
  let hapticService = $state<IHapticFeedback | null>(null);
  let analyzer = $state<IQuizResultsAnalyzer | null>(null);

  // Initialize services
  onMount(() => {
    hapticService = container.items.hapticFeedback;
    analyzer = container.items.quizResultsAnalyzer;
  });

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
    border-top: 1px solid rgba(0, 0, 0, 0.1);
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
    border-top: 1px solid rgba(0, 0, 0, 0.1);
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
    background: rgba(0, 0, 0, 0.02);
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
