<script lang="ts">
  /**
   * Review Navigation Bar
   *
   * Reusable navigation controls for review workflows.
   * Previous / Skip / Next with position indicator.
   */
  interface Props {
    currentIndex: number;
    totalCount: number;
    onPrevious: () => void;
    onNext: () => void;
    onSkip?: () => void;
    showSkip?: boolean;
    previousLabel?: string;
    nextLabel?: string;
    skipLabel?: string;
  }

  let {
    currentIndex,
    totalCount,
    onPrevious,
    onNext,
    onSkip,
    showSkip = true,
    previousLabel = "Previous",
    nextLabel = "Next",
    skipLabel = "Skip",
  }: Props = $props();

  const isFirst = $derived(currentIndex === 0);
  const isLast = $derived(currentIndex >= totalCount - 1);
</script>

<div class="navigation">
  <button onclick={onPrevious} disabled={isFirst}>
    {previousLabel}
  </button>
  {#if showSkip && onSkip}
    <button onclick={onSkip}>{skipLabel}</button>
  {/if}
  <span class="position">
    {currentIndex + 1} / {totalCount}
  </span>
  <button onclick={onNext} disabled={isLast} class="primary">
    {nextLabel}
  </button>
</div>

<style>
  .navigation {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    border-top: 1px solid var(--theme-stroke, var(--theme-stroke));
    background: var(--surface-glass);
  }

  button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-color);
    color: var(--foreground);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  button:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: rgba(255, 255, 255, 0.2);
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  button.primary {
    background: var(--gradient-primary);
    border-color: transparent;
  }

  button.primary:hover:not(:disabled) {
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  }

  .position {
    margin-left: auto;
    font-size: var(--font-size-sm);
    color: var(--muted);
  }
</style>
