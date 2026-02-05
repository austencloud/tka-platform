<script lang="ts">
  interface Props {
    lessonName: string;
    onBack: () => void;
    backButtonText?: string;
  }

  let {
    lessonName,
    onBack,
    backButtonText = "← Back to Lessons",
  }: Props = $props();
</script>

<div class="results-header glass-surface">
  <button class="back-button btn-glass" onclick={onBack}>
    {backButtonText}
  </button>
  <div class="lesson-info">
    <h2 class="lesson-title">Lesson Complete!</h2>
    <p class="lesson-subtitle">{lessonName}</p>
  </div>
</div>

<style>
  .results-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: 12px;
  }

  .back-button {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    transition: all var(--transition-normal);
    white-space: nowrap;
  }

  .back-button:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateX(-4px);
  }

  .lesson-info {
    flex: 1;
    text-align: center;
  }

  .lesson-title {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--text-color);
  }

  .lesson-subtitle {
    margin: var(--spacing-xs) 0 0 0;
    font-size: var(--font-size-md);
    color: var(--text-secondary);
  }

  @media (max-width: 640px) {
    .results-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .lesson-info {
      text-align: left;
    }

    .lesson-title {
      font-size: var(--font-size-xl);
    }
  }
</style>
