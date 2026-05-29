<!--
Quiz Tab - Interactive quiz system

Provides quiz functionality for learning TKA notation:
- Quiz selection and progress tracking
- Interactive quizzes with pictograph recognition
- Progress tracking and results
- Codex integration for reference
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onDestroy, onMount } from "svelte";
  import type { Codex } from "../../codex/services/codex";
  import { QuizMode, QuizType } from "../domain/enums/quiz-enums";
  import type { QuizProgress, QuizAnswerEvent } from "../domain/models/quiz-models";
  import type { QuizRepoManager } from "../services/quiz-repo-manager";
  import type { QuizSessionManager } from "../services/quiz-session-manager";
  import type { DetectedGap } from "../../services/types";
  import { getEffectiveUserId } from "$lib/shared/auth/state/authState.svelte";
  import * as QuestionGenerator from "../services/question-generator";
  import QuizResultsView from "./QuizResultsView.svelte";
  import QuizSelectorView from "./QuizSelectorView.svelte";
  import QuizWorkspaceView from "./QuizWorkspaceView.svelte";
  import StreakDisplay from "./StreakDisplay.svelte";
  import { getDelightOrchestrator } from "$lib/shared/delight/context/delight-context";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { getCodex } from "$lib/features/learn/codex/get-codex";
  import { getQuizRepoManager } from "$lib/features/learn/quiz/get-quiz-repo-manager";
  import { getQuizSessionManager } from "$lib/features/learn/quiz/get-quiz-session-manager";
  import * as quizHistoryRecorderModule from "$lib/features/learn/services/quiz-history-recorder";
  import * as letterToConceptMapperModule from "$lib/features/learn/services/letter-to-concept-mapper";
  import { analyzeErrors } from "$lib/features/learn/services/gap-detector";

  // Import learn components

  // ============================================================================
  // SERVICE RESOLUTION - Resolved via module singleton getters
  // ============================================================================

  const codexService = getCodex();
  const quizRepo = getQuizRepoManager();
  const quizSessionService = getQuizSessionManager();
  const hapticService = getHapticFeedback();
  const quizHistoryRecorder = quizHistoryRecorderModule;
  const letterToConceptMapper = letterToConceptMapperModule;
  const delightOrchestrator = getDelightOrchestrator();

  // Component refs
  let streakDisplayRef = $state<StreakDisplay | null>(null);

  // ============================================================================
  // COMPONENT STATE
  // ============================================================================

  const DEV_PERSIST_KEY = "quiz-dev-state";

  function loadDevState() {
    if (!import.meta.hot) return null;
    try {
      const raw = sessionStorage.getItem(DEV_PERSIST_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  const devState = loadDevState();

  let currentView = $state<"selector" | "workspace" | "results">(devState?.view ?? "selector");
  let selectedQuizId = $state<string | null>(devState?.quizId ?? null);
  let selectedQuizType = $state<QuizType | null>(devState?.quizType ?? null);
  let selectedQuizMode = $state<QuizMode | null>(devState?.quizMode ?? null);
  let currentQuestionIndex = $state(0);
  let totalQuestions = $state(10);
  let score = $state(0);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Accumulate answer events for persistence and gap detection
  let sessionAnswers = $state<QuizAnswerEvent[]>([]);
  let detectedGaps = $state<DetectedGap[]>([]);

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
      await QuestionGenerator.initialize();

      // Convert the quiz type to a quiz ID
      const quizId = `${data.quizType}_${data.quizMode}`;
      selectedQuizId = quizId;
      await quizSessionService.startQuiz(quizId);
      const sessionData = quizSessionService.getCurrentSession();
      totalQuestions = sessionData?.totalQuestions || 10;
      currentQuestionIndex = 0;
      score = 0;

      // Reset session answers, gaps, and progress
      sessionAnswers = [];
      detectedGaps = [];
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

  async function handleAnswerSubmit(event: QuizAnswerEvent) {
    if (!quizSessionService) return;

    try {
      const isCorrect = await quizSessionService.submitAnswer(event.isCorrect);
      if (isCorrect) score++;

      // Accumulate for persistence and gap detection
      sessionAnswers.push(event);

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

      // Analyze wrong answers for misconception patterns
      const wrongAnswers = sessionAnswers.filter((a) => !a.isCorrect);
      if (wrongAnswers.length > 0) {
        detectedGaps = analyzeErrors(wrongAnswers);
      }

      currentView = "results";

      // Record daily activity for streak tracking
      await streakDisplayRef?.recordActivity();

      // Persist quiz attempt to Firestore (fire-and-forget)
      persistQuizAttempt();
    } catch (err) {
      console.error("❌ QuizTab: Failed to complete quiz:", err);
      error = err instanceof Error ? err.message : "Failed to complete quiz";
    }
  }

  function persistQuizAttempt() {
    const userId = getEffectiveUserId();
    if (!userId || userId === "anonymous") return;
    if (!selectedQuizType) return;

    const conceptId = letterToConceptMapper.getConceptId(
      selectedQuizType === QuizType.PICTOGRAPH_TO_LETTER ? "A" : "A"
    ) ?? selectedQuizType;

    const wrongAnswers = sessionAnswers
      .filter((a) => !a.isCorrect)
      .map((a) => ({
        selectedContent: a.selectedContent,
        correctContent: a.correctContent,
        quizType: a.quizType,
        answeredAt: a.answeredAt.toISOString(),
      }));

    quizHistoryRecorder
      .recordAttempt(userId, {
        conceptId,
        quizType: selectedQuizType,
        score: totalQuestions > 0 ? (score / totalQuestions) * 100 : 0,
        correctCount: score,
        totalCount: totalQuestions,
        timeSpentSeconds: 0,
        timestamp: new Date(),
        wrongAnswers: wrongAnswers.length > 0 ? wrongAnswers : undefined,
      })
      .catch((err) => {
        console.warn("[QuizTab] Failed to persist quiz attempt:", err);
      });
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

  $effect(() => {
    if (!import.meta.hot) return;
    const state = { view: currentView, quizId: selectedQuizId, quizType: selectedQuizType, quizMode: selectedQuizMode };
    try { sessionStorage.setItem(DEV_PERSIST_KEY, JSON.stringify(state)); } catch {}
  });

  onMount(async () => {
    try {
      isLoading = true;

      // Initialize quiz repository
      await quizRepo.initialize();

      // Load available quizzes
      quizRepo.getAllQuizTypes();

      if (devState?.view === "workspace" && devState.quizType && devState.quizMode) {
        await QuestionGenerator.initialize();
        const quizId = `${devState.quizType}_${devState.quizMode}`;
        selectedQuizId = quizId;
        await quizSessionService.startQuiz(quizId);
      }
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
      <button onclick={() => (error = null)} aria-label="Dismiss error">×</button>
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
          onAnswerSubmit={(event) => handleAnswerSubmit(event)}
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
          {detectedGaps}
          onReturnToSelector={handleReturnToSelector}
          onRestartQuiz={handleRestartQuiz}
        />
      {/if}
    </div>
  </div>

  <!-- Loading overlay -->
  {#if isLoading}
    <div class="loading-overlay">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
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
    width: var(--min-touch-target);
    height: var(--min-touch-target);
  }

  .header-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .header-back-btn:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
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
    background: var(--semantic-error, #ff4444);
    color: var(--theme-text, #ffffff);
    padding: 0.5rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .error-banner button {
    background: none;
    border: none;
    color: var(--theme-text, #ffffff);
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
    background: color-mix(in srgb, var(--theme-panel-bg) 80%, transparent);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    z-index: var(--z-modal);
    color: var(--foreground, #ffffff);
  }

</style>
