<!--
Valid Next Pictograph Quiz - Shows a pictograph and asks which can follow it
The next pictograph's start position must match the initial pictograph's end position.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { detectSingleError } from "$lib/features/learn/services/gap-detector";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import { onDestroy, onMount } from "svelte";
  import * as QuestionGenerator from "../services/question-generator";
  import { QuizType } from "../domain/enums/quiz-enums";
  import type { QuizQuestionData, QuizAnswerEvent } from "../domain/models/quiz-models";
  import QuizContainer from "./shared/QuizContainer.svelte";
  import QuizBackButton from "./shared/QuizBackButton.svelte";
  import QuizLoadingState from "./shared/QuizLoadingState.svelte";
  import QuizErrorState from "./shared/QuizErrorState.svelte";
  import QuizPrompt from "./shared/QuizPrompt.svelte";
  import QuizPictographCard from "./shared/QuizPictographCard.svelte";
  import QuizPictographButton from "./shared/QuizPictographButton.svelte";
  import QuizFeedbackBanner from "./shared/QuizFeedbackBanner.svelte";
  import MisconceptionHint from "./shared/MisconceptionHint.svelte";
import type { DetectedGap } from "../../services/types";

  let { onAnswerSubmit, onNextQuestion, onBack } = $props<{
    onAnswerSubmit?: (event: QuizAnswerEvent) => void;
    onNextQuestion?: () => void;
    onBack?: () => void;
  }>();

  let hapticService: HapticFeedback;

  let hapticTimer: ReturnType<typeof setTimeout> | null = null;
  let nextQuestionTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (hapticTimer !== null) clearTimeout(hapticTimer);
    if (nextQuestionTimer !== null) clearTimeout(nextQuestionTimer);
  });

  let questionData = $state<QuizQuestionData | null>(null);
  let selectedAnswerId = $state<string | null>(null);
  let isAnswered = $state(false);
  let showFeedback = $state(false);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let questionKey = $state(0);
  let currentGap = $state<DetectedGap | null>(null);

  let currentPictograph = $derived(
    questionData?.questionContent as PictographData | null
  );
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
        QuizType.VALID_NEXT_PICTOGRAPH
      );
      questionKey++;
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
        quizType: QuizType.VALID_NEXT_PICTOGRAPH,
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
        quizType: QuizType.VALID_NEXT_PICTOGRAPH,
        answeredAt: new Date(),
      });
    }
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
    {#if onBack}<QuizBackButton onclick={onBack} />{/if}
    <QuizLoadingState />
  </QuizContainer>
{:else if error}
  <QuizContainer>
    {#if onBack}<QuizBackButton onclick={onBack} />{/if}
    <QuizErrorState {error} onRetry={loadQuestion} />
  </QuizContainer>
{:else if questionData && currentPictograph}
  <QuizContainer>
    {#if onBack}<QuizBackButton onclick={onBack} />{/if}
    <QuizPrompt text="Which pictograph can follow this one?" />

    <div class="quiz-content">
      {#key questionKey}
        <QuizPictographCard pictograph={currentPictograph} showArrow={true} />
      {/key}

      <div class="answer-section">
        <div class="answer-grid">
          {#each questionData.answerOptions as option (option.id)}
            <QuizPictographButton
              pictograph={option.content as PictographData}
              state={getButtonState(option.id, option.isCorrect)}
              disabled={isAnswered}
              onclick={() => handleAnswerClick(option.id, option.isCorrect)}
            />
          {/each}
        </div>

        {#if showFeedback}
          <QuizFeedbackBanner
            isCorrect={isCorrectAnswer}
            correctMessage="Correct!"
            incorrectMessage=""
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
    gap: 0.75rem;
    width: 100%;
    max-width: 320px;
  }

  .answer-section {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .answer-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    width: 100%;
  }

  @media (min-width: 600px) {
    .quiz-content {
      max-width: 380px;
      gap: 1rem;
    }

    .answer-grid {
      gap: 0.75rem;
    }
  }

  @media (min-width: 900px) {
    .quiz-content {
      max-width: 440px;
      gap: 1.25rem;
    }

    .answer-grid {
      gap: 1rem;
    }
  }

  @media (min-width: 1200px) {
    .quiz-content {
      max-width: 500px;
      gap: 1.5rem;
    }
  }
</style>
