<!--
VTGQuizResults - Final quiz results display
-->
<script lang="ts">
  import VTGModeReviewGrid from "./VTGModeReviewGrid.svelte";

  let {
    correctCount,
    totalQuestions,
    onFinish,
  }: {
    correctCount: number;
    totalQuestions: number;
    onFinish: () => void;
  } = $props();

  const score = $derived(Math.round((correctCount / totalQuestions) * 100));
  const isPassing = $derived(score >= 70);
</script>

<div class="results">
  <div class="results-icon" class:passing={isPassing}>
    {#if isPassing}
      <i class="fa-solid fa-trophy" aria-hidden="true"></i>
    {:else}
      <i class="fa-solid fa-book-open" aria-hidden="true"></i>
    {/if}
  </div>

  <h3 class="results-title">
    {#if isPassing}
      Excellent Work!
    {:else}
      Keep Practicing!
    {/if}
  </h3>

  <div class="score-display">
    <span class="score-value" class:passing={isPassing}>{score}%</span>
    <span class="score-label">{correctCount} of {totalQuestions} correct</span>
  </div>

  <VTGModeReviewGrid />

  <button class="finish-button" onclick={onFinish}>
    {#if isPassing}
      <i class="fa-solid fa-check" aria-hidden="true"></i>
      Complete Lesson
    {:else}
      <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
      Review & Try Again
    {/if}
  </button>
</div>

<style>
  .results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 1.5rem;
    text-align: center;
  }

  .results-icon {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 2rem;
  }

  .results-icon.passing {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
  }

  .results-icon:not(.passing) {
    background: rgba(251, 146, 60, 0.15);
    color: #fb923c;
  }

  .results-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .score-display {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .score-value {
    font-size: 3rem;
    font-weight: 800;
    line-height: 1;
  }

  .score-value.passing {
    color: #4ade80;
  }

  .score-value:not(.passing) {
    color: #fb923c;
  }

  .score-label {
    font-size: 0.875rem;
    color: var(--theme-text-dim);
  }

  .finish-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2.5rem;
    background: linear-gradient(
      135deg,
      rgba(74, 222, 128, 0.3) 0%,
      rgba(34, 197, 94, 0.3) 100%
    );
    border: 2px solid rgba(74, 222, 128, 0.5);
    border-radius: 12px;
    color: white;
    font-size: 1.0625rem;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .finish-button:hover {
    background: linear-gradient(
      135deg,
      rgba(74, 222, 128, 0.4) 0%,
      rgba(34, 197, 94, 0.4) 100%
    );
    border-color: rgba(74, 222, 128, 0.7);
    transform: translateY(-2px);
  }
</style>
