<script lang="ts">
  import { onMount } from "svelte";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { ExploreSortMethod } from "../../../shared/domain/enums/discover-enums";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    sortBy = ExploreSortMethod.ALPHABETICAL,
    viewMode = "grid",
    onSortChange = () => {},
    onViewModeChange = () => {},
  } = $props<{
    sortBy?: ExploreSortMethod;
    viewMode?: "grid" | "list";
    onSortChange?: (sortBy: ExploreSortMethod) => void;
    onViewModeChange?: (viewMode: "grid" | "list") => void;
  }>();

  // Services
  let hapticService: IHapticFeedback | null = $state(null);

  onMount(async () => {
    hapticService = await resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  // Sort options
  const sortOptions = [
    { value: ExploreSortMethod.ALPHABETICAL, label: "Name A-Z" },
    { value: ExploreSortMethod.DIFFICULTY_LEVEL, label: "Difficulty" },
    { value: ExploreSortMethod.SEQUENCE_LENGTH, label: "Length" },
    { value: ExploreSortMethod.DATE_ADDED, label: "Recently Added" },
    { value: ExploreSortMethod.AUTHOR, label: "Author" },
  ];

  // Handle sort change
  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newSortBy = target.value as ExploreSortMethod;
    hapticService?.trigger("selection");
    onSortChange(newSortBy);
  }

  // Handle view mode change
  function handleViewModeChange(newViewMode: "grid" | "list") {
    hapticService?.trigger("selection");
    onViewModeChange(newViewMode);
  }
</script>

<div class="header-right">
  <div class="view-controls">
    <label class="sort-control">
      Sort by:
      <select value={sortBy} onchange={handleSortChange}>
        {#each sortOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>

    <div class="view-mode-toggle">
      <button
        class="view-button"
        class:active={viewMode === "grid"}
        onclick={() => handleViewModeChange("grid")}
        title="Grid View"
        aria-label="Switch to grid view"
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect x="1" y="1" width="6" height="6" fill="currentColor" />
          <rect x="9" y="1" width="6" height="6" fill="currentColor" />
          <rect x="1" y="9" width="6" height="6" fill="currentColor" />
          <rect x="9" y="9" width="6" height="6" fill="currentColor" />
        </svg>
      </button>
      <button
        class="view-button"
        class:active={viewMode === "list"}
        onclick={() => handleViewModeChange("list")}
        title="List View"
        aria-label="Switch to list view"
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect x="1" y="2" width="14" height="2" fill="currentColor" />
          <rect x="1" y="7" width="14" height="2" fill="currentColor" />
          <rect x="1" y="12" width="14" height="2" fill="currentColor" />
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .view-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .sort-control {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .sort-control select {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: var(--theme-text, white);
    font-family: inherit;
    font-size: var(--font-size-sm);
  }

  .sort-control select option {
    background: var(--theme-panel-bg);
    color: var(--theme-text, white);
    padding: var(--spacing-xs);
  }

  .view-mode-toggle {
    display: flex;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 6px;
    overflow: hidden;
  }

  .view-button {
    padding: var(--spacing-xs);
    background: transparent;
    border: none;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .view-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, white);
  }

  .view-button.active {
    background: var(--theme-accent, var(--primary-color));
    color: var(--theme-text, white);
  }

  /* Mobile-first responsive design */
  @media (max-width: 480px) {
    .header-right {
      flex-direction: column;
      gap: var(--spacing-sm);
      align-items: stretch;
    }

    .view-controls {
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .sort-control {
      font-size: 1rem;
      justify-content: space-between;
    }

    .sort-control select {
      padding: 12px 16px;
      font-size: 1rem;
      min-height: var(--min-touch-target);
      border-radius: 8px;
      flex: 1;
      margin-left: var(--spacing-sm);
    }

    .view-mode-toggle {
      align-self: center;
      border-radius: 8px;
    }

    .view-button {
      padding: 12px 16px;
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
    }

    .view-button svg {
      width: 20px;
      height: 20px;
    }
  }

  /* Tablet responsive design */
  @media (min-width: 481px) and (max-width: 768px) {
    .sort-control select {
      padding: 10px 14px;
      font-size: 0.9375rem;
      min-height: var(--min-touch-target);
    }

    .view-button {
      padding: 10px 12px;
      min-width: var(--min-touch-target);
      min-height: var(--min-touch-target);
    }

    .view-button svg {
      width: 18px;
      height: 18px;
    }
  }
</style>
