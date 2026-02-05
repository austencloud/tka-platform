<!--
	Progress Tracker Component

	Displays quiz progress including question count, accuracy, and streaks.
	Adapts display based on quiz mode (fixed questions vs countdown).
	Matches desktop ProgressControls styling exactly.
-->

<script lang="ts">
  import { QuizMode } from "../domain/enums/quiz-enums";
  import type { QuizProgress } from "../domain/models/quiz-models";

  // Props using Svelte 5 runes
  let {
    progress,
    quizMode,
    showDetailed = true,
    compact = false,
  }: {
    progress: QuizProgress;
    quizMode: QuizMode;
    showDetailed?: boolean;
    compact?: boolean;
  } = $props();

  // Derived values using Svelte 5 runes
  let accuracyPercentage = $derived(
    progress.questionsAnswered > 0
      ? Math.round((progress.correctAnswers / progress.questionsAnswered) * 100)
      : 0
  );
  let progressPercentage = $derived(
    quizMode === QuizMode.FIXED_QUESTION && progress.totalQuestions > 0
      ? Math.round((progress.questionsAnswered / progress.totalQuestions) * 100)
      : 0
  );
  let formattedTime = $derived(formatTime(progress.timeElapsed));

  // Methods
  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  function getAccuracyClass(percentage: number): string {
    if (percentage >= 80) return "excellent";
    if (percentage >= 60) return "good";
    if (percentage >= 40) return "fair";
    return "poor";
  }
</script>

