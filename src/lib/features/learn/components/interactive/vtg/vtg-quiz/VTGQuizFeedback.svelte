<!--
VTGQuizFeedback - Correct/incorrect feedback after answer
-->
<script lang="ts">
  import type { VTGMode } from "../../../../domain/constants/vtg-quiz-data";

  let {
    isCorrect,
    correctAnswer,
  }: {
    isCorrect: boolean;
    correctAnswer: VTGMode;
  } = $props();
</script>

<div class="result-feedback" class:correct={isCorrect}>
  {#if isCorrect}
    <i class="fa-solid fa-check-circle" aria-hidden="true"></i>
    <span>Correct! It's {correctAnswer}.</span>
  {:else}
    <i class="fa-solid fa-times-circle" aria-hidden="true"></i>
    <span>Not quite. The answer is {correctAnswer}.</span>
  {/if}
</div>

<style>
  .result-feedback {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 1rem 1.25rem;
    border-radius: 10px;
    font-weight: 600;
  }

  .result-feedback.correct {
    background: color-mix(in srgb, var(--semantic-success, #4ade80) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success, #4ade80) 30%, transparent);
    color: var(--semantic-success, #4ade80);
  }

  .result-feedback:not(.correct) {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error) 30%, transparent);
    color: var(--semantic-error);
  }

  .result-feedback i {
    font-size: 1.25rem;
  }
</style>
