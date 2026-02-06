<!--
  Navigation Footer

  Previous/Skip navigation buttons with position indicator.
-->
<script lang="ts">
  interface Props {
    currentIndex: number;
    totalCount: number;
    onPrevious: () => void;
    onSkip: () => void;
  }

  let { currentIndex, totalCount, onPrevious, onSkip }: Props = $props();

  const canGoPrevious = $derived(currentIndex > 0);
</script>

<div class="navigation">
  <button onclick={onPrevious} disabled={!canGoPrevious}> Previous </button>
  <button onclick={onSkip}> Skip </button>
  <span class="position">
    {currentIndex + 1} / {totalCount}
  </span>
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

  .navigation button {
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

  .navigation button:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .navigation button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .position {
    margin-left: auto;
    font-size: var(--font-size-sm);
    color: var(--muted);
  }
</style>
