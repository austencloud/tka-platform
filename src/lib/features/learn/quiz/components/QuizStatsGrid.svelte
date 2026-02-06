<script lang="ts">
  interface Props {
    correctAnswers: number;
    incorrectGuesses: number;
    totalQuestions: number;
    completionTime: string;
  }

  let {
    correctAnswers,
    incorrectGuesses,
    totalQuestions,
    completionTime,
  }: Props = $props();
</script>

<div class="stats-grid">
  <div class="stat-item">
    <span class="stat-value">{correctAnswers}</span>
    <span class="stat-label">Correct</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">{incorrectGuesses}</span>
    <span class="stat-label">Incorrect</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">{totalQuestions}</span>
    <span class="stat-label">Total</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">{completionTime}</span>
    <span class="stat-label">Time</span>
  </div>
</div>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-md);
    background: rgba(0, 0, 0, 0.02);
    border-radius: 8px;
    transition: all var(--transition-fast);
  }

  .stat-item:hover {
    background: rgba(0, 0, 0, 0.04);
    transform: translateY(-2px);
  }

  .stat-value {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-color);
  }

  .stat-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  @media (max-width: 640px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
