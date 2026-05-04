<script lang="ts">
  import type { PerformanceGrade } from "../quiz-results-analyzer";
  import AnimatedScoreCounter from "./AnimatedScoreCounter.svelte";

  interface Props {
    grade: PerformanceGrade;
    accuracy: number;
  }

  let { grade, accuracy }: Props = $props();

  // Determine performance tier for styling
  const tier = $derived(
    accuracy >= 90 ? 'excellent' :
    accuracy >= 70 ? 'good' :
    'needs-work'
  ) as 'excellent' | 'good' | 'needs-work';
</script>

<div class="performance-summary">
  <div class="grade-circle" style="border-color: {grade.color}">
    <span class="grade-letter" style="color: {grade.color}">
      {grade.grade}
    </span>
  </div>
  <div class="accuracy-text">
    <AnimatedScoreCounter
      value={accuracy}
      suffix="%"
      duration={1200}
      delay={300}
      {tier}
    />
    <span class="accuracy-label">Accuracy</span>
    <span class="performance-message">{grade.message}</span>
  </div>
</div>

<style>
  .performance-summary {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
  }

  .grade-circle {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    border: 6px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    flex-shrink: 0;
  }

  .grade-letter {
    font-size: var(--font-size-3xl);
    font-weight: 700;
  }

  .accuracy-text {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .accuracy-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .performance-message {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-color);
  }

  @media (max-width: 640px) {
    .performance-summary {
      flex-direction: column;
      text-align: center;
    }

    .grade-circle {
      width: 80px;
      height: 80px;
      border-width: 4px;
    }

    .grade-letter {
      font-size: var(--font-size-3xl);
    }
  }
</style>
