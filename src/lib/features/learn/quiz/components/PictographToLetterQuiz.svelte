<!--
Pictograph to Letter Quiz - Shows a pictograph, asks user to identify the letter
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { detectSingleError } from "$lib/features/learn/services/gap-detector";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onDestroy, onMount } from "svelte";
  import * as QuestionGenerator from "../services/question-generator";
  import { QuizType } from "../domain/enums/quiz-enums";
  import type { QuizQuestionData, QuizAnswerEvent } from "../domain/models/quiz-models";
  import QuizContainer from "./shared/QuizContainer.svelte";
  import QuizLoadingState from "./shared/QuizLoadingState.svelte";
  import QuizErrorState from "./shared/QuizErrorState.svelte";
  import QuizPrompt from "./shared/QuizPrompt.svelte";
  import QuizPictographCard from "./shared/QuizPictographCard.svelte";
  import QuizLetterButton from "./shared/QuizLetterButton.svelte";
  import QuizFeedbackBanner from "./shared/QuizFeedbackBanner.svelte";
  import MisconceptionHint from "./shared/MisconceptionHint.svelte";
  import ScorePopAnimation from "./shared/ScorePopAnimation.svelte";
  import { getDelightOrchestrator } from "$lib/shared/delight/context/delight-context";
import type { DetectedGap } from "../../services/types";

  let { onAnswerSubmit, onNextQuestion, onBack } = $props<{
    onAnswerSubmit?: (event: QuizAnswerEvent) => void;
    onNextQuestion?: () => void;
    onBack?: () => void;
  }>();

  let hapticService: HapticFeedback;
  const delightOrchestrator = getDelightOrchestrator();

  let scorePopTimer: ReturnType<typeof setTimeout> | null = null;
  let hapticTimer: ReturnType<typeof setTimeout> | null = null;
  let nextQuestionTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (scorePopTimer !== null) clearTimeout(scorePopTimer);
    if (hapticTimer !== null) clearTimeout(hapticTimer);
    if (nextQuestionTimer !== null) clearTimeout(nextQuestionTimer);
  });

  let questionData = $state<QuizQuestionData | null>(null);
  let selectedAnswerId = $state<string | null>(null);
  let isAnswered = $state(false);
  let showFeedback = $state(false);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Streak tracking within session
  let currentStreak = $state(0);
  let showScorePop = $state(false);

  // Misconception hint state
  let currentGap = $state<DetectedGap | null>(null);

  // Fixed answer slots - using indices keeps components persistent for smooth transitions
  const answerSlots = [0, 1, 2, 3];

  let currentPictograph = $derived(
    questionData?.questionContent as PictographData | null
  );
  let correctAnswer = $derived(questionData?.correctAnswer as string);
  let isCorrectAnswer = $derived(
    selectedAnswerId
      ? (questionData?.answerOptions.find((o) => o.id === selectedAnswerId)
          ?.isCorrect ?? false)
      : false
  );

  onMount(async () => {
    hapticService = getHapticFeedback();
    await loadQuestion();
  });

  async function loadQuestion() {
    isLoading = true;
    error = null;
    try {
      questionData = await QuestionGenerator.generateQuestion(
        QuizType.PICTOGRAPH_TO_LETTER
      );
    } catch (err) {
      console.error("Failed to load question:", err);
      error = err instanceof Error ? err.message : "Failed to load question";
    } finally {
      isLoading = false;
    }
  }

  function handleAnswerClick(optionId: string, isCorrect: boolean) {
    if (isAnswered) return;
    hapticService?.trigger("selection");
    selectedAnswerId = optionId;
    isAnswered = true;
    showFeedback = true;

    // Update streak and show animations
    if (isCorrect) {
      currentStreak++;
      showScorePop = true;

      // Mini confetti for streak of 3+
      if (currentStreak >= 3 && currentStreak % 3 === 0) {
        delightOrchestrator?.celebrate("answer-correct", {
          confettiAmount: 15
        });
      }

      scorePopTimer = setTimeout(() => {
        showScorePop = false;
      }, 800);
    } else {
      currentStreak = 0;
    }

    // Detect misconception gap on wrong answers
    currentGap = null;
    if (!isCorrect && questionData) {
      const selectedOption = questionData.answerOptions.find((o) => o.id === optionId);
      const correctOption = questionData.answerOptions.find((o) => o.isCorrect);
      const gap = detectSingleError({
        isCorrect: false,
        questionData,
        selectedOptionId: optionId,
        selectedContent: selectedOption?.content ?? null,
        correctContent: correctOption?.content ?? null,
        quizType: QuizType.PICTOGRAPH_TO_LETTER,
        answeredAt: new Date(),
      });
      if (gap) {
        currentGap = gap;
      }
    }

    hapticTimer = setTimeout(() => {
      hapticService?.trigger(isCorrect ? "success" : "error");
    }, 100);

    if (questionData) {
      const selectedOption = questionData.answerOptions.find((o) => o.id === optionId);
      const correctOption = questionData.answerOptions.find((o) => o.isCorrect);
      onAnswerSubmit?.({
        isCorrect,
        questionData,
        selectedOptionId: optionId,
        selectedContent: selectedOption?.content ?? null,
        correctContent: correctOption?.content ?? null,
        quizType: QuizType.PICTOGRAPH_TO_LETTER,
        answeredAt: new Date(),
      });
    }
    // Give extra time when a misconception hint is showing so the user can read it
    const feedbackDuration = currentGap ? 5000 : 1200;
    nextQuestionTimer = setTimeout(handleNextQuestion, feedbackDuration);
  }

  async function handleNextQuestion() {
    selectedAnswerId = null;
    isAnswered = false;
    showFeedback = false;
    currentGap = null;
    await loadQuestion();
    onNextQuestion?.();
  }

  function getButtonState(
    optionId: string,
    isCorrect: boolean
  ): "default" | "correct" | "incorrect" | "dimmed" {
    if (!isAnswered) return "default";
    if (isCorrect) return "correct";
    if (selectedAnswerId === optionId) return "incorrect";
    return "dimmed";
  }
