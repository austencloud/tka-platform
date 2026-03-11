<!-- Options variant: entire header is clickable button -->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { swipeGesture } from "$lib/shared/utils/swipeGesture";

  const {
    title = "",
    titleHtml = "",
    isFilterPanelOpen = false,
    compact = false,
    onOpenFilters,
  }: {
    title?: string;
    titleHtml?: string;
    isFilterPanelOpen?: boolean;
    compact?: boolean;
    onOpenFilters?: (() => void) | undefined;
  } = $props();

  const hapticService = container.items.hapticFeedback;

  function handleFilterClick() {
    hapticService?.trigger("selection");
    onOpenFilters?.();
  }
</script>

<button
  class="options-header-button"
  class:compact
  onclick={handleFilterClick}
  use:swipeGesture={{ onSwipeDown: handleFilterClick }}
  aria-label="Open filter options - {titleHtml ? 'Type information' : title}"
  aria-expanded={isFilterPanelOpen}
  aria-controls="options-filter-panel"
>
  <div class="header-left-spacer"></div>

  <div class="header-center-content">
    {#if titleHtml}
      <span class="header-title rich" aria-live="polite">{@html titleHtml}</span
      >
    {:else if title}
      <span class="header-title">{title}</span>
    {/if}
  </div>

  <div class="header-right-indicator">
    <i
      class="fas fa-chevron-down chevron"
      class:open={isFilterPanelOpen}
      aria-hidden="true"
    ></i>
  </div>
</button>

<style>
  /* Full-width clickable header button */
  .options-header-button {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    justify-items: stretch;
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    margin: 0;
    min-height: var(--min-touch-target);
    color: inherit;
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    overflow: hidden;
  }

  /* Subtle shine effect on hover */
  .options-header-button::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.03) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    opacity: 0;
    transition: opacity var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }

  .header-left-spacer {
    /* Empty space for symmetry */
    grid-column: 1;
    min-width: 0;
  }

  .header-center-content {
    grid-column: 2;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    min-width: 0;
    overflow: visible;
    padding: 0 8px;
  }

  .header-right-indicator {
    grid-column: 3;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 12px;
    min-width: 0;
  }

  .header-title {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
    overflow: visible;
  }

  .header-title.rich :global(span) {
    white-space: nowrap;
  }

  .chevron {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center;
    line-height: 1;
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  /* Compact mode: Reduced height for tight spaces */
  .options-header-button.compact {
    min-height: var(--alt-touch-target);
  }

  .options-header-button.compact .header-title {
    font-size: 0.85rem;
  }

  .options-header-button.compact .chevron {
    font-size: var(--font-size-compact, 12px);
  }

  .options-header-button.compact .header-right-indicator {
    padding: 0 10px;
  }

  @media (hover: hover) {
    .options-header-button:hover::before {
      opacity: 1;
    }

    .options-header-button:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    .options-header-button:hover .chevron {
      color: rgba(147, 197, 253, 1);
    }
  }

  .options-header-button:active {
    transform: scale(0.99);
    transition: transform var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Mobile optimizations */
  @media (max-width: 600px) {
    .header-center-content {
      padding: 0 4px;
    }

    .header-right-indicator {
      padding: 0 8px;
    }

    .chevron {
      font-size: var(--font-size-compact, 12px);
    }

    /* Extra compact on mobile when compact mode is active */
    .options-header-button.compact {
      min-height: var(--alt-touch-target);
    }

    .options-header-button.compact .header-title {
      font-size: 0.8rem;
    }
  }
</style>
