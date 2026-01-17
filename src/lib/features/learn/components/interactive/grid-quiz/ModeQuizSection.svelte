<!--
ModeQuizSection - Identify diamond vs box grid
-->
<script lang="ts">
  import LessonGridDisplay from "../LessonGridDisplay.svelte";

  let {
    question,
    answerState,
    selectedAnswer,
    onAnswer,
  }: {
    question: { correctAnswer: string; id: number };
    answerState: "idle" | "correct" | "incorrect";
    selectedAnswer: string | null;
    onAnswer: (answer: "diamond" | "box") => void;
  } = $props();
</script>

<div class="quiz-section mode-quiz">
  <h3 class="quiz-title">Which grid is this?</h3>
  <p class="quiz-subtitle">Identify if this is a Diamond or Box grid</p>

  <div class="grid-display">
    <LessonGridDisplay
      type={question.correctAnswer as "diamond" | "box"}
      size="medium"
    />
  </div>

  <div class="answer-buttons">
    <button
      class="answer-btn"
      class:selected={selectedAnswer === "diamond"}
      class:correct={answerState === "correct" && selectedAnswer === "diamond"}
      class:incorrect={answerState === "incorrect" &&
        selectedAnswer === "diamond"}
      class:reveal-correct={answerState === "incorrect" &&
        question.correctAnswer === "diamond"}
      onclick={() => onAnswer("diamond")}
      disabled={answerState !== "idle"}
    >
      <i class="fa-solid fa-diamond" aria-hidden="true"></i>
      <span>Diamond</span>
      {#if answerState !== "idle" && selectedAnswer === "diamond"}
        <span class="result-icon">{answerState === "correct" ? "✓" : "✗"}</span>
      {/if}
    </button>

    <button
      class="answer-btn"
      class:selected={selectedAnswer === "box"}
      class:correct={answerState === "correct" && selectedAnswer === "box"}
      class:incorrect={answerState === "incorrect" && selectedAnswer === "box"}
      class:reveal-correct={answerState === "incorrect" &&
        question.correctAnswer === "box"}
      onclick={() => onAnswer("box")}
      disabled={answerState !== "idle"}
    >
      <i class="fa-solid fa-square" aria-hidden="true"></i>
      <span>Box</span>
      {#if answerState !== "idle" && selectedAnswer === "box"}
        <span class="result-icon">{answerState === "correct" ? "✓" : "✗"}</span>
      {/if}
    </button>
  </div>

  {#if answerState !== "idle"}
    <div
      class="feedback"
      class:correct={answerState === "correct"}
      class:incorrect={answerState === "incorrect"}
    >
      {#if answerState === "correct"}
        <span>Correct! That's the {question.correctAnswer} grid.</span>
      {:else}
        <span
          >Not quite! That was the <strong>{question.correctAnswer}</strong> grid.</span
        >
      {/if}
    </div>
  {/if}
</div>

<style>
  .quiz-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    animation: fadeIn var(--duration-emphasis) ease;
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
    color: var(--theme-text);
    margin: 0;
    text-align: center;
  }

  .quiz-subtitle {
    font-size: 1rem;
    color: var(--theme-text-dim);
    margin: 0;
    text-align: center;
  }

  .grid-display {
    width: 100%;
    max-width: 280px;
    aspect-ratio: 1;
    padding: 1rem;
    background: var(--theme-card-bg);
    border-radius: 12px;
    border: 2px solid var(--theme-stroke);
  }

  .answer-buttons {
    display: flex;
    gap: 1rem;
    width: 100%;
    max-width: 400px;
  }

  .answer-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem;
    min-height: 80px;
    background: var(--theme-card-bg);
    border: 2px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
    border-radius: 12px;
    color: var(--theme-text);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
  }

  .answer-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-accent);
    transform: translateY(-2px);
  }

  .answer-btn:disabled {
    cursor: default;
  }

  .answer-btn i {
    font-size: 1.5rem;
    opacity: 0.8;
  }

  .answer-btn.correct {
    background: rgba(80, 200, 120, 0.2);
    border-color: rgba(80, 200, 120, 0.6);
    animation: correctPulse 0.5s ease;
  }

  @keyframes correctPulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.03);
    }
    100% {
      transform: scale(1);
    }
  }

  .answer-btn.incorrect {
    background: rgba(255, 74, 74, 0.2);
    border-color: rgba(255, 74, 74, 0.6);
    animation: shake var(--duration-dramatic) ease;
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
  }

  .answer-btn.reveal-correct {
    background: rgba(80, 200, 120, 0.15);
    border-color: rgba(80, 200, 120, 0.4);
  }

  .result-icon {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    font-size: 1.25rem;
    font-weight: 700;
  }

  .answer-btn.correct .result-icon {
    color: #50c878;
  }

  .answer-btn.incorrect .result-icon {
    color: #ff4a4a;
  }

  .feedback {
    padding: 0.875rem 1.25rem;
    border-radius: 10px;
    font-size: 0.9375rem;
    text-align: center;
    animation: slideUp var(--duration-emphasis) ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .feedback.correct {
    background: rgba(80, 200, 120, 0.15);
    border: 1px solid rgba(80, 200, 120, 0.3);
    color: #50c878;
  }

  .feedback.incorrect {
    background: rgba(255, 158, 74, 0.15);
    border: 1px solid rgba(255, 158, 74, 0.3);
    color: #ff9e4a;
  }

  @media (max-width: 500px) {
    .quiz-title {
      font-size: 1.25rem;
    }

    .answer-buttons {
      flex-direction: column;
    }

    .grid-display {
      max-width: 240px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .quiz-section,
    .answer-btn,
    .feedback {
      animation: none;
      transition: none;
    }
  }
</style>