</script>

{#if isLoading}
  <QuizContainer>
    <QuizLoadingState />
  </QuizContainer>
{:else if error}
  <QuizContainer>
    <QuizErrorState {error} onRetry={loadQuestion} />
  </QuizContainer>
{:else if questionData && currentPictograph}
  <QuizContainer>
    <QuizPrompt text="What letter does this pictograph represent?" />

    <div class="quiz-content">
      <!-- Pictograph card - arrows/props animate smoothly when data changes -->
      <QuizPictographCard pictograph={currentPictograph} />

      <div class="answer-section">
        <div class="answer-grid">
          <!-- Use fixed slot indices as keys so letter buttons persist -->
          {#each answerSlots as slotIndex (slotIndex)}
            {@const option = questionData.answerOptions[slotIndex]}
            {#if option}
              <QuizLetterButton
                letter={option.content as string}
                state={getButtonState(option.id, option.isCorrect)}
                disabled={isAnswered}
                onclick={() => handleAnswerClick(option.id, option.isCorrect)}
              />
            {/if}
          {/each}
        </div>

        <!-- Score pop animation -->
        <ScorePopAnimation
          visible={showScorePop}
          score={1}
          streakCount={currentStreak}
        />

        {#if showFeedback}
          <QuizFeedbackBanner
            isCorrect={isCorrectAnswer}
            correctMessage={`Correct! This is "${correctAnswer}"`}
            incorrectMessage={`The correct letter is "${correctAnswer}"`}
            streakCount={currentStreak}
          />
          {#if currentGap}
            <MisconceptionHint gap={currentGap} />
          {/if}
        {/if}
      </div>
    </div>
  </QuizContainer>
{/if}

<style>
  .quiz-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    width: 100%;
    max-width: 360px;
  }

  .answer-section {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .answer-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(60px, 80px));
    justify-content: center;
    gap: 0.625rem;
  }

  @media (min-width: 600px) {
    .quiz-content {
      max-width: 420px;
      gap: 2rem;
    }

    .answer-grid {
      grid-template-columns: repeat(2, minmax(70px, 100px));
      gap: 0.875rem;
    }
  }

  @media (min-width: 900px) {
    .quiz-content {
      max-width: 480px;
      gap: 2.5rem;
    }

    .answer-grid {
      grid-template-columns: repeat(2, minmax(90px, 120px));
      gap: 1rem;
    }
  }

  @media (min-width: 1200px) {
    .quiz-content {
      max-width: 520px;
    }

    .answer-grid {
      grid-template-columns: repeat(2, minmax(100px, 140px));
    }
  }
</style>
