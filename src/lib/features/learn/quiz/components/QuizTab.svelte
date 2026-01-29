<!--
Quiz Tab - Interactive quiz system

Provides quiz functionality for learning TKA notation:
- Quiz selection and progress tracking
- Interactive quizzes with pictograph recognition
- Progress tracking and results
- Codex integration for reference
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onDestroy, onMount } from "svelte";
  import type { ICodex } from "../../codex/services/contracts/ICodex";
  import { QuizMode, QuizType } from "../domain/enums/quiz-enums";
  import type { QuizProgress } from "../domain/models/quiz-models";
  import type { IQuizRepoManager } from "../services/contracts/IQuizRepository";
  import type { IQuizSessionManager } from "../services/contracts/IQuizSessionManager";
  import { QuestionGeneratorService } from "../services/implementations/QuestionGenerator";
  import QuizResultsView from "./QuizResultsView.svelte";
  import QuizSelectorView from "./QuizSelectorView.svelte";
  import QuizWorkspaceView from "./QuizWorkspaceView.svelte";
  import StreakDisplay from "./StreakDisplay.svelte";
  import { getDelightOrchestrator } from "$lib/shared/delight/context/delight-context";

  // Import learn components

  // ============================================================================
  // SERVICE RESOLUTION - Resolved from ITI container
  // ============================================================================

  const codexService = container.items.codex;
  const quizRepo = container.items.quizRepoManager;
  const quizSessionService = container.items.quizSessionManager;
  const hapticService = container.items.hapticFeedback;
  const delightOrchestrator = getDelightOrchestrator();

  // Component refs
  let streakDisplayRef = $state<StreakDisplay | null>(null);

  // ============================================================================
  // COMPONENT STATE
  // ============================================================================

  let currentView = $state<"selector" | "workspace" | "results">("selector");
  let selectedQuizId = $state<string | null>(null);
  let selectedQuizType = $state<QuizType | null>(null);
  let selectedQuizMode = $state<QuizMode | null>(null);
  let currentQuestionIndex = $state(0);
  let totalQuestions = $state(10);
  let score = $state(0);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Progress tracking state
  let progress = $state<QuizProgress>({
    currentQuestion: 1,
    totalQuestions: 10,
    correctAnswers: 0,
    incorrectAnswers: 0,
    questionsAnswered: 0,
    timeElapsed: 0,
    streakCurrent: 0,
    streakLongest: 0,
  });

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  async function handleQuizSelect(data: {
    quizType: QuizType;
    quizMode: QuizMode;
  }) {
    if (!quizSessionService) return;

    // Trigger selection haptic for quiz selection
    hapticService?.trigger("selection");

    try {
      isLoading = true;
      // Store the quiz type and quiz mode
      selectedQuizType = data.quizType;
      selectedQuizMode = data.quizMode;

      // Initialize the question generator service with pictograph data
      await QuestionGeneratorService.initialize();

      // Convert the quiz type to a quiz ID
      const quizId = `${data.quizType}_${data.quizMode}`;
      selectedQuizId = quizId;
      await quizSessionService.startQuiz(quizId);
      const sessionData = quizSessionService.getCurrentSession();
      totalQuestions = sessionData?.totalQuestions || 10;
      currentQuestionIndex = 0;
      score = 0;

      // Reset progress
      progress.currentQuestion = 1;
      progress.totalQuestions = totalQuestions;
      progress.correctAnswers = 0;
      progress.incorrectAnswers = 0;
      progress.questionsAnswered = 0;
      progress.timeElapsed = 0;
      progress.streakCurrent = 0;
      progress.streakLongest = 0;

      currentView = "workspace";
    } catch (err) {
      console.error("❌ QuizTab: Failed to start quiz:", err);
      error = err instanceof Error ? err.message : "Failed to start quiz";
    } finally {
      isLoading = false;
    }
  }

  async function handleAnswerSubmit(answer: any) {
    if (!quizSessionService) return;

    try {
      const isCorrect = await quizSessionService.submitAnswer(answer);
      if (isCorrect) score++;

      // Update progress
      progress.questionsAnswered++;
      progress.correctAnswers = score;
      progress.incorrectAnswers = progress.questionsAnswered - score;
      progress.currentQuestion = currentQuestionIndex + 1;

      if (currentQuestionIndex < totalQuestions - 1) {
        currentQuestionIndex++;
      } else {
        currentView = "results";
      }
    } catch (err) {
      console.error("❌ QuizTab: Failed to submit answer:", err);
      error = err instanceof Error ? err.message : "Failed to submit answer";
    }
  }

  async function handleQuizComplete() {
    if (!quizSessionService) return;

    try {
      await quizSessionService.completeQuiz();
      currentView = "results";

      // Record daily activity for streak tracking
      await streakDisplayRef?.recordActivity();
    } catch (err) {
      console.error("❌ QuizTab: Failed to complete quiz:", err);
      error = err instanceof Error ? err.message : "Failed to complete quiz";
    }
  }

  function handleStreakMilestone(streak: number) {
    // Trigger major celebration for streak milestones
    delightOrchestrator?.celebrate('streak-milestone', {
      toastMessage: `${streak} day streak! 🔥`
    });
  }

  function handleReturnToSelector() {
    // Trigger navigation haptic for returning to selector
    hapticService?.trigger("selection");

    currentView = "selector";
    selectedQuizId = null;
    currentQuestionIndex = 0;
    score = 0;
    error = null;
  }

  async function handleRestartQuiz() {
    if (!quizSessionService) return;

    // Trigger navigation haptic for restart
    hapticService?.trigger("selection");

    try {
      isLoading = true;
      await quizSessionService.restartQuiz();
      currentView = "workspace";
      currentQuestionIndex = 0;
      score = 0;
      error = null;
    } catch (err) {
      console.error("❌ QuizTab: Failed to restart quiz:", err);
      error = err instanceof Error ? err.message : "Failed to restart quiz";
    } finally {
      isLoading = false;
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(async () => {
    try {
      isLoading = true;

      // Initialize quiz repository
      await quizRepo.initialize();

      // Load available quizzes
      quizRepo.getAllQuizTypes();
    } catch (err) {
      console.error("❌ QuizTab: Initialization failed:", err);
      error =
        err instanceof Error ? err.message : "Failed to initialize quiz tab";
    } finally {
      isLoading = false;
    }
  });

  onDestroy(() => {
    quizSessionService?.cleanup();
  });
</script>

<!-- ============================================================================ -->
<!-- TEMPLATE -->
<!-- ============================================================================ -->

<div class="learn-tab" data-testid="learn-tab">
  <!-- Unified header with back button + streak -->
  <div class="quiz-header">
    {#if currentView === "workspace"}
      <button
        class="header-back-btn"
        onclick={handleReturnToSelector}
        aria-label="Back to quiz selector"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
    {:else}
      <div class="header-spacer"></div>
    {/if}
    <StreakDisplay
      bind:this={streakDisplayRef}
      onStreakMilestone={handleStreakMilestone}
    />
  </div>

  <!-- Error display -->
  {#if error}
    <div class="error-banner">
      <span>{error}</span>
      <button onclick={() => (error = null)}>×</button>
    </div>
  {/if}

  <div class="learn-layout">
    <!-- Main Content Area -->
    <div class="content-area">
      {#if currentView === "selector"}
        <QuizSelectorView onQuizSelect={handleQuizSelect} />
      {:else if currentView === "workspace"}
        <QuizWorkspaceView
          quizId={selectedQuizId}
          quizType={selectedQuizType}
          quizMode={selectedQuizMode}
          questionIndex={currentQuestionIndex}
          onAnswerSubmit={handleAnswerSubmit}
          onQuizComplete={handleQuizComplete}
          onBackToSelector={handleReturnToSelector}
        />
      {:else if currentView === "results"}
        <QuizResultsView
          results={{
            sessionId: selectedQuizId || "",
            lessonType: selectedQuizType || QuizType.PICTOGRAPH_TO_LETTER,
            quizMode: selectedQuizMode || QuizMode.FIXED_QUESTION,
            totalQuestions,
            correctAnswers: score,
            incorrectGuesses: totalQuestions - score,
            questionsAnswered: totalQuestions,
            accuracyPercentage:
              totalQuestions > 0 ? (score / totalQuestions) * 100 : 0,
            completionTimeSeconds: 0,
            completedAt: new Date(),
          }}
          onReturnToSelector={handleReturnToSelector}
          onRestartQuiz={handleRestartQuiz}
        />
      {/if}
    </div>
  </div>

  <!-- Loading overlay -->
  {#if isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>Loading quiz...</span>
    </div>
  {/if}
</div>

<!-- ============================================================================ -->
<!-- STYLES -->
<!-- ============================================================================ -->

<style>
  .learn-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;
    background: transparent;
    color: var(--foreground, #ffffff);
  }

  .quiz-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    flex-shrink: 0;
    min-height: 56px;
  }

  .header-spacer {
    width: 48px;
    height: 48px;
  }

  .header-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .header-back-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: var(--theme-text, #ffffff);
    transform: translateX(-2px);
  }

  .header-back-btn:active {
    transform: translateX(-1px) scale(0.98);
  }

  .learn-layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .error-banner {
    background: var(--color-error, #ff4444);
    color: white;
    padding: 0.5rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .error-banner button {
    background: none;
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
  }

  .content-area {
    flex: 1;
    overflow: hidden;
    padding: 0;
    background: transparent;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    z-index: 1000;
    color: var(--foreground, #ffffff);
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top: 2px solid var(--foreground, #ffffff);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
