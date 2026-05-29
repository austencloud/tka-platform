<!-- LessonWorkspaceView.svelte - Enhanced lesson workspace with full functionality -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import QuizTimer from "./QuizTimer.svelte";
  import { onDestroy, onMount } from "svelte";

  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import { getQuizSessionManager } from "$lib/features/learn/quiz/get-quiz-session-manager";

  import LetterToPictographQuiz from "./LetterToPictographQuiz.svelte";
  import PictographToLetterQuiz from "./PictographToLetterQuiz.svelte";
  import ValidNextPictographQuiz from "./ValidNextPictographQuiz.svelte";
  import SequenceToWordQuiz from "./SequenceToWordQuiz.svelte";
  import { QuizMode, QuizType } from "../domain/enums/quiz-enums";
  import type { QuizLayoutMode } from "../domain/enums/quiz-enums";
  import type { QuizResults, QuizProgress, QuizAnswerEvent } from "../domain/models/quiz-models";
  import { getFormattedQuizTitle, getQuizModeName, getQuizTime } from "../services/quiz-configurator";
  import type { QuizSessionManager } from "../services/quiz-session-manager";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  // Props
  let {
    quizId = null,
    quizType = null,
    quizMode = null,
    questionIndex = 0,
    onBackToSelector,
    onQuizComplete,
    onAnswerSubmit,
  } = $props<{
    quizId?: string | null;
    quizType?: QuizType | null;
    quizMode?: QuizMode | null;
    layoutMode?: QuizLayoutMode;
    questionIndex?: number;
    onBackToSelector?: () => void;
    onQuizComplete?: (results: QuizResults) => void;
    onAnswerSubmit?: (event: QuizAnswerEvent) => void;
  }>();

  // State
  let sessionId: string | null = null;
  let progress: QuizProgress | null = $state(null);
  let timeRemaining = $state(0);
  let isLoading = $state(false);
  let isPaused = $state(false);
  let hasStarted = $state(false);
  let correctAnswers = $state(0);
  let totalQuestions = $state(0);

  // Component references
  let timerComponent = $state<QuizTimer>();

  // Services
  const hapticService = getHapticFeedback();
  const quizSessionService = getQuizSessionManager();

  // Derived state
  const isCountdownMode = $derived(quizMode === QuizMode.COUNTDOWN);
  const isFixedQuestionMode = $derived(quizMode === QuizMode.FIXED_QUESTION);

  // Lifecycle
  onMount(() => {
    if (quizType && quizMode) {
      startQuiz();
    }
  });

  onDestroy(() => {
    if (sessionId) {
      quizSessionService.abandonSession(sessionId);
    }
  });

  // Methods
  function startQuiz() {
    if (!quizType || !quizMode) return;

    isLoading = true;

    // Create quiz session
    sessionId = quizSessionService.createSession(quizType, quizMode);

    // Set up timer for countdown mode
    if (isCountdownMode) {
      timeRemaining = getQuizTime(quizMode);
      if (timerComponent) {
        timerComponent.start();
      }
    }

    // Initialize state
    correctAnswers = 0;
    totalQuestions = 0;
    updateProgress();
    hasStarted = true;

    isLoading = false;
  }

  function handleAnswerSubmit(event: QuizAnswerEvent) {
    totalQuestions++;
    if (event.isCorrect) {
      correctAnswers++;
    }

    if (sessionId) {
      quizSessionService.updateSessionProgress(sessionId, event.isCorrect, 0);
      updateProgress();
    }

    // Propagate the full event upstream for persistence and gap detection
    onAnswerSubmit?.(event);

    // Check if quiz should continue
    if (!shouldContinueQuiz()) {
      completeQuiz();
    }
  }

  function handleNextQuestion() {
    // Quiz components handle their own question generation
    // This is just for any additional logic needed between questions
  }

  function shouldContinueQuiz(): boolean {
    if (!sessionId) return false;

    const session = quizSessionService.getSession(sessionId);
    if (!session || !session.isActive) return false;

    if (isFixedQuestionMode) {
      return session.questionsAnswered < session.totalQuestions;
    } else if (isCountdownMode) {
      return timeRemaining > 0;
    }

    return false;
  }

  function updateProgress() {
    if (!sessionId) return;
    const session = quizSessionService.getSession(sessionId);
    if (session) {
      progress = {
        questionsAnswered: session.questionsAnswered,
        correctAnswers: session.correctAnswers,
        incorrectAnswers: session.incorrectGuesses,
        currentQuestion: session.currentQuestion,
        totalQuestions: session.totalQuestions,
        timeElapsed: 0,
        streakCurrent: 0,
        streakLongest: 0,
      };
    }
  }

  function handleTimerTick(data: { timeRemaining: number }) {
    timeRemaining = data.timeRemaining;
  }

  function handleTimeUp() {
    completeQuiz();
  }

  function completeQuiz() {
    if (!sessionId) return;

    const results = quizSessionService.completeSession(sessionId);
    if (results) {
      onQuizComplete?.(results);
    }
  }

  function handleBackClick() {
    // Trigger navigation haptic for back action
    hapticService?.trigger("selection");

    if (sessionId) {
      quizSessionService.abandonSession(sessionId);
    }
    onBackToSelector?.();
  }

  // Quiz control handlers
  function handlePauseClicked() {
    // Trigger selection haptic for pause
    hapticService?.trigger("selection");

    isPaused = true;
    if (timerComponent) {
      timerComponent.pause();
    }
  }

  function handleResumeClicked() {
    // Trigger selection haptic for resume
    hapticService?.trigger("selection");

    isPaused = false;
    if (timerComponent) {
      timerComponent.resume();
    }
  }

  function handleRestartClicked() {
    // Trigger navigation haptic for restart
    hapticService?.trigger("selection");

    if (sessionId) {
      quizSessionService.abandonSession(sessionId);
    }
    // Restart the quiz
    startQuiz();
  }

  function formatQuizTitle(): string {
    if (!quizType) return "Unknown Quiz";
    return getFormattedQuizTitle(quizType);
  }

  function getQuizModeDisplay(): string {
    if (!quizMode) return "Unknown Mode";
    return getQuizModeName(quizMode);
  }
