<script lang="ts">
  interface Props {
    onRetry: () => void;
    onChooseNew: () => void;
    retryText?: string;
    chooseNewText?: string;
  }

  let {
    onRetry,
    onChooseNew,
    retryText = "🔄 Retry Lesson",
    chooseNewText = "📚 Choose New Lesson",
  }: Props = $props();
</script>

<div class="action-buttons">
  <button class="retry-button btn-primary" onclick={onRetry}>
    {retryText}
  </button>
  <button class="new-lesson-button btn-glass" onclick={onChooseNew}>
    {chooseNewText}
  </button>
</div>

<style>
  .action-buttons {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    justify-content: center;
    flex-wrap: wrap;
  }

  .retry-button,
  .new-lesson-button {
    padding: var(--spacing-sm) var(--spacing-xl);
    border-radius: 8px;
    font-size: var(--font-size-md);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-normal);
    min-width: 180px;
  }

  .retry-button {
    background: var(--primary-color);
    color: white;
    border: none;
    box-shadow: 0 4px 12px rgba(168, 28, 237, 0.3);
  }

  .retry-button:hover {
    background: var(--primary-light);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(168, 28, 237, 0.4);
  }

  .new-lesson-button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-color);
  }

  .new-lesson-button:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }

  @media (max-width: 640px) {
    .action-buttons {
      flex-direction: column;
    }

    .retry-button,
    .new-lesson-button {
      width: 100%;
    }
  }
</style>
