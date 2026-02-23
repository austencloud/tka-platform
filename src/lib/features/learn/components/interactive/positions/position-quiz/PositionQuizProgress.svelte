<!--
PositionQuizProgress - Progress bar for position quiz
-->
<script lang="ts">
  let {
    currentQuestion,
    totalQuestions,
  }: {
    currentQuestion: number;
    totalQuestions: number;
  } = $props();

  const progressPercent = $derived((currentQuestion / totalQuestions) * 100);
  const isComplete = $derived(currentQuestion >= totalQuestions);
</script>

<div class="quiz-progress">
  <div class="progress-bar">
    <div class="progress-fill" style="width: {progressPercent}%"></div>
  </div>
  <div class="progress-text">
    {#if !isComplete}
      Question {currentQuestion + 1} of {totalQuestions}
    {:else}
      Complete!
    {/if}
  </div>
</div>

<style>
  .quiz-progress {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .progress-bar {
    height: 6px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #22d3ee);
    border-radius: 3px;
    transition: width var(--duration-emphasis) ease;
  }

  .progress-text {
    font-size: 0.8125rem;
    color: var(--theme-text-dim);
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }
  }
</style>
