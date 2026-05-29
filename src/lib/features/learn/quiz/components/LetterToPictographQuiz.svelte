<!--
Letter to Pictograph Quiz - Shows a letter, asks user to identify the correct pictograph
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
  import QuizLoadingState from "./shared/QuizLoadingState.svelte";
  import QuizErrorState from "./shared/QuizErrorState.svelte";
  import QuizPrompt from "./shared/QuizPrompt.svelte";
  import QuizGlyphCard from "./shared/QuizGlyphCard.svelte";
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
  let currentGap = $state<DetectedGap | null>(null);

  let questionLetter = $derived(questionData?.questionContent as string);

  // Fixed answer slots (4 buttons) - using indices as keys keeps components persistent
  // so arrows/props animate smoothly when pictograph data changes
  const answerSlots = [0, 1, 2, 3];
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
        QuizType.LETTER_TO_PICTOGRAPH
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
        quizType: QuizType.LETTER_TO_PICTOGRAPH,
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
        quizType: QuizType.LETTER_TO_PICTOGRAPH,
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
    <QuizLoadingState />
  </QuizContainer>
{:else if error}
  <QuizContainer>
    <QuizErrorState {error} onRetry={loadQuestion} />
  </QuizContainer>
{:else if questionData && questionLetter}
  <QuizContainer>
    <QuizPrompt text="Which pictograph contains this glyph?" />

    <div class="quiz-content">
      <!-- Glyph card handles its own crossfade transitions -->
      <QuizGlyphCard letter={questionLetter} />

      <div class="answer-section">
        <div class="answer-grid">
          <!-- Use fixed slot indices as keys so components persist and arrows/props animate -->
          {#each answerSlots as slotIndex (slotIndex)}
            {@const option = questionData.answerOptions[slotIndex]}
            {#if option}
              <QuizPictographButton
                pictograph={option.content as PictographData}
                state={getButtonState(option.id, option.isCorrect)}
                disabled={isAnswered}
                showTKA={isAnswered}
                onclick={() => handleAnswerClick(option.id, option.isCorrect)}
              />
            {/if}
          {/each}
        </div>

        {#if showFeedback}
          <QuizFeedbackBanner
            isCorrect={isCorrectAnswer}
            correctMessage={`Correct! That's "${questionLetter}"`}
            incorrectMessage="The correct pictograph is highlighted"
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
    grid-template-columns: repeat(2, 130px);
    justify-content: center;
    gap: 0.75rem;
  }

  @media (min-width: 600px) {
    .quiz-content {
      max-width: 420px;
      gap: 2rem;
    }

    .answer-grid {
      grid-template-columns: repeat(2, 150px);
      gap: 1rem;
    }
  }

  @media (min-width: 900px) {
    .quiz-content {
      max-width: 520px;
      gap: 2.5rem;
    }

    .answer-grid {
      grid-template-columns: repeat(2, 180px);
      gap: 1.25rem;
    }
  }

  @media (min-width: 1200px) {
    .quiz-content {
      max-width: 600px;
    }

    .answer-grid {
      grid-template-columns: repeat(2, 200px);
      gap: 1.5rem;
    }
  }
</style>
