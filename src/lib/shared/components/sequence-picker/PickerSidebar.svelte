<!--
  PickerSidebar.svelte - Desktop Filter Sidebar

  Vertical filter controls shown on desktop (>= 768px), hidden on mobile.
  Follows the SettingsSidebar pattern: vertical nav on desktop, filter chips on mobile.

  Sections:
  - Level filter (radio-style buttons)
  - Favorites toggle
  - Beat count badge (when locked)
  - Result count
  - Clear filters button (when active)
-->
<script lang="ts">
  interface Props {
    levelFilter: number | null;
    favoritesOnly: boolean;
    requiredBeatCount: number | null;
    hasActiveFilters: boolean;
    resultCount?: number;
    onLevelChange: (level: number | null) => void;
    onFavoritesToggle: () => void;
    onClearFilters: () => void;
  }

  let {
    levelFilter,
    favoritesOnly,
    requiredBeatCount,
    hasActiveFilters,
    resultCount = 0,
    onLevelChange,
    onFavoritesToggle,
    onClearFilters,
  }: Props = $props();

  const levelOptions = [
    { value: null, label: "All Levels", icon: "fa-layer-group" },
    { value: 1, label: "Easy", icon: "fa-seedling" },
    { value: 2, label: "Medium", icon: "fa-fire" },
    { value: 3, label: "Hard", icon: "fa-bolt" },
  ];
</script>

<aside class="picker-sidebar" aria-label="Filters">
  <!-- Level Section -->
  <div class="sidebar-section">
    <h3 class="section-label">Level</h3>
    <div class="level-list" role="radiogroup" aria-label="Difficulty level">
      {#each levelOptions as option}
        <button
          class="level-item"
          class:active={levelFilter === option.value}
          onclick={() => onLevelChange(option.value)}
          role="radio"
          aria-checked={levelFilter === option.value}
        >
          <i class="fas {option.icon}" aria-hidden="true"></i>
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Favorites Section -->
  <div class="sidebar-section">
    <h3 class="section-label">Favorites</h3>
    <button
      class="level-item"
      class:active={favoritesOnly}
      onclick={onFavoritesToggle}
      aria-pressed={favoritesOnly}
    >
      <i class={favoritesOnly ? "fas fa-star" : "far fa-star"} aria-hidden="true"></i>
      <span>{favoritesOnly ? "Showing favorites" : "Show favorites"}</span>
    </button>
  </div>

  <!-- Beat Count Badge (when locked) -->
  {#if requiredBeatCount != null}
    <div class="sidebar-section">
      <h3 class="section-label">Beat Count</h3>
      <div class="beat-badge">
        <i class="fas fa-ruler-combined" aria-hidden="true"></i>
        <span>{requiredBeatCount}-beat</span>
      </div>
    </div>
  {/if}

  <!-- Spacer pushes bottom content down -->
  <div class="sidebar-spacer"></div>

  <!-- Result Count -->
  <div class="result-count">
    {resultCount} sequence{resultCount === 1 ? "" : "s"}
  </div>

  <!-- Clear Filters -->
  {#if hasActiveFilters}
    <button class="clear-btn" onclick={onClearFilters}>
      <i class="fas fa-times" aria-hidden="true"></i>
      <span>Clear filters</span>
    </button>
  {/if}
</aside>

<style>
  .picker-sidebar {
    display: flex;
    flex-direction: column;
    width: clamp(180px, 15vw, 220px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: var(--spacing-md, 12px);
    overflow-y: auto;
    flex-shrink: 0;
  }

  /* ===== Sections ===== */
  .sidebar-section {
    margin-bottom: var(--spacing-lg, 16px);
  }

  .section-label {
    margin: 0 0 var(--spacing-sm, 8px) 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ===== Level Items ===== */
  .level-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .level-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    width: 100%;
    min-height: 40px;
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--border-radius-sm, 4px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .level-item:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .level-item.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }

  .level-item i {
    width: 16px;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    opacity: 0.8;
  }

  .level-item.active i {
    opacity: 1;
  }

  /* ===== Beat Count Badge ===== */
  .beat-badge {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
    min-height: 40px;
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-info, #3b82f6) 30%, transparent);
    border-radius: var(--border-radius-sm, 4px);
    color: var(--semantic-info, #3b82f6);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
  }

  .beat-badge i {
    width: 16px;
    text-align: center;
    font-size: var(--font-size-compact, 12px);
  }

  /* ===== Spacer ===== */
  .sidebar-spacer {
    flex: 1;
  }

  /* ===== Result Count ===== */
  .result-count {
    padding: var(--spacing-sm, 8px) var(--spacing-xs, 4px);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-align: center;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    margin-top: var(--spacing-sm, 8px);
  }

  /* ===== Clear Button ===== */
  .clear-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs, 4px);
    width: 100%;
    min-height: 40px;
    padding: var(--spacing-sm, 8px);
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-radius: var(--border-radius-sm, 4px);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
    margin-top: var(--spacing-sm, 8px);
  }

  .clear-btn:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
  }

  .clear-btn i {
    font-size: var(--font-size-compact, 12px);
  }

  /* ===== Hidden on Mobile ===== */
  @media (max-width: 767px) {
    .picker-sidebar {
      display: none;
    }
  }
</style>
