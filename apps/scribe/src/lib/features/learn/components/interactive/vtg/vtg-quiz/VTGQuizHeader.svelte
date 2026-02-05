<!--
VTGQuizHeader - Progress and score display for VTG quiz
-->
<script lang="ts">
  let {
    currentQuestion,
    totalQuestions,
    correctCount,
    showResult,
  }: {
    currentQuestion: number;
    totalQuestions: number;
    correctCount: number;
    showResult: boolean;
  } = $props();

  const answeredCount = $derived(currentQuestion + (showResult ? 1 : 0));
</script>

<div class="quiz-header">
  <span class="progress"
    >Question {currentQuestion + 1} of {totalQuestions}</span
  >
  <span class="score">Score: {correctCount}/{answeredCount}</span>
</div>

<style>
  .quiz-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
  }

  .progress {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--theme-text-dim);
  }

  .score {
    font-size: 0.875rem;
    font-weight: 600;
    color: #22d3ee;
  }
</style>
