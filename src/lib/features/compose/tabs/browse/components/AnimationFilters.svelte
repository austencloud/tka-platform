<!--
AnimationFilters.svelte

Collapsible filter toolbar for the browse tab.

Features:
- Collapsed: Filter button + favorites toggle + active chips + sort controls
- Expanded: Mode filter chips
- Favorites toggle always visible in toolbar for quick access
- Smooth expand/collapse animation
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import type { ComposeMode } from "../../../shared/state/compose-module-state.svelte";
  import type {
    AnimationFilter,
    SortMethod,
    SortDirection,
  } from "../state/browse-state.svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let hapticService: IHapticFeedback | null = null;

  const {
    currentFilter = {},
    sortMethod = "date",
    sortDirection = "desc",
    expanded = false,
    searchQuery = "",
    onFilterChange = () => {},
    onSortChange = () => {},
    onExpandToggle = () => {},
    onSearchChange = () => {},
  } = $props<{
    currentFilter?: AnimationFilter;
    sortMethod?: SortMethod;
    sortDirection?: SortDirection;
    expanded?: boolean;
    searchQuery?: string;
    onFilterChange?: (filter: AnimationFilter) => void;
    onSortChange?: (method: SortMethod, direction: SortDirection) => void;
    onExpandToggle?: () => void;
    onSearchChange?: (query: string) => void;
  }>();

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Check if any filters are active
  const hasActiveFilters = $derived(
    Boolean(currentFilter.mode) ||
    Boolean(currentFilter.favorites) ||
    Boolean(searchQuery?.trim())
  );

  // Mode options (single source of truth for labels)
  const modeOptions: {
    value: ComposeMode | "all";
    label: string;
    icon: string;
  }[] = [
    { value: "all", label: "All", icon: "fa-layer-group" },
    { value: "single", label: "Single", icon: "fa-play" },
    { value: "mirror", label: "Mirror", icon: "fa-clone" },
    { value: "tunnel", label: "Tunnel", icon: "fa-layer-group" },
    { value: "grid", label: "Grid", icon: "fa-th" },
    { value: "side-by-side", label: "Side by Side", icon: "fa-columns" },
  ];

  // Get mode label from modeOptions (derived from single source of truth)
  function getModeLabel(mode: ComposeMode | undefined): string {
    if (!mode) return "";
    const option = modeOptions.find((opt) => opt.value === mode);
    return option?.label || mode;
  }

  // Sort options
  const sortOptions: { value: SortMethod; label: string }[] = [
    { value: "date", label: "Date Modified" },
    { value: "name", label: "Name" },
    { value: "popularity", label: "Popularity" },
  ];

  // Handlers
  function handleModeChange(mode: ComposeMode | "all") {
    hapticService?.trigger("selection");
    if (mode === "all") {
      onFilterChange({ ...currentFilter, mode: undefined });
    } else {
      onFilterChange({ ...currentFilter, mode });
    }
  }

  function handleFavoritesToggle() {
    hapticService?.trigger("selection");
    onFilterChange({
      ...currentFilter,
      favorites: !currentFilter.favorites,
    });
  }

  function handleSortMethodChange(method: SortMethod) {
    hapticService?.trigger("selection");
    onSortChange(method, sortDirection);
  }

  function handleSortDirectionToggle() {
    hapticService?.trigger("selection");
    const newDirection = sortDirection === "asc" ? "desc" : "asc";
    onSortChange(sortMethod, newDirection);
  }
</script>

