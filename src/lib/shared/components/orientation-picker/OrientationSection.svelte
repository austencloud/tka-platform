<!--
OrientationSection.svelte - Collapsible section for selecting an orientation (start or end)
Uses 2x2 grid with all 4 orientation options
50px touch targets, modern Material 2026 design
-->
<script lang="ts">
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import OrientationPickerGrid from "./OrientationPickerGrid.svelte";

  let {
    title,
    description,
    currentOrientation = null,
    onOrientationChange,
  } = $props<{
    title: string;
    description: string;
    currentOrientation: Orientation | null;
    onOrientationChange: (orientation: Orientation | null) => void;
  }>();

  let isExpanded = $state(false);

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  // Get display label for the current orientation
  const displayValue = $derived.by(() => {
    if (!currentOrientation) return "Any";
    switch (currentOrientation) {
      case Orientation.IN:
        return "In";
      case Orientation.OUT:
        return "Out";
      case Orientation.CLOCK:
        return "Clock";
      case Orientation.COUNTER:
        return "Counter";
      default:
        return "?";
    }
  });

  const hasSelection = $derived(currentOrientation !== null);
</script>

<section class="orientation-section">
  <button
    class="section-header"
    onclick={toggleExpanded}
    aria-expanded={isExpanded}
    aria-controls="orientation-section-content"
    type="button"
  >
    <div class="header-content">
      <h3 class="section-title">{title}</h3>
      <p class="section-description">{description}</p>
    </div>
    <div class="header-value">
      {#if hasSelection}
        <span class="value-badge">{displayValue}</span>
      {:else}
        <span class="value-any">Any</span>
      {/if}
      <svg
        class="chevron"
        class:expanded={isExpanded}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  </button>

  {#if isExpanded}
    <div id="orientation-section-content" class="section-content">
      <OrientationPickerGrid {currentOrientation} {onOrientationChange} />
    </div>
  {/if}
</section>

<style>
  .orientation-section {
    background: var(--theme-card-bg);
  }

  .section-header {
    width: 100%;
    min-height: 72px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    transition: background var(--duration-normal) ease;
    text-align: left;
  }

  .section-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .section-header:active {
    background: rgba(255, 255, 255, 0.1);
  }

  .header-content {
    flex: 1;
    min-width: 0;
  }

  .section-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    margin: 0 0 4px 0;
    color: white;
  }

  .section-description {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    margin: 0;
  }

  .header-value {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .value-badge {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .value-any {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .chevron {
    width: 24px;
    height: 24px;
    transition: transform var(--duration-normal) ease;
  }

  .chevron.expanded {
    transform: rotate(180deg);
  }

  .section-content {
    padding: 0 24px 20px;
  }

  /* Mobile responsiveness */
  @media (max-width: 380px) {
    .section-header {
      padding: 14px 20px;
    }

    .section-content {
      padding: 0 20px 16px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .section-header,
    .chevron {
      transition: none;
    }
  }
</style>
