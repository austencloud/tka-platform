<!--
SortControls.svelte

Sort controls component for the Discover module.
Provides sort dropdown, direction toggle, and filter button in the top section.

Follows Svelte 5 runes + microservices architecture.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import { ExploreSortMethod } from "$lib/features/discover/shared/domain/enums/discover-enums";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    currentSort = ExploreSortMethod.ALPHABETICAL,
    sortDirection = "asc",
    onSortChange = () => {},
    onFilterClick = () => {},
  } = $props<{
    currentSort?: ExploreSortMethod;
    sortDirection?: "asc" | "desc";
    onSortChange?: (
      method: ExploreSortMethod,
      direction: "asc" | "desc"
    ) => void;
    onFilterClick?: () => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;

  onMount(async () => {
    hapticService = await resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Sort options matching legacy app
  const sortOptions = [
    { id: ExploreSortMethod.ALPHABETICAL, label: "Alphabetical" },
    { id: ExploreSortMethod.DIFFICULTY_LEVEL, label: "Difficulty" },
    { id: ExploreSortMethod.DATE_ADDED, label: "Date Added" },
    { id: ExploreSortMethod.SEQUENCE_LENGTH, label: "Length" },
  ];

  // Local state for controlled component - initialized with default, $effect syncs from prop
  let localSort = $state<ExploreSortMethod>(ExploreSortMethod.ALPHABETICAL);

  // Sync localSort with prop changes
  $effect(() => {
    localSort = currentSort;
  });

  // Handle sort change
  function handleSortChange() {
    hapticService?.trigger("selection");
    onSortChange(localSort, sortDirection);
  }

  // Toggle sort direction
  function toggleSortDirection() {
    hapticService?.trigger("selection");
    const newDirection = sortDirection === "asc" ? "desc" : "asc";
    onSortChange(localSort, newDirection);
  }

  // Handle filter button click
  function handleFilterClick() {
    hapticService?.trigger("selection");
    onFilterClick();
  }
</script>

<div class="sort-controls">
  <!-- Filter button -->
  <button class="filter-button" onclick={handleFilterClick}>
    <span class="filter-icon">🔍</span>
    Filter
  </button>

  <!-- Sort controls -->
  <div class="sort-section">
    <label for="sort-select">Sort by:</label>
    <div class="sort-select-container">
      <select
        id="sort-select"
        bind:value={localSort}
        onchange={handleSortChange}
      >
        {#each sortOptions as option}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>

      <button
        class="sort-direction-button"
        onclick={toggleSortDirection}
        aria-label={sortDirection === "asc"
          ? "Sort ascending"
          : "Sort descending"}
      >
        {#if sortDirection === "asc"}
          <span class="sort-icon">↑</span>
        {:else}
          <span class="sort-icon">↓</span>
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .sort-controls {
    display: flex;
    align-items: center;
    gap: 24px;
    background: var(--theme-card-bg);
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .filter-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--semantic-info);
    color: var(--theme-text, white);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .filter-button:hover {
    background: color-mix(in srgb, var(--semantic-info) 85%, #000);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px
      color-mix(in srgb, var(--semantic-info) 30%, transparent);
  }

  .filter-icon {
    font-size: 1rem;
  }

  .sort-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sort-section label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--theme-text-dim);
    white-space: nowrap;
  }

  .sort-select-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  select {
    padding: 8px 12px;
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 6px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    color: var(--theme-text, white);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 140px;
  }

  select:hover {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
  }

  select:focus {
    outline: none;
    border-color: var(--semantic-info);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--semantic-info) 20%, transparent);
  }

  .sort-direction-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sort-direction-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .sort-direction-button:active {
    transform: translateY(1px);
  }

  .sort-icon {
    font-size: 1.2rem;
    color: var(--theme-text-dim);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .sort-controls {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
    }

    .sort-section {
      justify-content: space-between;
    }

    .filter-button {
      justify-content: center;
    }
  }
</style>
