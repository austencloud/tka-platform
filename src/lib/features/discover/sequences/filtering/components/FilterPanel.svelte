<!--
FilterPanel - Explore Filtering and Sorting Controls

Matches the legacy desktop app's FilterPanel structure:
1. Header: "Browse Sequences"
2. Sort controls: Sort dropdown + direction button
3. Filter sections: All, Favorites, Difficulty, etc.

Follows Svelte 5 runes + microservices architecture.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import type { ExploreFilterValue } from "$lib/shared/persistence/domain/types/FilteringTypes";
  import { ExploreSortMethod } from "$lib/features/discover/shared/domain/enums/discover-enums";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    currentFilter = { type: "all", value: null },
    currentSort = ExploreSortMethod.ALPHABETICAL,
    sortDirection = "asc",
    onFilterChange = () => {},
    onSortChange = () => {},
  } = $props<{
    currentFilter?: { type: string; value: ExploreFilterValue };
    currentSort?: ExploreSortMethod;
    sortDirection?: "asc" | "desc";
    onFilterChange?: (type: string, value?: ExploreFilterValue) => void;
    onSortChange?: (
      method: ExploreSortMethod,
      direction: "asc" | "desc"
    ) => void;
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

  // Difficulty levels
  const difficultyLevels = [1, 2, 3, 4, 5];

  // Starting positions
  const startingPositions = ["home", "extended", "split", "opposite"];

  // Grid modes
  const gridModes = ["diamond", "box"];

  // Common tags
  const commonTags = [
    "beginner",
    "intermediate",
    "advanced",
    "expert",
    "master",
    "tutorial",
    "performance",
    "showcase",
  ];

  // Sequence lengths
  const sequenceLengths = [2, 4, 6, 8, 10, 12, 16];

  // Letters for filtering
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // State for multi-select filters
  let selectedLetters = $state<string[]>([]);
  let localSort = $state<ExploreSortMethod>(ExploreSortMethod.ALPHABETICAL);

  // Sync localSort with prop changes
  $effect(() => {
    localSort = currentSort;
  });

  // Apply a filter
  function applyFilter(type: string, value?: ExploreFilterValue) {
    // Trigger selection haptic feedback for filter selection
    hapticService?.trigger("selection");

    onFilterChange(type, value);
  }

  // Apply a sort
  function applySort(method: ExploreSortMethod, direction: "asc" | "desc") {
    // Trigger selection haptic feedback for sort change
    hapticService?.trigger("selection");

    onSortChange(method, direction);
  }

  // Handle sort change
  function handleSortChange() {
    applySort(localSort, sortDirection);
  }

  // Toggle sort direction
  function toggleSortDirection() {
    // Trigger selection haptic feedback for sort direction toggle
    hapticService?.trigger("selection");

    const newDirection = sortDirection === "asc" ? "desc" : "asc";
    applySort(localSort, newDirection);
  }

  // Toggle letter selection for "Contains Letters" filter
  function toggleLetter(letter: string) {
    // Trigger selection haptic feedback for letter toggle
    hapticService?.trigger("selection");

    if (selectedLetters.includes(letter)) {
      selectedLetters = selectedLetters.filter((l) => l !== letter);
    } else {
      selectedLetters = [...selectedLetters, letter];
    }

    if (selectedLetters.length > 0) {
      applyFilter("containsLetters", selectedLetters);
    } else {
      applyFilter("all");
    }
  }

  // Check if filter is active
  function isFilterActive(type: string, value?: ExploreFilterValue): boolean {
    if (currentFilter.type !== type) return false;
    if (value === undefined) return true;
    return currentFilter.value === value;
  }
</script>

<div class="filter-panel">
  <div class="filter-header">
    <h2>Browse Sequences</h2>
  </div>

  <div class="sort-controls">
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

  <div class="filter-sections">
    <h3>Filter By</h3>

    <!-- Basic filters -->
    <div class="filter-section">
      <button
        class="filter-button"
        class:active={isFilterActive("all")}
        onclick={() => applyFilter("all")}
      >
        All Sequences
      </button>

      <button
        class="filter-button"
        class:active={isFilterActive("favorites")}
        onclick={() => applyFilter("favorites")}
      >
        Favorites
      </button>
    </div>

    <!-- Difficulty filter -->
    <div class="filter-section">
      <h4>Difficulty Level</h4>
      <div class="button-grid">
        {#each difficultyLevels as level}
          <button
            class="filter-button"
            class:active={isFilterActive("difficulty", level)}
            onclick={() => applyFilter("difficulty", level)}
          >
            {level}
          </button>
        {/each}
      </div>
    </div>

    <!-- Starting Position filter -->
    <div class="filter-section">
      <h4>Starting Position</h4>
      <div class="button-grid">
        {#each startingPositions as position}
          <button
            class="filter-button"
            class:active={isFilterActive("startingPosition", position)}
            onclick={() => applyFilter("startingPosition", position)}
          >
            {position}
          </button>
        {/each}
      </div>
    </div>

    <!-- Grid Mode filter -->
    <div class="filter-section">
      <h4>Grid Mode</h4>
      <div class="button-grid">
        {#each gridModes as mode}
          <button
            class="filter-button"
            class:active={isFilterActive("gridMode", mode)}
            onclick={() => applyFilter("gridMode", mode)}
          >
            {mode}
          </button>
        {/each}
      </div>
    </div>

    <!-- Starting Letter filter -->
    <div class="filter-section">
      <h4>Starting Letter</h4>
      <div class="letter-grid">
        {#each letters as letter}
          <button
            class="filter-button small"
            class:active={isFilterActive("startingLetter", letter)}
            onclick={() => applyFilter("startingLetter", letter)}
          >
            {letter}
          </button>
        {/each}
      </div>
    </div>

    <!-- Contains Letters filter -->
    <div class="filter-section">
      <h4>Contains Letters</h4>
      <div class="letter-grid">
        {#each letters as letter}
          <button
            class="filter-button small"
            class:active={selectedLetters.includes(letter)}
            onclick={() => toggleLetter(letter)}
          >
            {letter}
          </button>
        {/each}
      </div>
      {#if selectedLetters.length > 0}
        <div class="selected-letters">
          <span>Selected: {selectedLetters.join(", ")}</span>
          <button
            class="clear-button"
            onclick={() => {
              selectedLetters = [];
              applyFilter("all");
            }}
          >
            Clear
          </button>
        </div>
      {/if}
    </div>

    <!-- Sequence Length filter -->
    <div class="filter-section">
      <h4>Sequence Length</h4>
      <div class="button-grid">
        {#each sequenceLengths as length}
          <button
            class="filter-button small"
            class:active={isFilterActive("length", length)}
            onclick={() => applyFilter("length", length)}
          >
            {length}
          </button>
        {/each}
      </div>
    </div>

    <!-- Tags filter -->
    <div class="filter-section">
      <h4>Tags</h4>
      <div class="tag-grid">
        {#each commonTags as tag}
          <button
            class="filter-button tag"
            class:active={isFilterActive("tag", tag)}
            onclick={() => applyFilter("tag", tag)}
          >
            {tag}
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .filter-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-card-bg);
    border-right: 1px solid var(--theme-stroke, var(--theme-stroke));
    color: var(--theme-text, white);
    overflow-y: auto;
  }

  .filter-header {
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
  }

  .filter-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .sort-controls {
    padding: var(--spacing-lg);
    border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
    background: var(--theme-card-bg);
  }

  .sort-controls label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--theme-text-dim);
  }

  .sort-select-container {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .sort-select-container select {
    flex: 1;
    padding: var(--spacing-sm);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: var(--border-radius);
    color: var(--theme-text, white);
    font-size: 0.9rem;
  }

  .sort-select-container select:focus {
    outline: none;
    border-color: var(--theme-accent, var(--accent-color));
    box-shadow: 0 0 0 2px
      color-mix(
        in srgb,
        var(--theme-accent, var(--accent-color)) 20%,
        transparent
      );
  }

  .sort-direction-button {
    padding: var(--spacing-sm);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: var(--border-radius);
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target);
  }

  .sort-direction-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .sort-icon {
    font-size: 1.1rem;
    font-weight: bold;
  }

  .filter-sections {
    flex: 1;
    padding: var(--spacing-lg);
  }

  .filter-sections h3 {
    margin: 0 0 var(--spacing-lg) 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .filter-section {
    margin-bottom: var(--spacing-xl);
  }

  .filter-section h4 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 0.95rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }

  .filter-button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: var(--border-radius);
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9rem;
    margin-bottom: var(--spacing-sm);
    width: 100%;
    text-align: left;
  }

  .filter-button:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text, white);
  }

  .filter-button.active {
    background: var(--theme-accent, var(--accent-color));
    border-color: var(--theme-accent, var(--accent-color));
    color: var(--theme-text, white);
    font-weight: 500;
  }

  .button-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm);
  }

  .letter-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--spacing-xs);
  }

  .tag-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-sm);
  }

  .filter-button.small {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.8rem;
    text-align: center;
  }

  .filter-button.tag {
    font-size: 0.85rem;
  }

  .selected-letters {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: var(--border-radius);
    font-size: 0.85rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .clear-button {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: var(--border-radius);
    color: var(--theme-text, white);
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s ease;
  }

  .clear-button:hover {
    background: var(--theme-card-hover-bg);
  }
</style>