</script>

<div class="quiz-workspace">
  {#if isLoading}
    <div class="loading-screen">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
      <p>Starting quiz...</p>
    </div>
  {:else}
    <!-- Main Content -->
    <div class="workspace-content">
      {#if quizType === QuizType.PICTOGRAPH_TO_LETTER}
        <PictographToLetterQuiz
          onAnswerSubmit={handleAnswerSubmit}
          onNextQuestion={handleNextQuestion}
          onBack={handleBackClick}
        />
      {:else if quizType === QuizType.LETTER_TO_PICTOGRAPH}
        <LetterToPictographQuiz
          onAnswerSubmit={handleAnswerSubmit}
          onNextQuestion={handleNextQuestion}
          onBack={handleBackClick}
        />
      {:else if quizType === QuizType.VALID_NEXT_PICTOGRAPH}
        <ValidNextPictographQuiz
          onAnswerSubmit={handleAnswerSubmit}
          onNextQuestion={handleNextQuestion}
          onBack={handleBackClick}
        />
      {:else if quizType === QuizType.SEQUENCE_TO_WORD}
        <SequenceToWordQuiz
          onAnswerSubmit={handleAnswerSubmit}
          onNextQuestion={handleNextQuestion}
          onBack={handleBackClick}
        />
      {:else}
        <div class="no-question">
          <p>No quiz selected</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .quiz-workspace {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    padding: 0;
  }

  .workspace-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: auto;
    padding: 0;
  }

  .no-question {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: var(--theme-card-bg);
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text-muted, #94a3b8);
    font-size: 1.125rem;
  }

  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
    color: var(--theme-text, #ffffff);
  }

</style>
