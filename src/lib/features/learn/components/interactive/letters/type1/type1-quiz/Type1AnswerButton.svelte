<!--
Type1AnswerButton - Single answer option for motion pattern
-->
<script lang="ts">
  import type {
    MotionPattern,
    PatternInfo,
  } from "../../../../../domain/constants/type1-letter-questions";

  let {
    pattern,
    info,
    isSelected,
    showCorrect,
    showIncorrect,
    revealCorrect,
    answerState,
    disabled,
    onSelect,
  }: {
    pattern: MotionPattern;
    info: PatternInfo;
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
  style="--pattern-color: {info.color}"
  onclick={onSelect}
  {disabled}
>
  <i class="fa-solid {info.icon}" aria-hidden="true"></i>
  <div class="answer-content">
    <span class="answer-label">{info.label}</span>
    <span class="answer-desc">{info.description}</span>
  </div>
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
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--theme-card-bg);
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 12px;
    color: white;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    position: relative;
    text-align: left;
    width: 100%;
  }

  .answer-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--pattern-color) 15%, transparent);
    border-color: color-mix(in srgb, var(--pattern-color) 50%, transparent);
    transform: translateX(4px);
  }

  .answer-btn:disabled {
    cursor: default;
  }

  .answer-btn i {
    font-size: 1.5rem;
    color: var(--pattern-color);
    width: 32px;
    text-align: center;
  }

  .answer-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
  }

  .answer-label {
    font-size: 1rem;
    font-weight: 700;
  }

  .answer-desc {
    font-size: 0.8125rem;
    color: var(--theme-text-dim);
  }

  .answer-btn.correct {
    background: color-mix(in srgb, var(--pattern-color) 20%, transparent);
    border-color: var(--pattern-color);
    animation: correctPulse 0.5s ease;
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
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }

  .result-icon {
    font-size: 1.25rem;
    font-weight: 700;
    color: #ff4a4a;
  }

  .result-icon.correct,
  .answer-btn.correct .result-icon {
    color: var(--pattern-color);
  }

  @media (prefers-reduced-motion: reduce) {
    .answer-btn {
      animation: none;
      transition: none;
    }
  }
</style>
