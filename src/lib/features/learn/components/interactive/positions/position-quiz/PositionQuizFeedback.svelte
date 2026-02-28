<!--
PositionQuizFeedback - Feedback message after answer
-->
<script lang="ts">
  import type { PositionTypeInfo } from "../../../../domain/constants/position-quiz-data";

  let {
    isCorrect,
    typeInfo,
  }: {
    isCorrect: boolean;
    typeInfo: PositionTypeInfo;
  } = $props();
</script>

<div class="feedback" class:correct={isCorrect} class:incorrect={!isCorrect}>
  {#if isCorrect}
    <span
      >Correct! That's <strong>{typeInfo.label}</strong> position.</span
    >
  {:else}
    <span
      >Not quite! That was <strong>{typeInfo.label}</strong> position.</span
    >
  {/if}
</div>

<style>
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
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
    color: var(--semantic-success, #22c55e);
  }

  .feedback.incorrect {
    background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-warning, #f59e0b) 30%, transparent);
    color: var(--semantic-warning, #f59e0b);
  }

  .feedback strong {
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .feedback {
      animation: none;
    }
  }
</style>
