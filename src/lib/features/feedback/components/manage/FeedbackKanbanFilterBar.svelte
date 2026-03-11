<!-- FeedbackKanbanFilterBar - Simplified filter bar for Kanban view (no status filter) -->
<script lang="ts">
  import type { FeedbackManageState } from "../../state/feedback-manage-state.svelte";
  import {
    TYPE_CONFIG,
    PRIORITY_CONFIG,
  } from "../../domain/models/feedback-models";
  import type {
    FeedbackType,
    FeedbackPriority,
  } from "../../domain/models/feedback-models";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  const { manageState } = $props<{
    manageState: FeedbackManageState;
  }>();

  // Count active filters (excluding status since it's shown visually)
  const activeFilterCount = $derived(
    [
      manageState.filters.type !== "all",
      manageState.filters.priority !== "all",
    ].filter(Boolean).length
  );

  function clearFilters() {
    manageState.setFilter("type", "all");
    manageState.setFilter("priority", "all");
  }
</script>

<div class="filter-bar">
  <!-- Search input -->
  <div class="search-wrapper">
    <i class="fas fa-search search-icon" aria-hidden="true"></i>
    <input
      type="text"
      class="search-input"
      placeholder={t("feedback_search_short")}
      value={manageState.searchQuery}
      oninput={(e) => manageState.setSearchQuery(e.currentTarget.value)}
    />
    {#if manageState.searchQuery}
      <button
        type="button"
        class="search-clear"
        onclick={() => manageState.setSearchQuery("")}
        aria-label="Clear search"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Desktop: Type + Priority filter chips -->
  <div class="filters-row">
    {#each Object.entries(TYPE_CONFIG) as [type, config]}
      <button
        type="button"
        class="filter-chip"
        class:active={manageState.filters.type === type}
        style="--chip-color: {config.color}"
        onclick={() =>
          manageState.setFilter(
            "type",
            manageState.filters.type === type ? "all" : (type as FeedbackType)
          )}
        title={config.label}
        aria-label="Filter by {config.label}"
      >
        <i class="fas {config.icon}" aria-hidden="true"></i>
      </button>
    {/each}

    <span class="filter-divider"></span>

    {#each Object.entries(PRIORITY_CONFIG) as [priority, config]}
      <button
        type="button"
        class="filter-chip"
        class:active={manageState.filters.priority === priority}
        style="--chip-color: {config.color}"
        onclick={() =>
          manageState.setFilter(
            "priority",
            manageState.filters.priority === priority
              ? "all"
              : (priority as FeedbackPriority)
          )}
        title="{config.label} priority"
        aria-label="Filter by {config.label} priority"
      >
        <i class="fas {config.icon}" aria-hidden="true"></i>
      </button>
    {/each}
  </div>

  {#if activeFilterCount > 0}
    <button
      type="button"
      class="clear-btn"
      onclick={clearFilters}
      aria-label="Clear filters"
    >
      <i class="fas fa-filter-circle-xmark" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .filter-bar {
    /* ===== FLUID SPACING ===== */
    --fb-space-xs: clamp(6px, 1.5cqi, 10px);
    --fb-space-sm: clamp(10px, 2.5cqi, 16px);
    --fb-space-md: clamp(14px, 3.5cqi, 20px);

    /* ===== FLUID TYPOGRAPHY ===== */
    --fb-text-sm: clamp(0.875rem, 2.5cqi, 1rem);

    /* ===== FLUID SIZING ===== */
    --fb-touch-target: clamp(44px, 11cqi, 48px);
    --fb-icon-btn: clamp(40px, 10cqi, 48px);

    display: flex;
    align-items: center;
    gap: var(--fb-space-sm);
    padding: var(--fb-space-sm) var(--fb-space-md);
    background: transparent;
    container-type: inline-size;
    container-name: filterbar;
  }

  /* ===== SEARCH ===== */
  .search-wrapper {
    position: relative;
    flex: 1;
    max-width: clamp(200px, 50cqi, 300px);
  }

  .search-icon {
    position: absolute;
    left: var(--fb-space-sm);
    top: 50%;
    transform: translateY(-50%);
    color: var(--theme-text-dim);
    font-size: var(--fb-text-sm);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: var(--fb-touch-target);
    padding: 0 var(--fb-touch-target) 0 clamp(36px, 9cqi, 44px);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke);
    border-radius: var(--fb-touch-target);
    color: var(--theme-text);
    font-size: var(--fb-text-sm);
    font-family: inherit;
    transition: all var(--duration-normal) ease;
  }

  .search-input::placeholder {
    color: var(--theme-text-dim);
  }

  .search-input:focus {
    outline: none;
    background: var(--theme-card-hover-bg, var(--theme-card-hover-bg));
    border-color: var(--semantic-success, var(--semantic-success));
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--semantic-success, var(--semantic-success)) 15%,
        transparent
      );
  }

  .search-clear {
    position: absolute;
    right: var(--fb-space-xs);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(32px, 8cqi, 40px);
    height: clamp(32px, 8cqi, 40px);
    background: none;
    border: none;
    color: var(--theme-text-dim);
    cursor: pointer;
    border-radius: 50%;
    transition: all var(--duration-fast) ease;
  }

  .search-clear:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text-dim));
  }

  /* ===== FILTER ROW ===== */
  .filters-row {
    display: flex;
    align-items: center;
    gap: var(--fb-space-xs);
  }

  .filter-divider {
    width: 1px;
    height: clamp(20px, 5cqi, 28px);
    background: var(--theme-stroke-strong);
    margin: 0 var(--fb-space-xs);
  }

  .filter-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--fb-icon-btn);
    height: var(--fb-icon-btn);
    background: var(--theme-card-bg);
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--fb-text-sm);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .filter-chip:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .filter-chip:active {
    transform: scale(0.92);
  }

  .filter-chip.active {
    background: color-mix(in srgb, var(--chip-color) 25%, transparent);
    color: var(--chip-color);
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--chip-color) 35%, transparent),
      0 4px 12px color-mix(in srgb, var(--chip-color) 20%, transparent);
  }

  /* ===== CLEAR BUTTON ===== */
  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--fb-icon-btn);
    height: var(--fb-icon-btn);
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 12%,
      transparent
    );
    border: none;
    border-radius: 50%;
    color: var(--semantic-error, var(--semantic-error));
    font-size: var(--fb-text-sm);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    margin-left: auto;
  }

  .clear-btn:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 20%,
      transparent
    );
  }

  /* ===== CONTAINER QUERY: Hide filters on mobile (tabs serve as filter) ===== */
  @container filterbar (max-width: 500px) {
    .filters-row {
      display: none;
    }

    .search-wrapper {
      max-width: none;
    }

    .clear-btn {
      display: none;
    }
  }

  /* ===== REDUCED MOTION ===== */
  @media (prefers-reduced-motion: reduce) {
    .filter-chip,
    .search-input,
    .search-clear,
    .clear-btn {
      transition: none;
    }
  }
</style>
