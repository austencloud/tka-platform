<!--
  PickerToolbar.svelte - Sort, Search, and Zoom Controls

  Compact toolbar with:
  - Sort dropdown (A-Z, Recent, Level, Length)
  - ExpandableSearchBar with Greek letter picker
  - Zoom controls (column count +/-)
  - Result count indicator
-->
<script lang="ts">
  import { BrowseSortMethod } from "$lib/features/browse/shared/domain/enums/browse-enums";
  import ExpandableSearchBar from "$lib/features/browse/shared/components/ExpandableSearchBar.svelte";

  interface Props {
    currentSort: BrowseSortMethod;
    columnCount: number;
    canZoomIn: boolean;
    canZoomOut: boolean;
    searchQuery?: string;
    resultCount: number;
    onSearchChange: (query: string) => void;
    onSortChange: (method: BrowseSortMethod) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
  }

  let {
    currentSort,
    columnCount,
    canZoomIn,
    canZoomOut,
    searchQuery = "",
    resultCount,
    onSearchChange,
    onSortChange,
    onZoomIn,
    onZoomOut,
  }: Props = $props();

  const sortOptions = [
    { id: BrowseSortMethod.ALPHABETICAL, label: "A-Z", icon: "fa-font" },
    { id: BrowseSortMethod.DATE_ADDED, label: "Recent", icon: "fa-clock" },
    { id: BrowseSortMethod.DIFFICULTY_LEVEL, label: "Level", icon: "fa-signal" },
    { id: BrowseSortMethod.SEQUENCE_LENGTH, label: "Length", icon: "fa-ruler" },
  ];

  let showSortDropdown = $state(false);

  const currentSortLabel = $derived(
    sortOptions.find((o) => o.id === currentSort)?.label ?? "Sort"
  );

  function handleSortSelect(method: BrowseSortMethod) {
    onSortChange(method);
    showSortDropdown = false;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".sort-dropdown-wrapper")) {
      showSortDropdown = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="toolbar" role="toolbar" tabindex="0" onclick={handleClickOutside}>
  <!-- Sort Dropdown -->
  <div class="sort-dropdown-wrapper">
    <button
      class="sort-trigger"
      onclick={(e) => {
        e.stopPropagation();
        showSortDropdown = !showSortDropdown;
      }}
      aria-haspopup="listbox"
      aria-expanded={showSortDropdown}
    >
      <i class="fas fa-sort-amount-down" aria-hidden="true"></i>
      <span>{currentSortLabel}</span>
      <i
        class="fas fa-chevron-down dropdown-arrow"
        class:open={showSortDropdown}
        aria-hidden="true"
      ></i>
    </button>

    {#if showSortDropdown}
      <div class="sort-dropdown" role="listbox">
        {#each sortOptions as option}
          <button
            class="sort-option"
            class:active={currentSort === option.id}
            onclick={(e) => {
              e.stopPropagation();
              handleSortSelect(option.id);
            }}
            role="option"
            aria-selected={currentSort === option.id}
          >
            <i class="fas {option.icon}" aria-hidden="true"></i>
            <span>{option.label}</span>
            {#if currentSort === option.id}
              <i class="fas fa-check check-icon" aria-hidden="true"></i>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Search with Greek letter picker -->
  <ExpandableSearchBar
    onSearch={onSearchChange}
    value={searchQuery}
    placeholder="Search sequences..."
  />

  <!-- Result Count -->
  <span class="result-count">
    {resultCount} sequence{resultCount === 1 ? "" : "s"}
  </span>

  <!-- Zoom Controls -->
  <div class="zoom-controls">
    <button
      class="zoom-btn"
      onclick={onZoomOut}
      disabled={!canZoomOut}
      aria-label="Fewer columns (larger cards)"
      title="Larger cards"
    >
      <i class="fas fa-minus" aria-hidden="true"></i>
    </button>
    <span class="zoom-indicator">{columnCount}</span>
    <button
      class="zoom-btn"
      onclick={onZoomIn}
      disabled={!canZoomIn}
      aria-label="More columns (smaller cards)"
      title="Smaller cards"
    >
      <i class="fas fa-plus" aria-hidden="true"></i>
    </button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 12px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* ===== Sort Dropdown ===== */
  .sort-dropdown-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .sort-trigger {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 4px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
    transition: all var(--duration-fast, 150ms) ease;
  }

  .sort-trigger:hover {
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, white);
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .sort-trigger i:first-child {
    font-size: var(--font-size-compact, 12px);
  }

  .dropdown-arrow {
    font-size: var(--font-size-compact, 12px);
    margin-left: 2px;
    transition: transform var(--duration-fast, 150ms) ease;
  }

  .dropdown-arrow.open {
    transform: rotate(180deg);
  }

  .sort-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 130px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-md, 8px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 100;
    overflow: hidden;
  }

  .sort-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    width: 100%;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    text-align: left;
    transition: all 0.1s ease;
  }

  .sort-option:hover {
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, white);
    color: var(--theme-text, white);
  }

  .sort-option.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 15%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  .sort-option i:first-child {
    width: 14px;
    text-align: center;
    opacity: 0.7;
  }

  .sort-option .check-icon {
    margin-left: auto;
    color: var(--theme-accent, #8b5cf6);
  }

  /* ===== Result Count ===== */
  .result-count {
    flex: 1;
    text-align: right;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    min-width: 0;
  }

  /* ===== Zoom Controls ===== */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 4px);
    padding: 2px;
    flex-shrink: 0;
  }

  .zoom-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.1s ease;
  }

  .zoom-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, white);
    color: var(--theme-text, white);
  }

  .zoom-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .zoom-indicator {
    min-width: 18px;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
  }

  /* ===== Mobile ===== */
  @media (max-width: 520px) {
    .toolbar {
      gap: var(--spacing-sm, 8px);
      padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    }

    .sort-trigger span {
      display: none;
    }

    .zoom-indicator {
      display: none;
    }

    .result-count {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sort-trigger,
    .dropdown-arrow,
    .sort-option,
    .zoom-btn {
      transition: none;
    }
  }
</style>
