<!--
WordQuizFeedback - Feedback display with explanation
-->
<script lang="ts">
  let {
    answerState,
    explanation,
  }: {
    answerState: "correct" | "incorrect";
    explanation: string;
  } = $props();
</script>

<div
  class="feedback"
  class:correct={answerState === "correct"}
  class:incorrect={answerState === "incorrect"}
>
  <div class="feedback-header">
    {#if answerState === "correct"}
      <i class="fa-solid fa-check-circle" aria-hidden="true"></i>
      <span>Correct!</span>
    {:else}
      <i class="fa-solid fa-times-circle" aria-hidden="true"></i>
      <span>Not quite!</span>
    {/if}
  </div>
  <p class="explanation">{explanation}</p>
</div>

<style>
  .feedback {
    width: 100%;
    max-width: 500px;
    padding: 1rem 1.25rem;
    border-radius: 12px;
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
    background: rgba(34, 211, 238, 0.1);
    border: 1px solid rgba(34, 211, 238, 0.25);
  }

  .feedback.incorrect {
    background: rgba(255, 158, 74, 0.1);
    border: 1px solid rgba(255, 158, 74, 0.25);
  }

  .feedback-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    font-weight: 700;
    font-size: 1rem;
  }

  .feedback.correct .feedback-header {
    color: #22d3ee;
  }

  .feedback.incorrect .feedback-header {
    color: #ff9e4a;
  }

  .explanation {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.8);
  }

  @media (prefers-reduced-motion: reduce) {
    .feedback {
      animation: none;
    }
  }
</style>
