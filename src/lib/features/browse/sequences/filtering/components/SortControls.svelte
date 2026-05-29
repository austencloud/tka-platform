<!--
SortControls.svelte

Sort controls component for the Browse module.
Provides sort dropdown, direction toggle, and filter button in the top section.

Follows Svelte 5 runes + microservices architecture.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
    import { onMount } from "svelte";
  import { BrowseSortMethod } from "$lib/shared/browse/domain/enums/browse-enums";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    currentSort = BrowseSortMethod.ALPHABETICAL,
    sortDirection = "asc",
    onSortChange = () => {},
    onFilterClick = () => {},
  } = $props<{
    currentSort?: BrowseSortMethod;
    sortDirection?: "asc" | "desc";
    onSortChange?: (
      method: BrowseSortMethod,
      direction: "asc" | "desc"
    ) => void;
    onFilterClick?: () => void;
  }>();

  // Services
  let hapticService: HapticFeedback;

  onMount(async () => {
    hapticService = getHapticFeedback();
  });

  // Sort options matching legacy app
  const sortOptions = [
    { id: BrowseSortMethod.ALPHABETICAL, label: t('browse_sort_alphabetical') },
    { id: BrowseSortMethod.DIFFICULTY_LEVEL, label: t('browse_sort_difficulty') },
    { id: BrowseSortMethod.DATE_ADDED, label: t('browse_sort_date_added') },
    { id: BrowseSortMethod.SEQUENCE_LENGTH, label: t('browse_sort_length') },
  ];

  // Local state for controlled component - initialized with default, $effect syncs from prop
  let localSort = $state<BrowseSortMethod>(BrowseSortMethod.ALPHABETICAL);

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
    {t('browse_filter')}
  </button>

  <!-- Sort controls -->
  <div class="sort-section">
    <label for="sort-select">{t('browse_sort_by')}:</label>
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
          ? t('browse_sort_ascending')
          : t('browse_sort_descending')}
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
    transition: all var(--duration-normal) ease;
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
    transition: all var(--duration-normal) ease;
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
    transition: all var(--duration-normal) ease;
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
