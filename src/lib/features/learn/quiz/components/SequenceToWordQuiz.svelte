<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { detectSingleError } from "$lib/features/learn/services/gap-detector";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import { onDestroy, onMount } from "svelte";
  import * as QuestionGenerator from "../services/question-generator";
  import { QuizType } from "../domain/enums/quiz-enums";
  import type { QuizQuestionData, QuizAnswerEvent } from "../domain/models/quiz-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { DetectedGap } from "../../services/contracts/types";
  import QuizContainer from "./shared/QuizContainer.svelte";
  import QuizLoadingState from "./shared/QuizLoadingState.svelte";
  import QuizErrorState from "./shared/QuizErrorState.svelte";
  import QuizPrompt from "./shared/QuizPrompt.svelte";
  import QuizPerformerStage from "./shared/QuizPerformerStage.svelte";
  import QuizWordButton from "./shared/QuizWordButton.svelte";
  import QuizFeedbackBanner from "./shared/QuizFeedbackBanner.svelte";
  import MisconceptionHint from "./shared/MisconceptionHint.svelte";
  import ScorePopAnimation from "./shared/ScorePopAnimation.svelte";
  import { getDelightOrchestrator } from "$lib/shared/delight/context/delight-context";

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

  let currentStreak = $state(0);
  let showScorePop = $state(false);
  let currentGap = $state<DetectedGap | null>(null);

  const answerSlots = [0, 1, 2, 3];

  let currentSequence = $derived(
    questionData?.questionContent as SequenceData | null
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
        QuizType.SEQUENCE_TO_WORD
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

    if (isCorrect) {
      currentStreak++;
      showScorePop = true;

      if (currentStreak >= 3 && currentStreak % 3 === 0) {
        delightOrchestrator?.celebrate("answer-correct", {
          confettiAmount: 15,
        });
      }

      scorePopTimer = setTimeout(() => {
        showScorePop = false;
      }, 800);
    } else {
      currentStreak = 0;
    }

    currentGap = null;
    if (!isCorrect && questionData) {
      const selectedOption = questionData.answerOptions.find(
        (o) => o.id === optionId
      );
      const correctOption = questionData.answerOptions.find((o) => o.isCorrect);
      const gap = detectSingleError({
        isCorrect: false,
        questionData,
        selectedOptionId: optionId,
        selectedContent: selectedOption?.content ?? null,
        correctContent: correctOption?.content ?? null,
        quizType: QuizType.SEQUENCE_TO_WORD,
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
      const selectedOption = questionData.answerOptions.find(
        (o) => o.id === optionId
      );
      const correctOption = questionData.answerOptions.find((o) => o.isCorrect);
      onAnswerSubmit?.({
        isCorrect,
        questionData,
        selectedOptionId: optionId,
        selectedContent: selectedOption?.content ?? null,
        correctContent: correctOption?.content ?? null,
        quizType: QuizType.SEQUENCE_TO_WORD,
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
{:else if questionData && currentSequence}
  <QuizContainer>
    <QuizPrompt text="What word is being performed?" />

    <div class="quiz-content">
      <div class="stage-panel">
        <QuizPerformerStage sequence={currentSequence} />
      </div>

      <div class="answer-section">
        <div class="answer-grid">
          {#each answerSlots as slotIndex (slotIndex)}
            {@const option = questionData.answerOptions[slotIndex]}
            {#if option}
              <QuizWordButton
                word={option.content as string}
                state={getButtonState(option.id, option.isCorrect)}
                disabled={isAnswered}
                onclick={() => handleAnswerClick(option.id, option.isCorrect)}
              />
            {/if}
          {/each}
        </div>

        <ScorePopAnimation
          visible={showScorePop}
          score={1}
          streakCount={currentStreak}
        />

        {#if showFeedback}
          <QuizFeedbackBanner
            isCorrect={isCorrectAnswer}
            correctMessage={`Correct! The word is "${correctAnswer}"`}
            incorrectMessage={`The correct word is "${correctAnswer}"`}
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
    gap: 1.25rem;
    width: 100%;
    max-width: 420px;
  }

  .stage-panel {
    width: 100%;
    aspect-ratio: 4 / 3;
    max-height: 280px;
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
    grid-template-columns: 1fr 1fr;
    gap: 0.625rem;
    width: 100%;
  }

  /* Desktop: horizontal split layout */
  @media (min-width: 768px) {
    .quiz-content {
      flex-direction: row;
      align-items: stretch;
      max-width: 900px;
      gap: 2rem;
    }

    .stage-panel {
      flex: 1;
      aspect-ratio: auto;
      max-height: none;
      min-height: 360px;
    }

    .answer-section {
      flex: 0 0 260px;
      justify-content: center;
    }

    .answer-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }

  @media (min-width: 1024px) {
    .quiz-content {
      max-width: 1000px;
    }

    .answer-section {
      flex: 0 0 300px;
    }

    .answer-grid {
      gap: 0.875rem;
    }
  }

  @media (max-width: 480px) {
    .quiz-content {
      gap: 1rem;
    }

    .stage-panel {
      max-height: 220px;
    }

    .answer-grid {
      gap: 0.5rem;
    }
  }
</style>
