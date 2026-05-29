<!--
  Navigation.svelte - Choreo card filter sidebar

  Length filter buttons and column layout selector.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount } from "svelte";

  interface Props {
    selectedLength: number;
    columnCount: number;
    onLengthSelected: (length: number) => void;
    onColumnCountChanged: (count: number) => void;
  }

  let {
    selectedLength,
    columnCount,
    onLengthSelected,
    onColumnCountChanged,
  }: Props = $props();

  let hapticService: HapticFeedback;

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  const lengthOptions = [
    { value: 0, label: "All", icon: "fa-layer-group" },
    { value: 2, label: "2" },
    { value: 3, label: "3" },
    { value: 4, label: "4" },
    { value: 6, label: "6" },
    { value: 8, label: "8" },
    { value: 10, label: "10" },
    { value: 12, label: "12" },
    { value: 16, label: "16" },
  ];

  const columnOptions = [1, 2, 3, 4];

  function handleLengthClick(length: number) {
    hapticService?.trigger("selection");
    onLengthSelected(length);
  }

  function handleColumnClick(count: number) {
    hapticService?.trigger("selection");
    onColumnCountChanged(count);
  }
</script>

<div class="navigation">
  <!-- Length Filter -->
  <section class="section">
    <h3 class="section-title">
      <i class="fas fa-filter" aria-hidden="true"></i>
      <span>Steps</span>
    </h3>
    <div class="length-grid">
      {#each lengthOptions as option (option.value)}
        <button
          class="length-btn"
          class:selected={selectedLength === option.value}
          class:all={option.value === 0}
          onclick={() => handleLengthClick(option.value)}
          aria-pressed={selectedLength === option.value}
          aria-label="Filter by {option.label === 'All' ? 'all step counts' : option.label + ' steps'}"
          type="button"
        >
          {#if option.icon}
            <i class="fas {option.icon}" aria-hidden="true"></i>
          {/if}
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <!-- Column Layout -->
  <section class="section">
    <h3 class="section-title">
      <i class="fas fa-columns" aria-hidden="true"></i>
      <span>Columns</span>
    </h3>
    <div class="column-grid">
      {#each columnOptions as count (count)}
        <button
          class="column-btn"
          class:selected={columnCount === count}
          onclick={() => handleColumnClick(count)}
          aria-pressed={columnCount === count}
          aria-label="Show {count} {count === 1 ? 'column' : 'columns'}"
          type="button"
        >
          {count}
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .navigation {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-title i {
    font-size: 12px;
    opacity: 0.7;
  }

  /* Length Grid - flexible wrap */
  .length-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .length-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .length-btn.all {
    /* Slightly wider for "All" with icon */
    min-width: 64px;
  }

  .length-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .length-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .length-btn.selected {
    background: var(--theme-accent, #f43f5e);
    border-color: var(--theme-accent, #f43f5e);
    color: var(--theme-text, #ffffff);
  }

  .length-btn i {
    font-size: 12px;
  }

  /* Column Grid - flexible wrap */
  .column-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  .column-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .column-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .column-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .column-btn.selected {
    background: var(--theme-accent, #f43f5e);
    border-color: var(--theme-accent, #f43f5e);
    color: var(--theme-text, #ffffff);
  }

  /* Responsive - horizontal layout on mobile */
  @media (max-width: 768px) {
    .navigation {
      flex-direction: row;
      gap: var(--spacing-md);
    }

    .section {
      flex-shrink: 0;
    }

    .length-grid,
    .column-grid {
      flex-wrap: nowrap;
    }

    .length-btn,
    .column-btn {
      font-size: var(--font-size-compact, 12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .length-btn,
    .column-btn {
      transition: none;
    }
  }
</style>
