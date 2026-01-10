<!--
PositionIdentificationQuiz - Quiz to identify Alpha, Beta, and Gamma positions
Shows hand positions on grid, user identifies the type
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import {
    POSITION_TYPE_INFO,
    generatePositionQuestions,
    type PositionType,
    type PositionQuestion,
  } from "../../../domain/constants/position-quiz-data";
  import PositionVisualizer from "./PositionVisualizer.svelte";
  import PositionQuizProgress from "./position-quiz/PositionQuizProgress.svelte";
  import PositionAnswerButton from "./position-quiz/PositionAnswerButton.svelte";
  import PositionQuizFeedback from "./position-quiz/PositionQuizFeedback.svelte";
  import PositionQuizComplete from "./position-quiz/PositionQuizComplete.svelte";

  let { onComplete } = $props<{
    onComplete?: () => void;
  }>();

  const hapticService = container.items.hapticFeedback as IHapticFeedback;

  type AnswerState = "idle" | "correct" | "incorrect";

  let currentQuestion = $state(0);
  let score = $state(0);
  let answerState = $state<AnswerState>("idle");
  let selectedAnswer = $state<PositionType | null>(null);
  const questions = $state(generatePositionQuestions());

  const isComplete = $derived(currentQuestion >= questions.length);

  function getCurrentQuestion(): PositionQuestion {
    return questions[currentQuestion]!;
  }

  function handleAnswer(answer: PositionType) {
    if (answerState !== "idle") return;

    selectedAnswer = answer;
    const question = getCurrentQuestion();
    if (!question) return;

    if (answer === question.type) {
      answerState = "correct";
      score++;
      hapticService?.trigger("success");
    } else {
      answerState = "incorrect";
      hapticService?.trigger("error");
    }

    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        answerState = "idle";
        selectedAnswer = null;
      } else {
        answerState = "idle";
        currentQuestion++;
      }
    }, 1500);
  }

  function restartQuiz() {
    currentQuestion = 0;
    score = 0;
    answerState = "idle";
    selectedAnswer = null;
    questions.length = 0;
    questions.push(...generatePositionQuestions());
  }
</script>

<div class="position-quiz">
  <PositionQuizProgress {currentQuestion} totalQuestions={questions.length} />

  {#if !isComplete}
    {@const question = getCurrentQuestion()}
    <div class="quiz-section">
      <h3 class="quiz-title">What position is this?</h3>
      <p class="quiz-subtitle">Identify: Alpha, Beta, or Gamma</p>

      <div class="visualizer-container">
        <PositionVisualizer
          leftHand={question.left}
          rightHand={question.right}
          showLabels={true}
          highlightType={answerState !== "idle" ? question.type : null}
        />
      </div>

      <div class="answer-buttons">
        {#each ["alpha", "beta", "gamma"] as PositionType[] as type}
          <PositionAnswerButton
            {type}
            info={POSITION_TYPE_INFO[type]}
            isSelected={selectedAnswer === type}
            isCorrectAnswer={question.type === type}
            {answerState}
            disabled={answerState !== "idle"}
            onclick={() => handleAnswer(type)}
          />
        {/each}
      </div>

      {#if answerState !== "idle"}
        <PositionQuizFeedback
          isCorrect={answerState === "correct"}
          typeInfo={POSITION_TYPE_INFO[question.type]}
        />
      {/if}
    </div>
  {:else}
    <PositionQuizComplete
      {score}
      totalQuestions={questions.length}
      onRestart={restartQuiz}
      onComplete={() => onComplete?.()}
    />
  {/if}
</div>

<style>
  .position-quiz {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
  }

  .quiz-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .quiz-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: white;
    margin: 0;
    text-align: center;
  }

  .quiz-subtitle {
    font-size: 1rem;
    color: var(--theme-text-dim);
    margin: 0;
    text-align: center;
  }

  .visualizer-container {
    width: 100%;
    max-width: 320px;
  }

  .answer-buttons {
    display: flex;
    gap: 0.75rem;
    width: 100%;
    max-width: 452px;
    flex-wrap: wrap;
    justify-content: center;
  }

  @media (max-width: 500px) {
    .position-quiz {
      padding: 1rem;
    }

    .quiz-title {
      font-size: 1.25rem;
    }

    .answer-buttons {
      flex-direction: column;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .quiz-section {
      animation: none;
    }
  }
</style>