<div class="filters-toolbar">
  <!-- Search Input -->
  <div class="search-section">
    <div class="search-input-wrapper">
      <i class="fas fa-search search-icon" aria-hidden="true"></i>
      <input
        type="text"
        class="search-input"
        placeholder="Search animations..."
        value={searchQuery}
        oninput={(e) => onSearchChange(e.currentTarget.value)}
        aria-label="Search animations"
      />
      {#if searchQuery}
        <button
          class="search-clear"
          onclick={() => onSearchChange("")}
          aria-label="Clear search"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>
  </div>

  <!-- Always visible toolbar row -->
  <div class="toolbar-row">
    <!-- Expand toggle button -->
    <button
      class="expand-toggle"
      class:active={hasActiveFilters}
      onclick={() => {
        hapticService?.trigger("selection");
        onExpandToggle();
      }}
      aria-expanded={expanded}
      aria-controls="filter-options"
    >
      <i class="fas fa-filter" aria-hidden="true"></i>
      <span>Filters</span>
      <i
        class="fas chevron-icon"
        class:fa-chevron-up={expanded}
        class:fa-chevron-down={!expanded}
        aria-hidden="true"
      ></i>
    </button>

    <!-- Favorites toggle (always visible) -->
    <button
      class="favorites-toggle-compact"
      class:active={currentFilter.favorites}
      onclick={handleFavoritesToggle}
      aria-label={currentFilter.favorites ? "Show all" : "Show favorites only"}
      aria-pressed={currentFilter.favorites}
      title={currentFilter.favorites ? "Show all" : "Show favorites only"}
    >
      <i class="fas fa-heart" aria-hidden="true"></i>
    </button>

    <!-- Active filter chips (shown when collapsed) -->
    {#if !expanded && (currentFilter.mode || searchQuery?.trim())}
      <div class="active-chips">
        {#if searchQuery?.trim()}
          <span class="filter-chip search-chip-tag">
            <i class="fas fa-search" aria-hidden="true"></i>
            <span class="search-term">"{searchQuery.length > 15 ? searchQuery.substring(0, 15) + '...' : searchQuery}"</span>
            <button
              class="chip-remove"
              onclick={() => {
                hapticService?.trigger("selection");
                onSearchChange("");
              }}
              aria-label="Clear search"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </span>
        {/if}
        {#if currentFilter.mode}
          <span class="filter-chip mode-chip-tag">
            {getModeLabel(currentFilter.mode)}
            <button
              class="chip-remove"
              onclick={() => {
                hapticService?.trigger("selection");
                onFilterChange({ ...currentFilter, mode: undefined });
              }}
              aria-label="Remove mode filter"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </span>
        {/if}
        {#if currentFilter.mode && searchQuery?.trim()}
          <button
            class="clear-all-btn"
            onclick={() => {
              hapticService?.trigger("selection");
              onFilterChange({ ...currentFilter, mode: undefined });
              onSearchChange("");
            }}
            aria-label="Clear all filters"
          >
            Clear all
          </button>
        {/if}
      </div>
    {/if}

    <!-- Sort Controls (always visible) -->
    <div class="sort-controls">
      <select
        class="sort-select"
        value={sortMethod}
        onchange={(e) =>
          handleSortMethodChange(e.currentTarget.value as SortMethod)}
        aria-label="Sort method"
      >
        {#each sortOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <button
        class="sort-direction-btn"
        onclick={handleSortDirectionToggle}
        aria-label={sortDirection === "asc"
          ? "Sort descending"
          : "Sort ascending"}
        title={sortDirection === "asc" ? "Sort descending" : "Sort ascending"}
      >
        <i
          class="fas {sortDirection === 'asc'
            ? 'fa-arrow-up'
            : 'fa-arrow-down'}"
          aria-hidden="true"
        ></i>
      </button>
    </div>
  </div>

  <!-- Expandable filter options -->
  {#if expanded}
    <div
      id="filter-options"
      class="filter-options"
      transition:slide={{ duration: 200 }}
    >
      <!-- Mode Filters -->
      <div class="filter-section">
        <span class="filter-label" id="mode-filter-label">Mode</span>
        <div class="mode-chips" role="group" aria-labelledby="mode-filter-label">
          {#each modeOptions as option}
            <button
              class="mode-chip"
              class:active={option.value === "all"
                ? !currentFilter.mode
                : currentFilter.mode === option.value}
              aria-current={option.value === "all" ? !currentFilter.mode : currentFilter.mode === option.value}
              onclick={() => handleModeChange(option.value)}
            >
              <i class="fas {option.icon}" aria-hidden="true"></i>
              <span>{option.label}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Toolbar Container */
  .filters-toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  /* Search Section */
  .search-section {
    /* Spacing handled by .filters-toolbar gap */
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 10px 36px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    transition: border-color 0.2s ease;
  }

  .search-input::placeholder {
    color: var(--theme-text-dim);
  }

  .search-input:focus {
    border-color: var(--theme-accent);
  }

  .search-input:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .search-clear {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    color: var(--theme-text-dim);
    cursor: pointer;
    padding: 4px;
    transition: color 0.15s ease;
  }

  .search-clear:hover {
    color: var(--theme-text);
  }

  .search-clear:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Always-visible row */
  .toolbar-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
    row-gap: var(--spacing-sm);
  }

  /* Expand Toggle Button */
  .expand-toggle {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .expand-toggle:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text);
  }

  .expand-toggle:hover .chevron-icon {
    opacity: 1;
  }

  .expand-toggle.active {
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    color: var(--theme-accent);
  }

  .expand-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .expand-toggle .chevron-icon {
    font-size: 10px;
    opacity: 0.6;
    transition: transform 0.2s ease, opacity 0.15s ease;
  }

  /* Compact Favorites Toggle (always visible in toolbar) */
  .favorites-toggle-compact {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .favorites-toggle-compact:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .favorites-toggle-compact.active {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 40%, transparent);
    color: var(--semantic-error);
  }

  .favorites-toggle-compact:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Active Filter Chips */
  .active-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px 5px 10px;
    border-radius: 16px; /* Pill shape */
    font-size: var(--font-size-compact);
    font-weight: 500;
    line-height: 1;
  }

  .mode-chip-tag {
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 25%, transparent);
    color: var(--theme-accent);
  }

  .favorites-chip-tag {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 25%, transparent);
    color: var(--semantic-error);
  }

  .favorites-chip-tag i {
    font-size: 10px;
  }

  .search-chip-tag {
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    color: var(--theme-text);
  }

  .search-chip-tag .search-term {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .clear-all-btn {
    padding: 6px 10px;
    background: transparent;
    border: 1px dashed var(--theme-stroke);
    border-radius: 4px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-all-btn:hover {
    border-color: var(--theme-text-dim);
    color: var(--theme-text);
  }

  .clear-all-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .chip-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 4px;
    margin: -4px -2px -4px 2px; /* Negative margin to expand hit area without visual size */
    opacity: 0.7;
    transition: opacity 0.15s ease;
    border-radius: 2px;
  }

  .chip-remove:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .chip-remove:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 0;
    opacity: 1;
  }

  .chip-remove i {
    font-size: 11px;
  }

  /* Sort Controls */
  .sort-controls {
    display: flex;
    gap: 4px;
    margin-left: auto;
    padding-left: var(--spacing-sm);
    border-left: 1px solid var(--theme-stroke);
  }

  .sort-select {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: var(--theme-text);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sort-select:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .sort-select:focus {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    outline-offset: 2px;
  }

  .sort-select option {
    background: var(--theme-panel-bg, #1a1a2e);
    color: var(--theme-text, white);
  }

  .sort-direction-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sort-direction-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text);
  }

  .sort-direction-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Expandable Filter Options */
  .filter-options {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-md) 0 var(--spacing-xs) 0;
    margin-top: var(--spacing-xs);
    border-top: 1px solid color-mix(in srgb, var(--theme-stroke) 50%, transparent);
  }

  /* Filter Section */
  .filter-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .filter-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Mode Chips */
  .mode-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mode-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 20px; /* Pill shape */
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-chip:hover:not(.active) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text);
  }

  .mode-chip.active {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
  }

  .mode-chip i {
    font-size: var(--font-size-compact);
  }

  .mode-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Favorites Toggle */
  .favorites-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    width: fit-content;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .favorites-toggle:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text);
  }

  .favorites-toggle.active {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 40%, transparent);
    color: var(--semantic-error);
  }

  .favorites-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Mobile adjustments */
  @media (max-width: 640px) {
    .toolbar-row {
      gap: var(--spacing-sm);
    }

    .expand-toggle {
      padding: 6px 10px;
    }

    .mode-chips {
      gap: 6px;
    }

    .mode-chip {
      padding: 6px 10px;
    }

    .sort-controls {
      border-left: none;
      padding-left: 0;
      margin-left: 0;
      flex: 1;
      justify-content: flex-end;
    }

    .sort-select {
      flex: 1;
      max-width: 150px;
    }

    /* Ensure 48px touch targets on mobile */
    .sort-direction-btn {
      width: 48px;
      height: 48px;
    }

    .favorites-toggle-compact {
      width: 48px;
      height: 48px;
    }

    .expand-toggle {
      min-height: 48px;
    }

    /* Better touch targets for filter chips on mobile */
    .filter-chip {
      padding: 8px 12px;
      gap: 8px;
    }

    .filter-chip i:first-child {
      font-size: 12px;
    }

    /* Expand touch target for chip remove buttons using pseudo-element */
    .chip-remove {
      position: relative;
    }

    .chip-remove::before {
      content: "";
      position: absolute;
      inset: -8px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .expand-toggle,
    .mode-chip,
    .favorites-toggle,
    .favorites-toggle-compact,
    .sort-select,
    .sort-direction-btn,
    .chip-remove,
    .clear-all-btn,
    .search-input,
    .search-clear,
    .expand-toggle .chevron-icon {
      transition: none;
    }
  }
</style>
