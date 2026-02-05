<!--
  VariationNav.svelte - Variation navigation controls

  Prev/next navigation for cycling through sequence variations.
  Used in SequenceViewer and potentially other places that show variations.
-->
<script lang="ts">
  const {
    currentIndex = 0,
    total = 1,
    onPrevious,
    onNext,
  } = $props<{
    currentIndex?: number;
    total?: number;
    onPrevious: () => void;
    onNext: () => void;
  }>();

  const hasPrevious = $derived(currentIndex > 0);
  const hasNext = $derived(currentIndex < total - 1);
</script>

<div class="variation-nav">
  <button
    class="nav-button"
    onclick={onPrevious}
    disabled={!hasPrevious}
    aria-label="Previous variation"
  >
    <i class="fas fa-chevron-left" aria-hidden="true"></i>
  </button>
  <span class="variation-indicator">
    {currentIndex + 1} / {total}
  </span>
  <button
    class="nav-button"
    onclick={onNext}
    disabled={!hasNext}
    aria-label="Next variation"
  >
    <i class="fas fa-chevron-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .variation-nav {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .nav-button {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: white;
    cursor: pointer;
    transition: background var(--duration-normal);
  }

  .nav-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .nav-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .variation-indicator {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }
</style>
