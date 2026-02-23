<!--
PositionAnswerButton - Answer button for position type selection
-->
<script lang="ts">
  import type {
    PositionType,
    PositionTypeInfo,
  } from "../../../../domain/constants/position-quiz-data";

  let {
    type,
    info,
    isSelected,
    isCorrectAnswer,
    answerState,
    disabled,
    onclick,
  }: {
    type: PositionType;
    info: PositionTypeInfo;
    isSelected: boolean;
    isCorrectAnswer: boolean;
    answerState: "idle" | "correct" | "incorrect";
    disabled: boolean;
    onclick: () => void;
  } = $props();

  const showCorrect = $derived(answerState === "correct" && isSelected);
  const showIncorrect = $derived(answerState === "incorrect" && isSelected);
  const revealCorrect = $derived(
    answerState === "incorrect" && isCorrectAnswer
  );
</script>

<button
  class="answer-btn"
  class:selected={isSelected}
  class:correct={showCorrect || revealCorrect}
  class:incorrect={showIncorrect}
  style="--type-color: {info.color}"
  {onclick}
  {disabled}
  aria-label="Select {info.label}"
>
  <i class="fa-solid {info.icon}" aria-hidden="true"></i>
  <span>{info.label}</span>
  {#if answerState !== "idle" && isSelected}
    <span class="result-icon">{answerState === "correct" ? "✓" : "✗"}</span>
  {:else if revealCorrect}
    <span class="result-icon correct">✓</span>
  {/if}
</button>

<style>
  .answer-btn {
    flex: 1;
    min-width: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    min-height: 80px;
    background: var(--theme-card-bg);
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
  }

  .answer-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--type-color) 15%, transparent);
    border-color: color-mix(in srgb, var(--type-color) 50%, transparent);
    transform: translateY(-2px);
  }

  .answer-btn:disabled {
    cursor: default;
  }

  .answer-btn i {
    font-size: 1.25rem;
    color: var(--type-color);
  }

  .answer-btn.correct {
    background: color-mix(in srgb, var(--type-color) 20%, transparent);
    border-color: var(--type-color);
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
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 60%, transparent);
    animation: shake var(--duration-dramatic) ease;
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }

  .result-icon {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--semantic-error, #ef4444);
  }

  .result-icon.correct,
  .answer-btn.correct .result-icon {
    color: var(--type-color);
  }

  @media (max-width: 500px) {
    .answer-btn {
      min-width: auto;
      flex-direction: row;
      justify-content: center;
      gap: 0.75rem;
      min-height: var(--min-touch-target, 44px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .answer-btn {
      animation: none;
      transition: none;
    }
  }
</style>
