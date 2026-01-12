<!--
Pictograph to Letter Quiz - Shows a pictograph, asks user to identify the letter
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { onMount } from "svelte";
  import { QuestionGeneratorService } from "../services/implementations/QuestionGenerator";
  import { QuizType } from "../domain/enums/quiz-enums";
  import type { QuizQuestionData } from "../domain/models/quiz-models";
  import QuizContainer from "./shared/QuizContainer.svelte";
  import QuizBackButton from "./shared/QuizBackButton.svelte";
  import QuizLoadingState from "./shared/QuizLoadingState.svelte";
  import QuizErrorState from "./shared/QuizErrorState.svelte";
  import QuizPrompt from "./shared/QuizPrompt.svelte";
  import QuizPictographCard from "./shared/QuizPictographCard.svelte";
  import QuizLetterButton from "./shared/QuizLetterButton.svelte";
  import QuizFeedbackBanner from "./shared/QuizFeedbackBanner.svelte";
  import ScorePopAnimation from "./shared/ScorePopAnimation.svelte";
  import { getDelightOrchestrator } from "$lib/shared/delight/context/delight-context";

  let { onAnswerSubmit, onNextQuestion, onBack } = $props<{
    onAnswerSubmit?: (isCorrect: boolean) => void;
    onNextQuestion?: () => void;
    onBack?: () => void;
  }>();

  let hapticService: IHapticFeedback;
  const delightOrchestrator = getDelightOrchestrator();

  let questionData = $state<QuizQuestionData | null>(null);
  let selectedAnswerId = $state<string | null>(null);
  let isAnswered = $state(false);
  let showFeedback = $state(false);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let questionKey = $state(0);

  // Streak tracking within session
  let currentStreak = $state(0);
  let showScorePop = $state(false);

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
    hapticService = container.items.hapticFeedback;
    await loadQuestion();
  });

  async function loadQuestion() {
    isLoading = true;
    error = null;
    try {
      questionData = await QuestionGeneratorService.generateQuestion(
        QuizType.PICTOGRAPH_TO_LETTER
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

    // Update streak and show animations
    if (isCorrect) {
      currentStreak++;
      showScorePop = true;

      // Mini confetti for streak of 3+
      if (currentStreak >= 3 && currentStreak % 3 === 0) {
        delightOrchestrator?.trigger("answer-correct", {
          confettiAmount: 15
        });
      }

      setTimeout(() => {
        showScorePop = false;
      }, 800);
    } else {
      currentStreak = 0;
    }

    setTimeout(() => {
      hapticService?.trigger(isCorrect ? "success" : "error");
    }, 100);

    onAnswerSubmit?.(isCorrect);
    setTimeout(handleNextQuestion, 1200);
  }

  async function handleNextQuestion() {
    selectedAnswerId = null;
    isAnswered = false;
    showFeedback = false;
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
    <QuizPrompt text="What letter does this pictograph represent?" />

    <div class="quiz-content">
      {#key questionKey}
        <QuizPictographCard pictograph={currentPictograph} />
      {/key}

      <div class="answer-section">
        <div class="answer-grid">
          {#each questionData.answerOptions as option (option.id)}
            <QuizLetterButton
              letter={option.content as string}
              state={getButtonState(option.id, option.isCorrect)}
              disabled={isAnswered}
              onclick={() => handleAnswerClick(option.id, option.isCorrect)}
            />
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
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    width: 100%;
  }

  @media (min-width: 600px) {
    .quiz-content {
      max-width: 420px;
      gap: 2rem;
    }

    .answer-grid {
      gap: 1rem;
    }
  }

  @media (min-width: 900px) {
    .quiz-content {
      max-width: 480px;
      gap: 2.5rem;
    }

    .answer-grid {
      gap: 1.25rem;
    }
  }

  @media (min-width: 1200px) {
    .quiz-content {
      max-width: 520px;
    }
  }
</style>