<div class="progress-tracker" class:compact>
  {#if compact}
    <!-- Compact View -->
    <div class="compact-stats">
      {#if quizMode === QuizMode.FIXED_QUESTION}
        <div class="stat-item">
          <span class="stat-value">{progress.currentQuestion}</span>
          <span class="stat-separator">/</span>
          <span class="stat-total">{progress.totalQuestions}</span>
        </div>
      {:else}
        <div class="stat-item">
          <span class="stat-value">{progress.questionsAnswered}</span>
          <span class="stat-label">answered</span>
        </div>
      {/if}

      <div class="stat-divider"></div>

      <div class="stat-item accuracy {getAccuracyClass(accuracyPercentage)}">
        <span class="stat-value">{accuracyPercentage}%</span>
        <span class="stat-label">accuracy</span>
      </div>
    </div>
  {:else}
    <!-- Detailed View -->
    <div class="detailed-stats">
      <!-- Progress Bar (for fixed question mode) -->
      {#if quizMode === QuizMode.FIXED_QUESTION}
        <div class="progress-section">
          <div class="progress-header">
            <span class="progress-label">Question Progress</span>
            <span class="progress-count"
              >{progress.currentQuestion} / {progress.totalQuestions}</span
            >
          </div>
          <div class="desktop-progress-bar">
            <div
              class="desktop-progress-fill"
              style="width: {progressPercentage}%"
            ></div>
          </div>
        </div>
      {/if}

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <div class="stat-value">{progress.questionsAnswered}</div>
            <div class="stat-label">Questions Answered</div>
          </div>
        </div>

        <div
          class="stat-card accuracy-card {getAccuracyClass(accuracyPercentage)}"
        >
          <div class="stat-icon">🎯</div>
          <div class="stat-content">
            <div
              class="stat-value desktop-accuracy-{getAccuracyClass(
                accuracyPercentage
              )}"
            >
              {accuracyPercentage}%
            </div>
            <div class="stat-label">Accuracy</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-value">{progress.correctAnswers}</div>
            <div class="stat-label">Correct</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">❌</div>
          <div class="stat-content">
            <div class="stat-value">{progress.incorrectAnswers}</div>
            <div class="stat-label">Incorrect</div>
          </div>
        </div>

        {#if showDetailed}
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-content">
              <div class="stat-value">{formattedTime}</div>
              <div class="stat-label">Time Elapsed</div>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon">🔥</div>
            <div class="stat-content">
              <div class="stat-value">{progress.streakCurrent}</div>
              <div class="stat-label">Current Streak</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Streak Display -->
      {#if progress.streakLongest > 0}
        <div class="streak-section">
          <div class="streak-badge">
            <span class="streak-icon">🏆</span>
            <span class="streak-text"
              >Best Streak: {progress.streakLongest}</span
            >
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .progress-tracker {
    background: var(--desktop-bg-secondary);
    border: 1px solid var(--desktop-border-secondary);
    border-radius: var(--desktop-border-radius);
    backdrop-filter: blur(10px);
    color: var(--desktop-text-primary);
  }

  /* Compact View */
  .compact {
    padding: var(--desktop-spacing-md) var(--desktop-spacing-lg);
  }

  .compact-stats {
    display: flex;
    align-items: center;
    gap: var(--desktop-spacing-lg);
    font-size: var(--desktop-font-size-sm);
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-value {
    font-weight: bold;
    font-size: var(--desktop-font-size-lg);
  }

  .stat-separator {
    color: var(--desktop-text-muted);
    margin: 0 0.25rem;
  }

  .stat-total {
    color: var(--desktop-text-muted);
    font-size: var(--desktop-font-size-base);
  }

  .stat-label {
    color: var(--desktop-text-muted);
    font-size: var(--desktop-font-size-xs);
  }

  .stat-divider {
    width: 1px;
    height: 20px;
    background: var(--desktop-border-secondary);
  }

  /* Detailed View */
  .detailed-stats {
    padding: var(--desktop-spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--desktop-spacing-xl);
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: var(--desktop-spacing-sm);
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--desktop-font-size-sm);
  }

  .progress-label {
    color: var(--desktop-text-primary);
    font-weight: 500;
  }

  .progress-count {
    color: var(--desktop-text-muted);
    font-weight: 600;
  }

  .progress-bar {
    height: 8px;
    background: var(--desktop-bg-tertiary);
    border-radius: var(--desktop-border-radius-xs);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    border-radius: var(--desktop-border-radius-xs);
    transition: width var(--desktop-transition-slow);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--desktop-spacing-lg);
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--desktop-spacing-md);
    padding: var(--desktop-spacing-lg);
    background: var(--desktop-bg-tertiary);
    border: 1px solid var(--desktop-border-tertiary);
    border-radius: var(--desktop-border-radius);
    backdrop-filter: blur(10px);
    transition: all var(--desktop-transition-normal);
  }

  .stat-card:hover {
    background: var(--desktop-bg-secondary);
    border-color: var(--desktop-border-secondary);
    transform: translateY(-2px);
  }

  .stat-icon {
    font-size: 1.5rem;
    opacity: 0.8;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-card .stat-value {
    font-size: var(--desktop-font-size-xl);
    font-weight: bold;
    color: var(--desktop-text-primary);
  }

  .stat-card .stat-label {
    font-size: var(--desktop-font-size-xs);
    color: var(--desktop-text-muted);
    font-weight: 500;
  }

  /* Accuracy Colors - using desktop theme variables */
  .accuracy.excellent,
  .accuracy-card.excellent {
    color: var(--desktop-progress-excellent) !important;
  }

  .accuracy.good,
  .accuracy-card.good {
    color: var(--desktop-progress-good) !important;
  }

  .accuracy.fair,
  .accuracy-card.fair {
    color: var(--desktop-progress-fair) !important;
  }

  .accuracy.poor,
  .accuracy-card.poor {
    color: var(--desktop-progress-poor) !important;
  }

  .accuracy-card.excellent {
    border-color: var(--desktop-progress-excellent);
    background: rgba(0, 255, 0, 0.1);
  }

  .accuracy-card.good {
    border-color: var(--desktop-progress-good);
    background: rgba(255, 255, 0, 0.1);
  }

  .accuracy-card.fair {
    border-color: var(--desktop-progress-fair);
    background: rgba(255, 165, 0, 0.1);
  }

  .accuracy-card.poor {
    border-color: var(--desktop-progress-poor);
    background: rgba(255, 0, 0, 0.1);
  }

  .streak-section {
    display: flex;
    justify-content: center;
  }

  .streak-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      var(--semantic-warning) 100%
    );
    color: #000000;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.875rem;
    box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
  }

  .streak-icon {
    font-size: 1rem;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .detailed-stats {
      padding: 1rem;
      gap: 1rem;
    }

    .stat-card {
      padding: 0.75rem;
    }

    .stat-card .stat-value {
      font-size: 1.125rem;
    }
  }

  @media (max-width: 480px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }

    .compact-stats {
      font-size: 0.75rem;
    }

    .compact .stat-value {
      font-size: 1rem;
    }
  }
</style>
