<!--
StaffQuizFeedback - Feedback display after answer
-->
<script lang="ts">
  import type { AnswerInfo } from "../../../../domain/constants/staff-quiz-questions";

  let {
    answerState,
    correctAnswer,
    correctInfo,
  }: {
    answerState: "correct" | "incorrect";
    correctAnswer: string;
    correctInfo: AnswerInfo;
  } = $props();
</script>

<div
  class="feedback"
  class:correct={answerState === "correct"}
  class:incorrect={answerState === "incorrect"}
>
  {#if answerState === "correct"}
    <span>
      Correct! That's <strong style="color: {correctInfo.color}"
        >{correctAnswer}</strong
      >.
    </span>
  {:else}
    <span>
      Not quite! The answer is <strong style="color: {correctInfo.color}"
        >{correctAnswer}</strong
      >.
    </span>
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
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 30%, transparent);
    color: var(--theme-accent, #22d3ee);
  }

  .feedback.incorrect {
    background: color-mix(in srgb, var(--semantic-warning, #fb923c) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-warning, #fb923c) 30%, transparent);
    color: var(--semantic-warning, #fb923c);
  }

  @media (prefers-reduced-motion: reduce) {
    .feedback {
      animation: none;
    }
  }
</style>
