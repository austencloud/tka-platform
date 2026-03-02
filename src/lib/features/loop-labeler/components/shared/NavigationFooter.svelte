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

<nav class="navigation" aria-label="Sequence navigation">
  <button
    onclick={onPrevious}
    disabled={!canGoPrevious}
    aria-label="Go to previous sequence"
  >
    Previous
  </button>
  <button onclick={onSkip} aria-label="Skip to next sequence">
    Skip
  </button>
  <span class="position" aria-live="polite" aria-atomic="true">
    {currentIndex + 1} / {totalCount}
  </span>
</nav>

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
