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
      >Correct! That's <strong style="color: {typeInfo.color}"
        >{typeInfo.label}</strong
      > position.</span
    >
  {:else}
    <span
      >Not quite! That was <strong style="color: {typeInfo.color}"
        >{typeInfo.label}</strong
      > position.</span
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
    background: rgba(34, 211, 238, 0.15);
    border: 1px solid rgba(34, 211, 238, 0.3);
    color: #22d3ee;
  }

  .feedback.incorrect {
    background: rgba(255, 158, 74, 0.15);
    border: 1px solid rgba(255, 158, 74, 0.3);
    color: #ff9e4a;
  }

  @media (prefers-reduced-motion: reduce) {
    .feedback {
      animation: none;
    }
  }
</style>
