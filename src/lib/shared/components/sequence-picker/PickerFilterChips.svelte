<!--
  PickerFilterChips.svelte - Horizontal Filter Chips

  Compact filter row with:
  - Level dropdown chip
  - Favorites toggle chip
  - Beat count badge (when locked)
  - Clear filters button (when filters active)
-->
<script lang="ts">
  // ===== Props =====
  interface Props {
    levelFilter: number | null;
    favoritesOnly: boolean;
    requiredBeatCount: number | null;
    hasActiveFilters: boolean;
    onLevelChange: (level: number | null) => void;
    onFavoritesToggle: () => void;
    onClearFilters: () => void;
  }

  let {
    levelFilter,
    favoritesOnly,
    requiredBeatCount,
    hasActiveFilters,
    onLevelChange,
    onFavoritesToggle,
    onClearFilters,
  }: Props = $props();

  // Level options
  const levelOptions = [
    { value: null, label: "All Levels" },
    { value: 1, label: "Level 1 (Easy)" },
    { value: 2, label: "Level 2 (Medium)" },
    { value: 3, label: "Level 3 (Hard)" },
  ];

  let showLevelDropdown = $state(false);

  const currentLevelLabel = $derived(
    levelFilter === null
      ? "Level"
      : `Level ${levelFilter}`
  );

  function handleLevelSelect(level: number | null) {
    onLevelChange(level);
    showLevelDropdown = false;
  }

  // Close dropdown on click outside
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".level-dropdown-wrapper")) {
      showLevelDropdown = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="filter-chips" role="group" aria-label="Filters" onclick={handleClickOutside}>
  <!-- Beat Count Badge (when locked) -->
  {#if requiredBeatCount != null}
    <div class="beat-count-badge" title="Filtered to match composition length">
      <i class="fas fa-ruler-combined" aria-hidden="true"></i>
      <span>{requiredBeatCount}-beat sequences</span>
    </div>
  {/if}

  <!-- Level Dropdown Chip -->
  <div class="level-dropdown-wrapper">
    <button
      class="filter-chip"
      class:active={levelFilter !== null}
      onclick={(e) => {
        e.stopPropagation();
        showLevelDropdown = !showLevelDropdown;
      }}
      aria-haspopup="listbox"
      aria-expanded={showLevelDropdown}
    >
      <i class="fas fa-signal" aria-hidden="true"></i>
      <span>{currentLevelLabel}</span>
      <i
        class="fas fa-chevron-down dropdown-arrow"
        class:open={showLevelDropdown}
        aria-hidden="true"
      ></i>
    </button>

    {#if showLevelDropdown}
      <div class="level-dropdown" role="listbox">
        {#each levelOptions as option}
          <button
            class="level-option"
            class:active={levelFilter === option.value}
            onclick={(e) => {
              e.stopPropagation();
              handleLevelSelect(option.value);
            }}
            role="option"
            aria-selected={levelFilter === option.value}
          >
            <span>{option.label}</span>
            {#if levelFilter === option.value}
              <i class="fas fa-check check-icon" aria-hidden="true"></i>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Favorites Toggle Chip -->
  <button
    class="filter-chip"
    class:active={favoritesOnly}
    onclick={onFavoritesToggle}
    aria-pressed={favoritesOnly}
  >
    <i class={favoritesOnly ? "fas fa-star" : "far fa-star"} aria-hidden="true"></i>
    <span>Favorites</span>
  </button>

  <!-- Spacer -->
  <div class="spacer"></div>

  <!-- Clear Filters Button -->
  {#if hasActiveFilters}
    <button class="clear-filters-btn" onclick={onClearFilters}>
      <i class="fas fa-times" aria-hidden="true"></i>
      <span>Clear</span>
    </button>
  {/if}
</div>

<style>
  .filter-chips {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-xs, 4px) var(--spacing-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-wrap: wrap;
  }

  /* ===== Beat Count Badge ===== */
  .beat-count-badge {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-info, #3b82f6) 30%, transparent);
    border-radius: var(--border-radius-sm, 4px);
    color: var(--semantic-info, #3b82f6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
  }

  .beat-count-badge i {
    font-size: var(--font-size-compact, 12px);
  }

  /* ===== Filter Chips ===== */
  .filter-chip {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-sm, 4px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, white);
    color: var(--theme-text, white);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .filter-chip.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 40%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  .filter-chip i:first-child {
    font-size: var(--font-size-compact, 12px);
  }

  .dropdown-arrow {
    font-size: var(--font-size-compact, 12px);
    margin-left: 2px;
    transition: transform 0.15s ease;
  }

  .dropdown-arrow.open {
    transform: rotate(180deg);
  }

  /* ===== Level Dropdown ===== */
  .level-dropdown-wrapper {
    position: relative;
  }

  .level-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 140px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-md, 8px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 100;
    overflow: hidden;
  }

  .level-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .level-option:hover {
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, white);
    color: var(--theme-text, white);
  }

  .level-option.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 15%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  .level-option .check-icon {
    color: var(--theme-accent, #8b5cf6);
    font-size: 0.75rem;
  }

  /* ===== Spacer ===== */
  .spacer {
    flex: 1;
  }

  /* ===== Clear Filters ===== */
  .clear-filters-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-radius: var(--border-radius-sm, 4px);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .clear-filters-btn:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
  }

  .clear-filters-btn i {
    font-size: var(--font-size-compact, 12px);
  }

  /* ===== Mobile ===== */
  @media (max-width: 520px) {
    .filter-chips {
      padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
      gap: var(--spacing-xs, 4px);
    }

    .filter-chip span,
    .clear-filters-btn span {
      display: none; /* Icons only on mobile */
    }

    .beat-count-badge span {
      font-size: var(--font-size-compact, 12px);
    }
  }
</style>
