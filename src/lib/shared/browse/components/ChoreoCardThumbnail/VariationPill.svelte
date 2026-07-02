<!--
VariationPill.svelte

Small tappable pill showing "X/Y" for sequences with variations.
Clicking cycles through variations with a smooth crossfade.

Touch target: var(--min-touch-target) minimum for WCAG AA accessibility.
-->
<script lang="ts">
  const {
    currentIndex = 0,
    totalCount = 1,
    onCycle = () => {},
  }: {
    currentIndex: number;
    totalCount: number;
    onCycle: () => void;
  } = $props();

  function handleClick(event: MouseEvent) {
    // Stop propagation to prevent card click
    event.stopPropagation();
    onCycle();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onCycle();
    }
  }
</script>

{#if totalCount > 1}
  <button
    class="variation-pill"
    onclick={handleClick}
    onkeydown={handleKeydown}
    aria-label="Show next variation ({currentIndex + 1} of {totalCount})"
    title="Tap to see other versions"
  >
    <span class="pill-text">{currentIndex + 1}/{totalCount}</span>
  </button>
{/if}

<style>
  /* Bottom-right corner — centered it sat on top of the card's beat cells
     (worst on mobile 2-col grids where the pill covered whole pictographs). */
  .variation-pill {
    position: absolute;
    bottom: 6px;
    right: 6px;

    /* var(--min-touch-target) minimum touch target (WCAG AA) */
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);

    /* Visual styling - smaller appearance but large tap target */
    padding: 4px 10px;
    display: flex;
    align-items: center;
    justify-content: center;

    /* Subtle glassmorphic background */
    background: var(--theme-overlay-bg, rgba(0, 0, 0, 0.5));
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));

    /* Text styling */
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.5px;

    /* Interaction */
    cursor: pointer;
    transition:
      transform var(--duration-fast) ease,
      background-color var(--duration-fast) ease,
      border-color var(--duration-fast) ease;

    /* Ensure clickable on top of thumbnail */
    z-index: 10;
  }

  .variation-pill:hover {
    background: var(--theme-overlay-bg-hover, rgba(0, 0, 0, 0.7));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    transform: scale(1.05);
  }

  .variation-pill:active {
    transform: scale(0.95);
  }

  .variation-pill:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .pill-text {
    /* Prevent text selection */
    user-select: none;
    pointer-events: none;
  }

  /* Light mode variant */
  :global(.choreo-card.light-mode) .variation-pill {
    background: var(--theme-overlay-bg-light, rgba(255, 255, 255, 0.8));
    border-color: var(--theme-stroke-light, rgba(0, 0, 0, 0.15));
    color: var(--theme-text-light, rgba(0, 0, 0, 0.8));
  }

  :global(.choreo-card.light-mode) .variation-pill:hover {
    background: var(--theme-overlay-bg-light-hover, rgba(255, 255, 255, 0.95));
    border-color: var(--theme-stroke-strong-light, rgba(0, 0, 0, 0.25));
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .variation-pill {
      transition: none;
    }
    .variation-pill:hover,
    .variation-pill:active {
      transform: none;
    }
  }
</style>
