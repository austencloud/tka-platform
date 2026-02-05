<!--
WordQuizAnswerButton - Single answer option with letter prefix
-->
<script lang="ts">
  let {
    index,
    option,
    isSelected,
    showCorrect,
    showIncorrect,
    revealCorrect,
    answerState,
    disabled,
    onSelect,
  }: {
    index: number;
    option: string;
    isSelected: boolean;
    showCorrect: boolean;
    showIncorrect: boolean;
    revealCorrect: boolean;
    answerState: "idle" | "correct" | "incorrect";
    disabled: boolean;
    onSelect: () => void;
  } = $props();
</script>

<button
  class="answer-btn"
  class:selected={isSelected}
  class:correct={showCorrect || revealCorrect}
  class:incorrect={showIncorrect}
  onclick={onSelect}
  {disabled}
>
  <span class="option-letter">{String.fromCharCode(65 + index)}</span>
  <span class="option-text">{option}</span>
  {#if answerState !== "idle" && isSelected}
    <span class="result-icon">{answerState === "correct" ? "✓" : "✗"}</span>
  {:else if revealCorrect}
    <span class="result-icon correct">✓</span>
  {/if}
</button>

<style>
  .answer-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--theme-card-bg);
    border: 2px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    color: white;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
    position: relative;
    width: 100%;
  }

  .answer-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateX(4px);
  }

  .answer-btn:disabled {
    cursor: default;
  }

  .option-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--theme-text-dim);
    flex-shrink: 0;
  }

  .option-text {
    flex: 1;
    line-height: 1.4;
  }

  .answer-btn.correct {
    background: rgba(34, 211, 238, 0.15);
    border-color: rgba(34, 211, 238, 0.5);
    animation: correctPulse 0.5s ease;
  }

  .answer-btn.correct .option-letter {
    background: rgba(34, 211, 238, 0.3);
    color: #22d3ee;
  }

  @keyframes correctPulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.02);
    }
    100% {
      transform: scale(1);
    }
  }

  .answer-btn.incorrect {
    background: rgba(255, 74, 74, 0.15);
    border-color: rgba(255, 74, 74, 0.5);
    animation: shake var(--duration-dramatic) ease;
  }

  .answer-btn.incorrect .option-letter {
    background: rgba(255, 74, 74, 0.3);
    color: #ff4a4a;
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
    right: 1rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: #ff4a4a;
  }

  .result-icon.correct,
  .answer-btn.correct .result-icon {
    color: #22d3ee;
  }

  @media (max-width: 500px) {
    .answer-btn {
      padding: 0.75rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .answer-btn {
      animation: none;
      transition: none;
    }
  }
</style>
