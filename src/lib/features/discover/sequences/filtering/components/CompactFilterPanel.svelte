<!--
CompactFilterPanel.svelte

Compact, mobile-optimized filter panel for the Discover module.
Uses chips/tags for quick filtering with less screen real estate.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import type { ExploreFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";

  const {
    currentFilter = { type: "all", value: null },
    onFilterChange = () => {},
    onOpenAdvanced = () => {},
  } = $props<{
    currentFilter?: { type: string; value: ExploreFilterValue };
    onFilterChange?: (type: string, value?: ExploreFilterValue) => void;
    onOpenAdvanced?: () => void;
  }>();

  let hapticService: IHapticFeedback;

  // Quick filter options with unique colors
  const quickFilters = [
    {
      id: "all",
      label: "All",
      icon: "fa-th",
      color: "#a855f7",
      gradient: "linear-gradient(135deg, #c084fc 0%, #a855f7 100%)",
    },
    {
      id: "favorites",
      label: "Favorites",
      icon: "fa-heart",
      color: "#ec4899",
      gradient: "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
    },
    {
      id: "recent",
      label: "Recent",
      icon: "fa-clock",
      color: "#06b6d4",
      gradient: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
    },
    {
      id: "difficulty-1",
      label: "Easy",
      icon: "fa-star",
      type: "difficulty",
      value: 1,
      color: "var(--semantic-success)",
      gradient:
        "linear-gradient(135deg, #34d399 0%, var(--semantic-success) 100%)",
    },
    {
      id: "difficulty-2",
      label: "Medium",
      icon: "fa-star-half-alt",
      type: "difficulty",
      value: 2,
      color: "var(--semantic-warning)",
      gradient:
        "linear-gradient(135deg, var(--semantic-warning) 0%, var(--semantic-warning) 100%)",
    },
    {
      id: "difficulty-3",
      label: "Hard",
      icon: "fa-fire",
      type: "difficulty",
      value: 3,
      color: "var(--semantic-error)",
      gradient:
        "linear-gradient(135deg, var(--semantic-error) 0%, var(--semantic-error) 100%)",
    },
  ];

  function handleQuickFilter(filter: (typeof quickFilters)[0]) {
    hapticService?.trigger("selection");
    if (filter.type && filter.value !== undefined) {
      onFilterChange(filter.type, filter.value);
    } else {
      onFilterChange(filter.id);
    }
  }

  function handleAdvancedClick() {
    hapticService?.trigger("selection");
    onOpenAdvanced();
  }

  function isFilterActive(filter: (typeof quickFilters)[0]): boolean {
    if (filter.type && filter.value !== undefined) {
      return (
        currentFilter.type === filter.type &&
        currentFilter.value === filter.value
      );
    }
    return currentFilter.type === filter.id;
  }

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });
</script>

<div class="compact-filter-panel">
  <!-- Quick filter chips -->
  <div class="filter-chips">
    {#each quickFilters as filter}
      <button
        class="filter-chip"
        class:active={isFilterActive(filter)}
        style="--chip-color: {filter.color}; --chip-gradient: {filter.gradient}; --chip-glow: {filter.color}33;"
        onclick={() => handleQuickFilter(filter)}
        aria-label={filter.label}
      >
        <i class="fas {filter.icon}" aria-hidden="true"></i>
        <span>{filter.label}</span>
      </button>
    {/each}
  </div>

  <!-- Advanced filters button -->
  <button
    class="advanced-button"
    onclick={handleAdvancedClick}
    aria-label="Advanced filters"
  >
    <i class="fas fa-sliders-h" aria-hidden="true"></i>
    <span class="desktop-only">Advanced</span>
  </button>
</div>

<style>
  .compact-filter-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .filter-chips {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 2px 0;
  }

  .filter-chips::-webkit-scrollbar {
    display: none;
  }

  .filter-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 20px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .filter-chip:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }

  .filter-chip.active {
    background: var(--chip-gradient, rgba(0, 123, 255, 0.25));
    border-color: var(--chip-color, rgba(0, 123, 255, 0.5));
    color: var(--theme-text, white);
    box-shadow: 0 0 12px var(--chip-glow, rgba(0, 123, 255, 0.3));
  }

  .filter-chip i {
    font-size: var(--font-size-compact);
  }

  .advanced-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 20px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .advanced-button:hover {
    background: color-mix(in srgb, var(--theme-text, white) 12%, transparent);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
  }

  .advanced-button i {
    font-size: var(--font-size-sm);
  }

  /* Hide "Advanced" text on mobile */
  @media (max-width: 480px) {
    .desktop-only {
      display: none;
    }

    .advanced-button {
      padding: 8px 12px;
    }

    .filter-chip {
      font-size: var(--font-size-compact);
      padding: 5px 10px;
    }
  }

  /* Better spacing on larger screens */
  @media (min-width: 768px) {
    .compact-filter-panel {
      gap: 16px;
    }

    .filter-chips {
      gap: 8px;
    }

    .filter-chip {
      padding: 8px 14px;
      font-size: var(--font-size-sm);
    }

    .advanced-button {
      padding: 8px 16px;
      font-size: var(--font-size-sm);
    }
  }
</style>
